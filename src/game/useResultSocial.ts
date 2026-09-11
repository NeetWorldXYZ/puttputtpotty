import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { api, type MatchRow } from '../net/api';
import { supabase } from '../net/supabase';

export const REACTIONS = ['GG', '🔥', '😂', '2 EZ', '👏'] as const;
type Reaction = typeof REACTIONS[number];
type Offer = { id:string; code:string; from:string };
export function useResultSocial(match:MatchRow, me:string, onEnter:(match:MatchRow)=>void) {
  const other=match.p1===me?match.p2:match.p1;
  const [online,setOnline]=useState(false),[connected,setConnected]=useState(false);
  const [reaction,setReaction]=useState<{text:Reaction;from:string;key:number}|null>(null);
  const [offer,setOffer]=useState<Offer|null>(null),[pending,setPending]=useState<MatchRow|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const channel=useRef<RealtimeChannel|null>(null),pendingRef=useRef<MatchRow|null>(null);
  const lock=useRef(false),lastReaction=useRef(0),alive=useRef(true),enterRef=useRef(onEnter);
  enterRef.current=onEnter;
  useEffect(()=>{
    alive.current=true;
    if(match.p2_bot||!other)return;
    const ch=supabase.channel(`result:${match.id}`,{config:{broadcast:{self:false},presence:{key:me}}});
    channel.current=ch;
    ch.on('broadcast',{event:'reaction'},({payload})=>{
      if(payload?.from!==other||!REACTIONS.includes(payload?.text))return;
      setReaction({text:payload.text,from:other,key:Date.now()});
    });
    ch.on('broadcast',{event:'rematch'},({payload})=>{
      if(!match.code)return;
      if(payload?.from!==other||typeof payload.id!=='string'||typeof payload.code!=='string'||!/^[A-Z0-9]{6}$/.test(payload.code))return;
      // When both players ask together, keep one deterministic invitation.
      if(pendingRef.current&&me<other)return;
      setOffer({id:payload.id,code:payload.code,from:other});
    });
    ch.on('broadcast',{event:'rematch-cancel'},({payload})=>{
      if(payload?.from===other)setOffer(prev=>prev?.id===payload.id?null:prev);
    });
    ch.on('presence',{event:'sync'},()=>setOnline(Object.keys(ch.presenceState()).includes(other)));
    ch.subscribe(status=>{setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void ch.track({user:me});});
    return ()=>{
      alive.current=false;channel.current=null;
      void supabase.removeChannel(ch);
      if(pendingRef.current)void api.cancelMatch(pendingRef.current.id).catch(()=>{});
    };
  },[match.id,match.code,match.p2_bot,me,other]);
  useEffect(()=>{if(!reaction)return;const t=setTimeout(()=>setReaction(null),2400);return()=>clearTimeout(t);},[reaction]);
  useEffect(()=>{
    if(!pending)return;
    let active=true,reading=false;
    const tick=async()=>{
      if(reading)return;reading=true;
      try{
        const next=await api.matchState(pending.id);
        if(!active)return;
        if(next.status==='playing'){
          pendingRef.current=null;setPending(null);
          if(next.p2!==other){setError('That invitation was joined by another player. Please create a new rematch.');return;}
          enterRef.current(next);
        }else if(next.status==='cancelled'){pendingRef.current=null;setPending(null);}
      }catch{if(active)setError('Could not check the rematch. Reconnecting…');}finally{reading=false;}
    };
    const timer=setInterval(()=>void tick(),2000);
    const repeat=setInterval(()=>{if(channel.current)void channel.current.send({type:'broadcast',event:'rematch',payload:{id:pending.id,code:pending.code,from:me}});},5000);
    void tick();return()=>{active=false;clearInterval(timer);clearInterval(repeat);};
  },[pending,me,other]);
  const sendReaction=async(text:Reaction)=>{
    if(Date.now()-lastReaction.current<350)return;
    lastReaction.current=Date.now();setReaction({text,from:me,key:Date.now()});
    if(channel.current&&connected){const status=await channel.current.send({type:'broadcast',event:'reaction',payload:{from:me,text}});if(status!=='ok')setError('Reaction could not be sent.');}
  };
  const cancel=async()=>{
    const old=pendingRef.current;if(!old)return;
    await api.cancelMatch(old.id);pendingRef.current=null;setPending(null);
    void channel.current?.send({type:'broadcast',event:'rematch-cancel',payload:{from:me,id:old.id}});
  };
  const rematch=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{
      if(!match.code||match.p2_bot){enterRef.current(await api.findMatch());return;}
      if(offer){
        await cancel();
        const joined=await api.joinInvite(offer.code);
        if(joined.id!==offer.id||joined.p1!==other)throw new Error('That invitation does not match your opponent.');
        setOffer(null);enterRef.current(joined);
      }else{
        const invite=await api.createInvite(match.holes);
        if(!alive.current){void api.cancelMatch(invite.id).catch(()=>{});return;}
        pendingRef.current=invite;setPending(invite);
        if(other&&me<other)setOffer(null);
        await channel.current?.send({type:'broadcast',event:'rematch',payload:{id:invite.id,code:invite.code,from:me}});
      }
    }catch(e){if(alive.current)setError((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}
  };
  return {online,connected,reaction,offer,pending,busy,error,sendReaction,rematch,cancel:()=>void cancel().catch(e=>setError((e as Error).message))};
}
