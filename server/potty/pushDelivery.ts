// Called only by the authenticated preview scheduler. APNs private keys stay on the server.
import {importPKCS8, SignJWT} from 'npm:jose@6.1.0';
const defaults:Record<string,boolean>={crowns:true,defenses:false,friends:true,daily:false,submissions:true,rewards:false};
export async function deliverPush(db:any){
 const env=(n:string)=>Deno.env.get(n);
 const pem=env('APNS_PRIVATE_KEY'),kid=env('APNS_KEY_ID'),team=env('APNS_TEAM_ID'),topic=env('APPLE_BUNDLE_ID');
 if(!pem||!kid||!team||!topic)throw new Error('Push delivery is not configured');
 const key=await importPKCS8(pem.replace(/\\n/g,'\n'),'ES256');const jwt=await new SignJWT({}).setProtectedHeader({alg:'ES256',kid}).setIssuer(team).setIssuedAt().sign(key);
 const check=(r:any)=>{if(r.error)throw r.error;return r.data;};
 const events=check(await db.rpc('lease_push_events'));let delivered=0;
 for(const e of events){
  const mark=async(patch:any)=>check(await db.from('activity_events').update(patch).eq('id',e.id));
  const prefs=check(await db.from('notification_preferences').select('*').eq('user_id',e.user_id).maybeSingle());
  if(!(prefs?.[e.category]??defaults[e.category])||e.read_at){await mark({push_status:'skipped'});continue;}
  const hr=Number(new Intl.DateTimeFormat('en-US',{timeZone:prefs?.timezone??'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  const from=prefs?.quiet_start??22,to=prefs?.quiet_end??8;
  if(from<to ? hr>=from&&hr<to : from!==to&&(hr>=from||hr<to)){await mark({push_lease_until:new Date(Date.now()+900000).toISOString()});continue;}
  const devices=check(await db.from('push_devices').select('token,environment').eq('user_id',e.user_id));
  let sent=false,retry=false;
  for(const device of devices){
   const host=device.environment==='production'?'api.push.apple.com':'api.sandbox.push.apple.com';
   const r=await fetch('https://'+host+'/3/device/'+device.token,{method:'POST',signal:AbortSignal.timeout(8000),headers:{authorization:'bearer '+jwt,'apns-topic':topic,'apns-push-type':'alert','apns-priority':'10','apns-collapse-id':String(e.location_id??e.match_id??e.id).slice(0,64)},body:JSON.stringify({aps:{alert:{title:e.title,body:e.message},sound:'default'},activity:e.id})});
   if(r.ok){sent=true;continue;} const error=await r.json().catch(()=>({}));
   if(r.status===410||error.reason==='BadDeviceToken')check(await db.from('push_devices').delete().eq('token',device.token).eq('user_id',e.user_id));else retry=true;
  }
  if(sent){await mark({push_status:'sent'});delivered++;}else if(!retry)await mark({push_status:'skipped'});else await mark({push_lease_until:new Date(Date.now()+300000).toISOString()});
 }
 return {delivered};
}
