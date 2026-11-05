-- Run on preview only. Creates a temporary match-up and rolls EVERYTHING back.
begin;
do $$
declare a uuid; b uuid; loc text:='ppp:'||substr(replace(gen_random_uuid()::text,'-',''),1,12); owner_id uuid; best int;
begin
 select id into a from auth.users order by created_at limit 1;
 select id into b from auth.users where id<>a order by created_at limit 1;
 if b is null then raise exception 'Create two preview players first';end if;
 insert into public.profiles(id) values(a),(b) on conflict do nothing;
 insert into public.locations(id,name,poi_type,lat,lng,theme,difficulty,status) values(loc,'Rollback test','toilets',42,-85,'castle','easy','live');
 insert into public.runs(user_id,location_id,strokes,score,par,hole_scores,elapsed_ms) values(a,loc,'[]',8,9,array[3,3,2],45000);
 insert into public.runs(user_id,location_id,strokes,score,par,hole_scores,elapsed_ms) values(b,loc,'[]',8,9,array[2,3,3],45000);
 select user_id into owner_id from public.throne_defenses where location_id=loc;
 if owner_id is distinct from a then raise exception 'Fresh equal time stole the throne';end if;
 insert into public.runs(user_id,location_id,strokes,score,par,hole_scores,elapsed_ms) values(b,loc,'[]',8,9,array[3,3,2],44999);
 select user_id into owner_id from public.throne_defenses where location_id=loc;
 if owner_id is distinct from b then raise exception 'Strictly faster tie should capture';end if;
 update public.throne_defenses set defended_at=now()-interval '48 hours' where location_id=loc;
 insert into public.runs(user_id,location_id,strokes,score,par,hole_scores,elapsed_ms) values(a,loc,'[]',8,9,array[3,3,2],60000);
 select user_id into owner_id from public.throne_defenses where location_id=loc;
 if owner_id is distinct from a then raise exception 'Older tie should capture';end if;
 update public.throne_defenses set defended_at=now()-interval '72 hours' where location_id=loc;
 insert into public.runs(user_id,location_id,strokes,score,par,hole_scores,elapsed_ms) values(b,loc,'[]',9,9,array[3,3,3],65000);
 select user_id into owner_id from public.throne_defenses where location_id=loc;
 select min(score) into best from public.runs where location_id=loc;
 if owner_id is distinct from b or best<>8 then raise exception '72-hour capture must preserve the 8';end if;
end $$;
rollback;
