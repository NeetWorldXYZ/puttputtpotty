import { useId } from 'react';

export function HomeCrown() {
  return <svg viewBox="0 0 48 36" aria-hidden="true"><path d="m4 6 12 9 8-13 8 13 12-9-5 27H9Z" fill="#ffdc3c" stroke="#fff09a" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 28h28" stroke="#eaa321" strokeWidth="3"/></svg>;
}
export function HomeGear() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#f8fbff">{Array.from({length:8},(_,i)=><rect key={i} x="20" y="3" width="8" height="14" rx="2" transform={`rotate(${i*45} 24 24)`}/>)}<path fillRule="evenodd" d="M24 9a15 15 0 1 0 0 30 15 15 0 0 0 0-30Zm0 7a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z"/></g></svg>;
}
export function HomePodium() {
  const id = useId();
  return <svg className="kh-podium" viewBox="0 0 180 66" aria-hidden="true"><defs><linearGradient id={`${id}-g`} x2=".8" y2="1"><stop stopColor="#fff28c"/><stop offset=".6" stopColor="#ffd33e"/><stop offset="1" stopColor="#e99d16"/></linearGradient><linearGradient id={`${id}-s`} x2=".8" y2="1"><stop stopColor="#eff8ff"/><stop offset="1" stopColor="#799bbc"/></linearGradient><linearGradient id={`${id}-b`} x2=".8" y2="1"><stop stopColor="#ffd18e"/><stop offset="1" stopColor="#c16c2c"/></linearGradient></defs><g stroke="#061f35" strokeWidth="3" strokeLinejoin="round"><path d="m29 29 37-6 4 43H29Z" fill={`url(#${id}-s)`}/><path d="m112 24 39 9v33h-43Z" fill={`url(#${id}-b)`}/><path d="m67 11 22-4 25 5v54H67Z" fill={`url(#${id}-g)`}/></g><g fontFamily="Impact, sans-serif" fontWeight="900" textAnchor="middle" fill="#183347"><text x="48" y="58" fontSize="27">2</text><text x="90" y="48" fontSize="37">1</text><text x="132" y="59" fontSize="26">3</text></g><path d="m53 13-5-7m81 10 6-7M89 1v-7m-65 29-8-4m141 2 8-3" stroke="#ffe452" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}
export function HomePutters() {
  const id = useId();
  return <svg viewBox="0 0 96 104" aria-hidden="true"><defs><linearGradient id={id} x2=".9" y2="1"><stop stopColor="#fff"/><stop offset=".4" stopColor="#d8e9fc"/><stop offset=".7" stopColor="#849bb8"/><stop offset="1" stopColor="#f6faff"/></linearGradient></defs><g stroke="#061d35" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"><g transform="rotate(-43 48 51)"><path d="M48 14v68" strokeWidth="9"/><path d="M48 14v68" stroke={`url(#${id})`} strokeWidth="4"/><rect x="41" y="5" width="14" height="31" rx="4" fill={`url(#${id})`}/><path d="M45 78h25v14H45q-10 0-10-7t10-7Z" fill={`url(#${id})`}/></g><g transform="rotate(43 48 51)"><path d="M48 14v68" strokeWidth="9"/><path d="M48 14v68" stroke={`url(#${id})`} strokeWidth="4"/><rect x="41" y="5" width="14" height="31" rx="4" fill={`url(#${id})`}/><path d="M48 78H26v14h22q10 0 10-7t-10-7Z" fill={`url(#${id})`}/></g><circle cx="48" cy="86" r="12" fill={`url(#${id})`}/></g><g fill="#9bb3ca"><circle cx="45" cy="81" r="1.5"/><circle cx="53" cy="84" r="1.5"/><circle cx="47" cy="89" r="1.5"/><circle cx="41" cy="87" r="1.5"/><circle cx="52" cy="92" r="1.5"/></g></svg>;
}
