import { useEffect, useState } from 'react';
import { api, fmtElapsed, type KingRow, type DailyRow } from '../net/api';
import { currentUserId } from '../net/supabase';
import { recallFix } from '../net/places';
import { dailySeed, dailyEdition, secondsUntilNextDaily } from './courses';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { ProfileStatIcon } from './ProfileStatIcon';
import { AccountSheet } from './AccountSheet';
import { MenuVolume } from './MenuControls';
import { TabBar } from './TabBar';
import './Ranks.css';

type Tab = 'nearby' | 'friends' | 'world' | 'daily';
const tabs: [Tab,string][] = [['nearby','Nearby'],['friends','Friends'],['world','Global'],['daily','Daily']];
type RankRow = {user_id:string;display_name:string;avatar:KingRow['avatar'];thrones?:number;aces?:number;total?:number;elapsed_ms?:number};
const captions = {nearby:'Beat a bathroom’s course record to claim it.',friends:'Your friends. Same game. Bigger bragging rights.',world:'Claim your place among the world’s throne holders.',daily:'Same nine holes. A new shot at glory.'};

export function LeaderboardScreen() {
  const [tab,setTab]=useState<Tab>(()=>recallFix()?'nearby':'world');
  const [rows,setRows]=useState<RankRow[]|null>(null);
  const [error,setError]=useState('');
  const [me,setMe]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  const [radius,setRadius]=useState(50);
  const [retry,setRetry]=useState(0);
  const [friendsOpen,setFriendsOpen]=useState(false);
  const [friendCount,setFriendCount]=useState(0);
  const [clock,setClock]=useState(()=>secondsUntilNextDaily());
  const [seed,setSeed]=useState(()=>dailySeed());
  const [updated,setUpdated]=useState('');
  const fix=recallFix();
  useEffect(()=>{void currentUserId().then(setMe).finally(()=>setReady(true));},[]);
  useEffect(()=>{const t=window.setInterval(()=>{setClock(secondsUntilNextDaily());setSeed(dailySeed());},1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    let cancelled=false;
    setRows(null);setError('');
    if(!ready)return;
    async function fetchBoard():Promise<RankRow[]> {
      if(tab==='daily') return api.leaderboard(seed);
      if(tab==='nearby') return fix?api.kings({lat:fix.lat,lng:fix.lng,radiusM:radius*1609.344}):[];
      if(tab==='world') return api.kings();
      if(!me)return [];
      const friends=(await api.friends()).filter(f=>f.relation==='friend');
      if(!cancelled)setFriendCount(friends.length);
      // Fetch actual friend profiles, not a filtered global top-50 board.
      const ids=[...new Set([me,...friends.map(f=>f.user_id)])];
      const out:RankRow[]=[];
      let next=0;
      await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{
        while(next<ids.length&&!cancelled){
          const p=await api.profile(ids[next++]);
          if(p)out.push({user_id:p.id,display_name:p.name,avatar:p.avatar,thrones:p.thrones,aces:p.aces});
        }
      }));
      return out.sort((a,b)=>(b.thrones??0)-(a.thrones??0)||(b.aces??0)-(a.aces??0)||a.display_name.localeCompare(b.display_name));
    }
    void fetchBoard().then(r=>{if(!cancelled){setRows(r);setUpdated(new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));}}).catch(()=>{if(!cancelled)setError('Couldn’t load these rankings. Please try again.');});
    return()=>{cancelled=true;};
  },[tab,radius,retry,me,ready,seed,fix?.lat,fix?.lng]);
  const myRank=rows?.findIndex(r=>r.user_id===me)??-1;
  const play=()=>navigate('play',seed);
  function findMe(){if(myRank>=0)document.getElementById('rk-you')?.scrollIntoView({block:'nearest',behavior:'smooth'});else navigate('profile');}
  return <div className={'leaders ranks-screen rk-'+tab}>
    <main className="rk-content">
      <header className="rk-hero">
        <div className="rk-tools"><MenuVolume/><button onClick={()=>tab==='friends'?setFriendsOpen(true):tab==='nearby'?navigate('map'):tab==='daily'?play():findMe()}>{tab==='friends'?'Invite friends':tab==='nearby'?'Open map':tab==='daily'?'Play daily':'My rank'} →</button></div>
        <img className="rk-header-art" src={'/art/ranks-'+tab+'.webp'} alt="" />
        <div className="rk-art-space" aria-hidden="true"/>
        <h1>CHASE <em>THE</em> CROWN</h1>
        <strong className="rk-subtitle">{tab==='daily'?'RANKED BY TODAY’S SCORE':'RANKED BY THRONES HELD'}</strong>
        <p>{captions[tab]}</p>
      </header>
      <nav className="rk-tabs" aria-label="Ranking categories">{tabs.map(([key,label])=><button key={key} aria-pressed={key===tab} onClick={()=>setTab(key)}>{label}</button>)}</nav>
      {tab==='nearby'&&<div className="rk-strip"><span>{fix?'Thrones within ~'+radius+' miles':'Find the throne holders near you'}</span>{fix?<label><span className="rk-sr">Change radius</span><select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} miles</option>)}</select></label>:<button onClick={()=>navigate('map')}>Set location →</button>}</div>}
      {tab==='daily'&&<button className="rk-course" onClick={play}><img src="/art/daily-card.webp" alt=""/><span><small>Today’s course · {dailyEdition(seed)}</small><strong>The Daily Nine</strong><small>9 holes · same course for everyone</small></span><b>›</b></button>}
      {tab==='daily'&&<div className="rk-column-labels"><span>PLAYER</span><span>STROKES</span><span>TIME</span></div>}
      <section className="rk-board" aria-label={tabs.find(t=>t[0]===tab)?.[1]+' rankings'} aria-busy={!rows&&!error}>
        {error?<div className="rk-empty" role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:!rows?<div className="rk-empty" role="status">Getting the latest scores…</div>:rows.length===0?<div className="rk-empty"><ProfileStatIcon kind="throne"/><strong>{tab==='nearby'&&!fix?'Your local legends are waiting':tab==='friends'?'Build your golf crew':'The crown is up for grabs'}</strong><p>{tab==='nearby'&&!fix?'Open the map to set your location.':tab==='friends'?'Add friends to compare your kingdoms.':tab==='daily'?'Be the first to finish this daily course.':'No claimed thrones on this board yet.'}</p><button onClick={()=>tab==='daily'?play():tab==='friends'?setFriendsOpen(true):navigate('map')}>{tab==='daily'?'Play daily':tab==='friends'?'Find friends':'Open map'} →</button></div>:<ol>{rows.map((r,i)=><li key={r.user_id} id={r.user_id===me?'rk-you':undefined} className={(r.user_id===me?'rk-mine ':'')+'rk-place-'+(i+1)}>
          <span className="rk-number">{i+1}</span><Avatar av={r.avatar} size={32}/>
          <button className="rk-player" onClick={()=>navigate('profile',null,null,{user:r.user_id})}>{r.display_name}{r.user_id===me&&<small> · you</small>}</button>
          {tab==='daily'?<><strong className="rk-score">{(r as DailyRow).total}</strong><span className="rk-time">{r.elapsed_ms!=null?fmtElapsed(r.elapsed_ms):'–'}</span></>:<span className="rk-tally"><strong><ProfileStatIcon kind="throne"/>{r.thrones}</strong><small>{r.aces??0} aces</small></span>}
        </li>)}</ol>}
      </section>
      <footer className="rk-footer">
        {tab==='nearby'?<><span>Find your next crown.<small>Explore bathrooms on the map.</small></span><button onClick={()=>navigate('map')}>View map</button></>:tab==='friends'?<><span>{friendCount} {friendCount===1?'friend':'friends'}<small>Thrones first · aces break ties</small></span><button onClick={()=>setFriendsOpen(true)}>Invite friends</button></>:tab==='daily'?<><ProfileStatIcon kind="best"/><span>Next daily in <b>{Math.floor(clock/3600)}h {Math.floor(clock%3600/60)}m {clock%60}s</b><small>New courses at noon & midnight Eastern</small></span></>:<><ProfileStatIcon kind="win"/><span>Global throne holders<small>{rows?'Top '+rows.length+' shown · updated '+updated:'The world is your course.'}</small></span><button onClick={findMe}>{myRank>=0?'You · #'+(myRank+1):'My profile'}</button></>}
      </footer>
    </main>
    {friendsOpen&&<AccountSheet initialMode="friends" onClose={()=>{setFriendsOpen(false);setRetry(n=>n+1);}}/>}
    <TabBar active="leaders"/>
  </div>;
}
