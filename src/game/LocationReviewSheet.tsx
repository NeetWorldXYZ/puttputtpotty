import { useEffect, useState } from 'react';
import { reviewLocation, reviewQueue, sendLocationReport, type LocationReport } from '../net/locationReviews';
import type { OsmPlace } from '../net/overpass';
import './LocationReviewSheet.css';

export function LocationReviewSheet({place,onClose}:{place:OsmPlace;onClose:(message?:string)=>void}) {
  const [reason,setReason]=useState('closed');
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function send(){setBusy(true);setError('');try{await sendLocationReport(place.id,place.name,reason,details);onClose('Thanks! Your correction is waiting for review.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="overlay"><section className="card location-review" role="dialog" aria-modal="true" aria-label="Report this location">
    <h2>Keep the map on course</h2><p>{place.name}</p>
    <label>What needs fixing?<select value={reason} onChange={e=>setReason(e.target.value)}>
      <option value="closed">Permanently closed</option><option value="name">Wrong business name</option><option value="duplicate">Duplicate pin</option><option value="no_bathroom">No accessible bathroom</option><option value="other">Something else</option>
    </select></label>
    <label>Details or correct name<textarea maxLength={300} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Tell us what changed…"/></label>
    <p className="review-note">Reports are reviewed before changing the map. Scores and crowns stay in the history.</p>
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={busy || (reason==='name' && details.trim().length<2)} onClick={()=>void send()}>{busy?'Sending…':'Send correction'}</button>
    <button disabled={busy} onClick={()=>onClose()}>Cancel</button>
  </section></div>;
}
function ReviewItem({report,onDone}:{report:LocationReport;onDone:()=>void}) {
  const [name,setName]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function decide(decision:string){setBusy(true);setError('');try{await reviewLocation(report.id,decision,name);onDone();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <article><strong>{report.location_name}</strong><p>{report.reason.replace('_',' ')} · {report.details || 'No extra details'}</p><small>{report.location_id}</small>
    <label>Correct name<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
    <div className="review-actions"><button disabled={busy||!name.trim()} onClick={()=>void decide('rename')}>Rename</button><button disabled={busy} onClick={()=>void decide('hide')}>Hide pin</button><button disabled={busy} onClick={()=>void decide('restore')}>Restore pin</button><button disabled={busy} onClick={()=>void decide('dismiss')}>Dismiss</button></div>{error&&<p role="alert">{error}</p>}
  </article>;
}
export function LocationReviewQueue({onClose}:{onClose:()=>void}) {
  const [rows,setRows]=useState<LocationReport[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  async function load(){setError('');try{setRows(await reviewQueue());}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  return <div className="overlay"><section className="card location-review" role="dialog" aria-modal="true" aria-label="Location review queue"><h2>Map clubhouse</h2><p>Review corrections. Hiding a pin preserves its course and achievements.</p>{error&&<p role="alert">{error}</p>}{loading?<p>Loading…</p>:rows.length===0&&!error?<p>No pending corrections.</p>:rows.map(r=><ReviewItem key={r.id} report={r} onDone={()=>void load()}/>)}<button onClick={onClose}>Done</button></section></div>;
}
