import { privateTemplates } from './privateTemplates.ts';
// All calls arrive after JWT verification. Privileged writes use the server client only.
export async function launchAction(body: any, user: any, db: any, engine: any): Promise<any | undefined> {
 const uid=user.id, action=body.action;
 const check=(r:any)=>{if(r.error)throw new Error(r.error.message);return r.data;};
 const rpc=async(name:string,args:any)=>check(await db.rpc(name,args));
 const isAdmin=async()=>check(await db.from('profiles').select('role').eq('id',uid).single()).role==='admin';
 const member=async(id:string)=>{
  const c=check(await db.from('private_courses').select('*').eq('id',id).maybeSingle());
  if(!c)throw new Error('Private course not found');
  if(c.owner_id!==uid&&!check(await db.from('private_course_members').select('user_id').eq('course_id',id).eq('user_id',uid).maybeSingle()))throw new Error('This course is invite-only');
  return c;
 };
 if(action==='launch-state') {
  const [wallet,events,prefs,entitlements,visits]=await Promise.all([
   db.from('token_wallets').select('balance').eq('user_id',uid).maybeSingle(),
   db.from('activity_events').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(50),
   db.from('notification_preferences').select('*').eq('user_id',uid).maybeSingle(),
   db.from('store_entitlements').select('product_id').eq('user_id',uid),
   db.from('location_visits').select('location_id,locations(id,name,poi_type,lat,lng,status)').eq('user_id',uid).limit(100)
  ]);
  return {balance:check(wallet)?.balance??0,events:check(events),preferences:check(prefs),entitlements:check(entitlements),visits:check(visits)?.filter((v:any)=>v.locations?.status==='live').map((v:any)=>v.locations),admin:await isAdmin()};
 }
 if(action==='activity-read') {
  if(typeof body.id!=='string')throw new Error('Choose a notification');
  check(await db.from('activity_events').update({read_at:new Date().toISOString()}).eq('user_id',uid).eq('id',body.id));return {ok:true};
 }
 if(action==='notification-preferences') {
  const patch:any={user_id:uid};
  for(const key of ['crowns','defenses','friends','daily','submissions','rewards'])if(typeof body[key]==='boolean')patch[key]=body[key];
  for(const key of ['quiet_start','quiet_end'])if(Number.isInteger(body[key])&&body[key]>=0&&body[key]<=23)patch[key]=body[key];
  if(typeof body.timezone==='string'){new Intl.DateTimeFormat('en',{timeZone:body.timezone});patch.timezone=body.timezone;}
  check(await db.from('notification_preferences').upsert(patch));return {ok:true};
 }
 if(action==='push-unregister'){
  if(typeof body.token==='string')check(await db.from('push_devices').delete().eq('user_id',uid).eq('token',body.token));
  return {ok:true};
 }
 if(action==='push-register'){
  if(!/^[a-fA-F0-9]{64}$/.test(body.token??''))throw new Error('Invalid push token');
  // Environment is a server deployment setting, never a client-controlled routing choice.
  check(await db.from('push_devices').upsert({user_id:uid,token:body.token,environment:Deno.env.get('APNS_ENVIRONMENT')==='production'?'production':'sandbox',updated_at:new Date().toISOString()}));return {ok:true};
 }
 if(action==='weekly-passes')return {awarded:await rpc('earn_weekly_passes',{p_user:uid})};
 if(action==='remote-start'){
  if(typeof body.locationId!=='string'||! /^[a-f0-9-]{36}$/.test(body.requestId??''))throw new Error('Invalid remote challenge');
  return {ok:true,...await rpc('start_remote_attempt',{p_user:uid,p_location:body.locationId,p_request:body.requestId})};
 }
 if(action==='my-submissions')return {items:check(await db.from('locations').select('id,name,status,review_note,created_at,access_type').eq('founded_by',uid).like('id','ppp:%').order('created_at',{ascending:false}).limit(100))};
 if(action==='launch-review-queue'){
  if(!await isAdmin())throw new Error('Admins only');
  return {items:check(await db.from('locations').select('id,name,poi_type,lat,lng,status,access_type,created_at,founded_by,reviewed_at').like('id','ppp:%').eq('status','pending').order('created_at',{ascending:false}).limit(100))};
 }
 if(action==='private-list'){
  const memberships=check(await db.from('private_course_members').select('course_id').eq('user_id',uid));
  const owned=check(await db.from('private_courses').select('id,name,theme,owner_id').eq('owner_id',uid));
  const joined=memberships.length?check(await db.from('private_courses').select('id,name,theme,owner_id').in('id',memberships.map((m:any)=>m.course_id))):[];
  return {courses:[...new Map([...owned,...joined].map((c:any)=>[c.id,c])).values()]};
 }
 if(action==='private-create'){
  const name=String(body.name??'').trim();if(name.length<2||name.length>40||engine.placeNameProblem(name))throw new Error('Choose a suitable course name (2–40 characters)');
  const {count,error}=await db.from('private_courses').select('id',{head:true,count:'exact'}).eq('owner_id',uid);if(error)throw error;if(count>=10)throw new Error('You can own up to 10 private courses');
  const id=crypto.randomUUID();const themes=['grandma','luxuryHotel','diveBar','haunted','spaceship','castle'];const theme=themes.includes(body.theme)?body.theme:'grandma';
  const holes=privateTemplates.map((_,i)=>({...privateTemplates[(parseInt(id.slice(0,4),16)+i)%3],id:id+'#'+(i+1),theme}));
  const course=check(await db.from('private_courses').insert({id,owner_id:uid,name,theme,holes}).select('id,name,theme,owner_id').single());return {course};
 }
 if(action==='private-invite'||action==='private-remove'){
  const c=await member(body.courseId);if(c.owner_id!==uid)throw new Error('Only the course owner can manage invitations');
  const friend=check(await db.from('profiles').select('id').eq('friend_code',String(body.friendCode??'').trim().toUpperCase()).maybeSingle());if(!friend||friend.id===uid)throw new Error('Enter your friend’s code');
  if(action==='private-remove'){check(await db.from('private_course_members').delete().eq('course_id',c.id).eq('user_id',friend.id));return {ok:true};}
  const [a,b]=[uid,friend.id].sort();const link=check(await db.from('friend_links').select('status').eq('a',a).eq('b',b).maybeSingle());if(link?.status!=='accepted')throw new Error('Add this player as a friend first');
  check(await db.from('private_course_members').upsert({course_id:c.id,user_id:friend.id}));
  check(await db.from('activity_events').upsert({user_id:friend.id,category:'friends',title:'Private course invitation',message:`You’re invited to ${c.name}. Open Friend Courses to play.`,event_key:`private:${c.id}:${friend.id}`},{onConflict:'user_id,event_key',ignoreDuplicates:true}));return {ok:true};
 }
 if(action==='private-course'){
  const course=await member(body.courseId);
  const rows=check(await db.from('private_course_runs').select('user_id,score,hole_scores,created_at,profiles(display_name,avatar)').eq('course_id',course.id).order('score').limit(50));return {course,rows};
 }
 if(action==='private-submit'){
  const c=await member(body.courseId);
  if(!/^[a-f0-9-]{36}$/.test(body.requestId??''))throw new Error('Invalid round');
  if(!Array.isArray(body.strokes)||body.strokes.length!==3||!body.strokes.every(engine.validStrokes))throw new Error('Finish all three holes');
  const prior=check(await db.from('private_course_runs').select('*').eq('request_id',body.requestId).maybeSingle());if(prior){if(prior.user_id!==uid||prior.course_id!==c.id)throw new Error('Invalid round');return {run:prior};}
  const scores=c.holes.map((h:any,i:number)=>{const s=engine.replay(h,0,body.strokes[i],engine.DEFAULT_PARAMS).state;if(!s.done)throw new Error('Finish every hole');return engine.holeScore(s,h.par);});
  return {run:check(await db.from('private_course_runs').insert({course_id:c.id,user_id:uid,score:scores.reduce((a:number,b:number)=>a+b,0),hole_scores:scores,strokes:body.strokes,request_id:body.requestId}).select('*').single())};
 }
 if(action==='store-verify'){
  if(user.is_anonymous)throw new Error('Save your account before purchasing');
  const {verifyApplePurchase}=await import('./store.ts');
  return await verifyApplePurchase(body.signedTransaction,uid,db);
 }
 return undefined;
}
