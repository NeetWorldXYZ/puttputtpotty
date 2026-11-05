-- RLS does not constrain TRUNCATE; preview client roles need only explicitly granted reads.
revoke truncate,references,trigger on public.throne_defenses,public.activity_events,public.notification_preferences,public.push_devices,public.place_review_history,public.location_visits,public.token_wallets,public.wallet_ledger,public.remote_attempts,public.private_courses,public.private_course_members,public.private_course_runs,public.store_transactions,public.store_entitlements,public.store_revocations from public,anon,authenticated;

-- When friendship ends, an invitation must no longer grant private access.
create function public.remove_private_invites_on_unfriend() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.status='accepted' then return new;end if;
 delete from public.private_course_members m using public.private_courses c where m.course_id=c.id and ((m.user_id=old.a and c.owner_id=old.b) or (m.user_id=old.b and c.owner_id=old.a));
 return null;
end $$;
revoke all on function public.remove_private_invites_on_unfriend() from public,anon,authenticated;
create trigger remove_private_members after delete or update of status on public.friend_links for each row execute function public.remove_private_invites_on_unfriend();
