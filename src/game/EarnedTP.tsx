import {useEffect,useState} from 'react';
import {api} from '../net/api';
import './EarnedTP.css';

/** Show only the server's award for this exact round, never the profile balance. */
export function EarnedTP({context,pending=false}:{context:string|null;pending?:boolean}) {
  const [reward,setReward]=useState<{points:number;items:{reason:string;points:number}[]}|null>(null);
  const [error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;setReward(null);setError(false);
    if(context&&!pending)void api.gameplayReward(context).then(r=>{if(active)setReward(r);}).catch(()=>{if(active)setError(true);});
    return()=>{active=false;};
  },[context,pending,retry]);
  return <div className="earned-tp" role="status">
    <svg viewBox="0 0 56 48" aria-hidden="true"><path d="m6 11 12 10L28 4l10 17 12-10-5 30H11Z" fill="#ffda48" stroke="#b77c21" strokeWidth="2"/><path d="M12 44h32" stroke="#e7aa31" strokeWidth="4"/></svg>
    <div><strong>{reward?`+${reward.points} TP`:pending?'Saving round…':error?'TP unavailable':'Checking TP…'}</strong>
      <small>{reward?'Earned this round':'Waiting for verified rewards'}</small>
      {reward&&reward.items.length>0&&<small>{reward.items.map(i=>`${i.reason} +${i.points}`).join(' · ')}</small>}
      {error&&<button onClick={()=>setRetry(n=>n+1)}>Retry</button>}
    </div>
  </div>;
}
