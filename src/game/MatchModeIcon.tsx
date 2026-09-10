import { useId } from 'react';

/** A matched set of shaded, navy-outlined golf emblems for the lobby. */
export function MatchModeIcon({ kind }: { kind: 'daily' | 'friend' | 'custom' }) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  return <svg className="mc-mode-icon" viewBox="0 0 160 128" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-gold`} x2=".3" y2="1"><stop stopColor="#fff5b5"/><stop offset=".5" stopColor="#ffda47"/><stop offset="1" stopColor="#db8c16"/></linearGradient>
      <linearGradient id={`${id}-blue`} x2=".6" y2="1"><stop stopColor="#78edff"/><stop offset=".45" stopColor="#14b8f5"/><stop offset="1" stopColor="#0768b3"/></linearGradient>
      <linearGradient id={`${id}-red`} x2=".4" y2="1"><stop stopColor="#ffbdad"/><stop offset=".45" stopColor="#ff527a"/><stop offset="1" stopColor="#b81d59"/></linearGradient>
      <linearGradient id={`${id}-paper`} x2=".6" y2="1"><stop stopColor="#ffffff"/><stop offset=".6" stopColor="#f5f7dc"/><stop offset="1" stopColor="#abc6d6"/></linearGradient>
      <linearGradient id={`${id}-skin`} x2=".3" y2="1"><stop stopColor="#fff9e5"/><stop offset="1" stopColor="#efc589"/></linearGradient>
    </defs>
    <ellipse cx="80" cy="117" rx="62" ry="7" fill="#001a30" opacity=".35"/>
    <g stroke="#06243b" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round">
      {kind === 'daily' && <>
        <g transform="rotate(-7 70 66)">
          <rect x="24" y="23" width="91" height="88" rx="12" fill="#1777a5"/>
          <rect x="20" y="16" width="91" height="88" rx="12" fill={paint('paper')}/>
          <path d="M22 42V28q0-10 10-10h67q10 0 10 10v14Z" fill={paint('red')}/>
          <path d="M39 10v20m52-20v20" strokeWidth="7"/>
          <path d="M39 12v13m52-13v13" stroke="#add8e6" strokeWidth="2"/>
          <path d="M32 53h31M32 64h19M32 77h15" stroke="#8aadb9" strokeWidth="3"/>
        </g>
        <path d="M88 59H76v13q0 14 17 14m33-27h13v13q0 14-17 14" fill="none" stroke="#daa130" strokeWidth="6"/>
        <path d="M102 87v16H91l-5 10h42l-5-10h-12V87" fill={paint('gold')}/>
        <path d="M87 52h41l-4 27q-2 16-17 16T91 79Z" fill={paint('gold')}/>
        <path d="m107 60 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#fff6c1" strokeWidth="2"/>
        <path d="M94 59l2 15" stroke="#fff9cf" strokeWidth="3"/>
        <path d="m132 26 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill={paint('gold')} strokeWidth="2"/>
      </>}
      {kind === 'friend' && <>
        <path d="M12 112q1-28 32-28t34 28Z" fill={paint('blue')}/>
        <path d="M82 112q1-28 33-28t33 28Z" fill={paint('red')}/>
        <g transform="rotate(-8 44 59)">
          <circle cx="44" cy="60" r="28" fill={paint('skin')}/>
          <path d="M15 52q-4-35 30-35 24 0 30 23L25 58Z" fill={paint('blue')}/>
          <path d="m24 47 47-15 10 7-53 15Z" fill="#008dd3"/>
          <path d="M24 34q7-13 21-11" fill="none" stroke="#b5f4ff" strokeWidth="3"/>
          <path d="M35 61v3m19-3v3m-21 11q11 10 22-1" fill="none" strokeWidth="3.5"/>
        </g>
        <g transform="rotate(8 116 59)">
          <circle cx="116" cy="60" r="28" fill={paint('skin')}/>
          <path d="M86 40q6-23 29-23 34 0 30 35l-10 6Z" fill={paint('red')}/>
          <path d="m88 32-10 7 54 15 4-7Z" fill="#d72b64"/>
          <path d="M107 24q15-4 25 10" fill="none" stroke="#ffd4cf" strokeWidth="3"/>
          <path d="M106 61v3m19-3v3m-21 10q11 11 22 0" fill="none" strokeWidth="3.5"/>
        </g>
        <path d="m62 110 31-26m5 26L67 84" stroke="#bddfe9" strokeWidth="5"/>
        <path d="m61 111-7-8-8 4 9 9Zm38 0 7-8 8 4-9 9Z" fill={paint('gold')} strokeWidth="3"/>
        <path d="M80 7v9m-11-4 3 6m19-6-3 6" stroke="#ffe877" strokeWidth="3"/>
      </>}
      {kind === 'custom' && <>
        <g transform="rotate(-9 70 68)">
          <rect x="29" y="19" width="79" height="92" rx="9" fill="#107692"/>
          <rect x="24" y="13" width="79" height="92" rx="9" fill={paint('paper')}/>
          <path d="M40 7v15m23-15v15m23-15v15" strokeWidth="6"/>
          <path d="M37 42h51M37 54h51M37 66h51M37 78h51M37 90h51" stroke="#9bccc5" strokeWidth="2"/>
          <path d="M37 86q-6-14 9-24t30-5q19 2 9 16T62 86Z" fill="#57cfa6" strokeWidth="2.5"/>
          <ellipse cx="68" cy="74" rx="8" ry="3" fill="#06243b" stroke="none"/>
          <path d="M68 73V46l17 8-17 6" fill={paint('red')} strokeWidth="3"/>
        </g>
        <g transform="rotate(33 116 62)">
          <path d="M107 24h18v61l-9 20-9-20Z" fill={paint('gold')}/>
          <path d="M107 24v-8q9-10 18 0v8Z" fill={paint('red')}/>
          <path d="M107 27h18v8h-18Z" fill={paint('paper')} strokeWidth="2.5"/>
          <path d="m108 86 8 17 8-17" fill="#ffe5b4" strokeWidth="2.5"/>
          <path d="m113 97 3 8 3-8Z" fill="#06243b" stroke="none"/>
          <path d="M112 40v38" stroke="#fff5b6" strokeWidth="2"/>
        </g>
      </>}
    </g>
  </svg>;
}
