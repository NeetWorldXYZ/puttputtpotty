import { useEffect, useRef, useState } from 'react';
import { api } from '../net/api';
import { CARTS, cartSvg, type CartGarage as Garage } from './carts';
import './CartGarage.css';
export function CartGarage({onClose,onEquip}:{onClose:()=>void;onEquip:(id:string)=>void}) {
 const [garage,setGarage]=useState<Garage|null>(null),[preview,setPreview]=useState('starter'),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeRef.current?.focus();return()=>previous?.focus();},[]);
 const load=()=>{setError('');api.cartGarage().then(g=>{setGarage(g);setPreview(g.selected)}).catch(()=>setError('Your garage could not be loaded. Try again.'));};
 useEffect(load,[]);
 const chosen=CARTS.find(c=>c.id===preview)??CARTS[0],owned=garage?.unlocked.includes(preview);
 const equip=async()=>{if(!owned||saving)return;setSaving(true);setError('');try{const g=await api.cartGarage(preview);setGarage(g);onEquip(g.selected);}catch(e){setError(e instanceof Error?e.message:'Could not save your cart.');}finally{setSaving(false);}};
 return <div className="cart-garage-backdrop" onKeyDown={e=>{
  if(e.key==='Escape'&&!saving)onClose();
  if(e.key==='Tab'){const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
 }}><section className="cart-garage" role="dialog" aria-modal="true" aria-labelledby="garage-title">
 <header><div><small>PUTT PUTT POTTY</small><h2 id="garage-title">YOUR GARAGE</h2></div><button ref={closeRef} onClick={onClose} disabled={saving} aria-label="Close garage">×</button></header>
 <div className="cart-showroom"><div dangerouslySetInnerHTML={{__html:cartSvg(preview)}}/><strong>{chosen.name}</strong><span>{owned?'Your ride. Your reign.':chosen.rule}</span></div>
 {!garage&&!error&&<p role="status">Opening your garage…</p>}
 {error&&<p className="cart-error" role="alert">{error} {!garage&&<button onClick={load}>Retry</button>}</p>}
 <div className="cart-grid">{CARTS.map(c=>{const unlocked=garage?.unlocked.includes(c.id),progress=garage?.stats[c.metric]??0;return <button key={c.id} className={preview===c.id?'chosen':''} onClick={()=>setPreview(c.id)} aria-pressed={preview===c.id} aria-label={`${c.name}, ${unlocked?'unlocked':c.rule}`}>
 <div className={!unlocked?'cart-art locked':'cart-art'} dangerouslySetInnerHTML={{__html:cartSvg(c.id)}}/><strong>{c.name}</strong><span>{!garage?'Checking…':unlocked?(garage.selected===c.id?'EQUIPPED':'UNLOCKED'):`LOCKED · ${Math.min(progress,c.target)} / ${c.target}`}</span>{!unlocked&&<small>{c.rule}</small>}
 </button>})}</div>
 <footer><p>Earn it once. Keep it forever. No TP spent.</p><button disabled={!owned||saving||garage?.selected===preview} onClick={()=>void equip()}>{saving?'Saving your ride…':garage?.selected===preview?'Equipped':owned?'Equip this cart':'Keep playing to unlock'}</button></footer>
 </section></div>;
}
