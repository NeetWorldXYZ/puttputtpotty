-- invite_friend's parameter shared a name with the match_invites column it
-- filtered on ("column reference to_user is ambiguous"). Distinct names.
drop function if exists public.invite_friend(uuid, uuid);
create or replace function public.invite_friend(in_to uuid, in_match uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m public.matches;
  inv uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.friend_relation(me, in_to) <> 'friend' then raise exception 'you are not friends yet'; end if;
  select * into m from public.matches where matches.id = in_match;
  if not found or m.p1 <> me or m.status <> 'waiting' or m.code is null then raise exception 'that match is not open for invites'; end if;
  -- One open invite per pair: the newest match replaces the old ask.
  update public.match_invites i set status = 'declined' where i.from_user = me and i.to_user = in_to and i.status = 'sent';
  insert into public.match_invites (match_id, from_user, to_user) values (in_match, me, in_to) returning id into inv;
  return inv;
end;
$$;
revoke all on function public.invite_friend(uuid, uuid) from public, anon;
grant execute on function public.invite_friend(uuid, uuid) to authenticated;
