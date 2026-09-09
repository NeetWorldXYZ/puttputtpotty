import { useId } from 'react';

export type ProfileStatKind = 'throne' | 'ace' | 'match' | 'best' | 'rounds' | 'win';

/** Small collectible-style golf emblems, drawn in the game's navy-outline style. */
export function ProfileStatIcon({kind}: {kind: ProfileStatKind}) {
  const id = useId();
  const gold = `url(#${id}-gold)`;
  const pearl = `url(#${id}-pearl)`;
  const ball = <g><circle cx="48" cy="41" r="20" fill={pearl}/><g fill="#aec8d5" stroke="none"><circle cx="40" cy="31" r="2.5"/><circle cx="51" cy="29" r="2.5"/><circle cx="59" cy="37" r="2.5"/><circle cx="47" cy="40" r="2.5"/><circle cx="36" cy="43" r="2.5"/><circle cx="43" cy="52" r="2.5"/><circle cx="55" cy="49" r="2.5"/></g><path d="M36 30q5-7 14-6" fill="none" stroke="#fff" strokeWidth="3"/></g>;
  return <svg className="pf-stat-icon" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-gold`} x2=".3" y2="1"><stop stopColor="#fff3aa"/><stop offset=".5" stopColor="#ffda4c"/><stop offset="1" stopColor="#eaa524"/></linearGradient><linearGradient id={`${id}-pearl`} x2=".6" y2="1"><stop stopColor="#fffef5"/><stop offset=".6" stopColor="#edf6ff"/><stop offset="1" stopColor="#a8c7dc"/></linearGradient></defs>
    <ellipse cx="48" cy="84" rx="33" ry="6" fill="#001b2c" opacity=".6"/>
    <g stroke="#09283e" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      {kind==='throne'&&<><path d="M23 79l4-18h42l4 18" fill={gold}/><rect x="29" y="27" width="38" height="40" rx="8" fill={pearl}/><path d="M27 27l-5-17 17 7 9-13 9 13 17-7-5 17Z" fill={gold}/><path d="M21 57q27-16 54 0l-7 18H28Z" fill={pearl}/><ellipse cx="48" cy="58" rx="23" ry="9" fill="#fffdf0"/><ellipse cx="48" cy="58" rx="15" ry="5" fill="#50cce0" strokeWidth="2.5"/><path d="M36 36h23" stroke="#fff" strokeWidth="3"/></>}
      {kind==='ace'&&<><ellipse cx="48" cy="77" rx="31" ry="8" fill="#32bc76"/><path d="M42 56h12l-4 20h-4Z" fill={gold}/>{ball}<path d="M18 26l-6-5m64 5 6-5M48 12V6" stroke="#ffe17a" strokeWidth="3"/></>}
      {kind==='match'&&<><path d="M28 72L67 15M68 72L29 15" fill="none" stroke="#aecbd8" strokeWidth="7"/><path d="M60 26l8-12M36 26l-8-12" stroke={gold} strokeWidth="8"/><path d="M28 65l-12-4-5 9q4 10 19 9l7-10Z" fill="#56d4cc"/><path d="M68 65l12-4 5 9q-4 10-19 9l-7-10Z" fill="#ff9271"/><circle cx="48" cy="53" r="14" fill={gold}/><path d="M42 53l4 4 8-9" fill="none" stroke="#09283e" strokeWidth="3"/></>}
      {kind==='best'&&<><path d="M13 71q13-16 40-10t29 14q-8 15-42 10T13 71Z" fill="#43bd76"/><path d="M20 72q20-9 43 0" fill="none" stroke="#a1e77a" strokeWidth="3"/><ellipse cx="43" cy="72" rx="10" ry="4" fill="#09283e"/><path d="M43 71V12" stroke="#ebf5ed"/><path d="M45 13l29 13-29 12Z" fill="#ff715e"/><circle cx="67" cy="69" r="7" fill={pearl}/><path d="M18 38l4-8 4 8 8 3-8 3-4 8-4-8-8-3Z" fill={gold} strokeWidth="2"/></>}
      {kind==='rounds'&&<><path d="M28 20h43v61H25V25Z" fill="#74cfc5"/><path d="M22 16h43v60H22Z" fill={pearl}/><rect x="33" y="10" width="21" height="13" rx="4" fill={gold}/><path d="M31 34h24M31 44h24M31 54h13" stroke="#6b98ac" strokeWidth="3"/><circle cx="66" cy="66" r="18" fill={gold}/><path d="M58 66l6 6 11-13" fill="none" strokeWidth="4"/></>}
      {kind==='win'&&<><path d="M28 24H15v13q0 17 20 18m33-31h13v13q0 17-20 18" fill="none" stroke="#e8b33f" strokeWidth="7"/><path d="M44 55h8v17H40l-5 10h26l-5-10h-4" fill={gold}/><path d="M27 17h42l-4 27q-2 17-17 17T31 44Z" fill={gold}/><path d="M48 27l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#fff6cf" strokeWidth="2.5"/><path d="M33 24l2 16" stroke="#fff5bd" strokeWidth="3"/></>}
    </g>
  </svg>;
}
