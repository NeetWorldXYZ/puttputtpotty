import { useEffect, useState } from 'react';
import { api, fmtElapsed, type PlayerProfile, type FriendRelation } from '../net/api';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { GameIcon } from './GameIcon';
import { ProfileStatIcon } from './ProfileStatIcon';

export function ProfileStage() {
  return <svg className="pf-stage" viewBox="0 0 220 210" aria-hidden="true">
    <path d="M17 168Q110 139 203 168L195 191Q110 221 25 191Z" fill="#9b7546" stroke="#08283d" strokeWidth="5"/>
    <path d="M46 180v18m35-11v16m46-16v16m39-23v17" stroke="#65492e" strokeWidth="5"/>
    <ellipse cx="110" cy="168" rx="96" ry="27" fill="#6dbd58" stroke="#08283d" strokeWidth="5"/>
    <ellipse cx="110" cy="166" rx="70" ry="17" fill="#a0d65c"/>
    <path d="M181 156V36" stroke="#08283d" strokeWidth="8" strokeLinecap="round"/><path d="M181 38l34 16-34 18Z" fill="#ff674f" stroke="#08283d" strokeWidth="4"/>
    <path d="M29 164l-9-9 4-9 15-4 10 12Z" fill="#9bb8bb" stroke="#08283d" strokeWidth="3"/>
    <path d="M166 161v-32q12-9 26 0v32q-13 8-26 0Z" fill="#fff6df" stroke="#08283d" strokeWidth="4"/>
    <ellipse cx="179" cy="128" rx="13" ry="5" fill="#d3ddd5" stroke="#08283d" strokeWidth="3"/>
    <ellipse cx="179" cy="128" rx="4" ry="2" fill="#08283d"/>
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
