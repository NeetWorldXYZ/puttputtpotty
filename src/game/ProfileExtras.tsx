import { useEffect, useState } from 'react';
import { api, fmtElapsed, type PlayerProfile, type FriendRelation } from '../net/api';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { GameIcon } from './GameIcon';
import { ProfileStatIcon } from './ProfileStatIcon';

export function ProfileStage() {
  return <svg className="pf-stage" viewBox="0 0 220 210" aria-hidden="true">
    {/* An open patch of course turf: no raised rim or wooden pedestal. */}
    <path d="M15 188q8-18 36-20l99-9q43-3 61 18l-5 17q-23 14-76 13l-71-1q-34-2-44-18Z" fill="#032f32" opacity=".2"/>
    <path d="m12 181 8-10-2-10 12 5q13-13 36-10l31 6 36-10q28-7 51 7l10-8 1 14 13 8-4 13 6 7-17 1q-25 14-60 10l-31-4-25 5q-29-1-43-11l-17 1 4-8Z" fill="#27874d" stroke="#08283d" strokeWidth="3" strokeLinejoin="round"/>
    <path d="M30 179q8-17 34-14l34 6 32-11q27-8 48 4 18 11 11 20-9 10-36 11l-51-4-28 7q-37-1-44-19Z" fill="#80c94d"/>
    <path d="m46 168 14-3 57 26-15 0-7 2Zm38 0 14 3 12-4 53 26-15 1Zm43-7 10-3 48 22q-1 5-6 7Z" fill="#a9dd69" opacity=".65"/>
    <path d="m27 183-6-6m6 6 1-10m24 23-4-7m4 7 5-7m122 8 3-7m-3 7 9-3m13-16 3-8" fill="none" stroke="#b0df72" strokeWidth="2.5" strokeLinecap="round"/>
    <ellipse cx="108" cy="180" rx="48" ry="9" fill="#164b38" opacity=".22"/>
    {/* A visible cup and red flag make the setting unmistakably golf. */}
    <ellipse cx="180" cy="173" rx="14" ry="7" fill="#e1f5a3"/>
    <ellipse cx="180" cy="172" rx="10" ry="4.5" fill="#08283d"/>
    <path d="M180 171V45" stroke="#08283d" strokeWidth="7" strokeLinecap="round"/>
    <path d="M180 169V47" stroke="#fff2d2" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M181 48q14-3 30 10l-30 17Z" fill="#ff674f" stroke="#08283d" strokeWidth="3.5" strokeLinejoin="round"/>
    <path d="m185 53 15 5-15 8Z" fill="#ff9e72"/>
    {/* A small roll keeps the bathroom theme, tucked into the rough. */}
    <path d="M25 174v-21q10-7 20 0v21q-10 7-20 0Z" fill="#fff6df" stroke="#08283d" strokeWidth="3"/>
    <path d="M39 158v16q8 8 18 3l-4 9q-17 4-19-10v-18" fill="#fff6df" stroke="#08283d" strokeWidth="3" strokeLinejoin="round"/>
    <ellipse cx="35" cy="153" rx="10" ry="4" fill="#e8e7d4" stroke="#08283d" strokeWidth="3"/>
    <ellipse cx="35" cy="153" rx="3.5" ry="1.5" fill="#08283d"/>
  </svg>;
}
export function ProfileCareer({p}:{p:PlayerProfile}) {
  const stats=[['best',p.best_rel===null?'–':p.best_rel>0?`+${p.best_rel}`:p.best_rel===0?'E':p.best_rel,'Best 9 holes'],['rounds',p.runs,'Rounds played'],['win',p.matches?`${Math.round(p.matches_won/p.matches*100)}%`:'–','Win rate'],['throne',p.thrones,'Thrones held']] as const;
  return <section className="pf-panel pf-career"><h2>Career stats</h2><div className="pf-career-grid">{stats.map(([icon,value,label])=><div key={label}><ProfileStatIcon kind={icon}/><strong>{value}</strong><small>{label}</small></div>)}</div></section>;
}
export function PublicProfileExtras({p,me,onFriends}:{p:PlayerProfile;me:string|null;onFriends:()=>void}) {
  const [own,setOwn]=useState<PlayerProfile|null>(null);
  const [relation,setRelation]=useState<FriendRelation|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{let live=true;setOwn(null);setRelation(me ? null : 'none');setError('');
    if(me) {void api.profile(me).then(x=>{if(live)setOwn(x);}).catch(()=>{});void api.friendLookup(p.name).then(rows=>{if(live)setRelation(rows.find(r=>r.user_id===p.id)?.relation??'none');}).catch(()=>{});}
    return()=>{live=false;};
  },[p.id,me,p.name]);
  async function add(){setBusy(true);setError('');try{setRelation(relation==='incoming'?await api.friendRespond(p.id,true):await api.friendRequest(p.id));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function challenge(){if(relation!=='friend'){onFriends();return;}setBusy(true);setError('');try{const match=await api.createInvite(9);await api.inviteFriend(p.id,match.id);navigate('match',null,null,{match:match.id});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <>
    <div className="pf-public-actions"><button disabled={busy||relation===null||relation==='outgoing'||relation==='blocked'} onClick={()=>relation==='friend'?onFriends():void add()}>{relation==='friend'?'✓ Friends':relation==='incoming'?'Accept friend':relation==='outgoing'?'Request sent':relation==='blocked'?'Unavailable':'Add friend'}</button><button className="primary" disabled={busy} onClick={()=>void challenge()}>{busy?'Please wait…':relation==='friend'?'Challenge · 9 holes':'Invite to play'}</button></div>
    {error&&<p className="pf-note" role="alert">{error}</p>}
    <section className="pf-panel"><h2><GameIcon kind="crown"/>Thrones currently ruled <span>{p.thrones}</span></h2>
      {p.throne_list.length===0?<p className="pf-note">No thrones held yet. Every reign starts somewhere.</p>:<div className="pf-showcase">{p.throne_list.slice(0,3).map(t=><div className="pf-place-card" key={t.location_id}><div className="pf-place-art" aria-hidden="true"><GameIcon kind="crown"/></div><strong>{t.name}</strong><small>{t.score} strokes · par {t.par}{t.elapsed_ms!==null?` · ${fmtElapsed(t.elapsed_ms)}`:''}</small></div>)}</div>}
    </section>
    <ProfileCareer p={p}/>
    <section className="pf-panel"><h2>Head to head</h2><p className="pf-note">Career comparison · you vs. {p.name}</p>{own?<><div className="pf-versus"><Avatar av={own.avatar} size={44}/><span>{own.name}<b>VS</b>{p.name}</span><Avatar av={p.avatar} size={44}/></div><div className="pf-comparison">{[['Thrones',own.thrones,p.thrones],['Aces',own.aces,p.aces],['Rounds',own.runs,p.runs],['Match wins',own.matches_won,p.matches_won]].map(([label,a,b])=><div key={label}><strong>{a} <em>vs</em> {b}</strong><small>{label}</small></div>)}</div></>:<p className="pf-note">Your comparison is unavailable right now.</p>}<button className="pf-cta" disabled={busy} onClick={()=>void challenge()}>Play a round together →</button></section>
  </>;
}
