import { useId } from 'react';

/** Shared by ranked and friend results. Keep art independent of device emoji fonts. */
export function ResultReaction({ index }: { index: number }) {
  const id = `reaction-${useId().replace(/:/g, '')}`;
  if (index === 0 || index === 3) return <span className="mr-reaction-word">{index === 0 ? 'GG' : '2 EZ'}</span>;
  return <svg viewBox="0 0 80 80" aria-hidden="true" className="mr-reaction-art">
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.4" y2="1">
        <stop stopColor="#fff093"/><stop offset=".42" stopColor="#ffd345"/><stop offset="1" stopColor="#f69a1b"/>
      </linearGradient>
      <linearGradient id={`${id}-fire`} x1="0" y1="0" x2="0.3" y2="1">
        <stop stopColor="#ffdb58"/><stop offset=".4" stopColor="#ff7a24"/><stop offset="1" stopColor="#eb293b"/>
      </linearGradient>
      <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0.4" y2="1">
        <stop stopColor="#c6f7ff"/><stop offset=".42" stopColor="#4ad9ff"/><stop offset="1" stopColor="#1396e1"/>
      </linearGradient>
      <linearGradient id={`${id}-hand`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff1b5"/><stop offset=".4" stopColor="#ffcf73"/><stop offset="1" stopColor="#e99438"/>
      </linearGradient>
    </defs>
    <g stroke="#35233a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {index === 1 ? <>
        <path d="M40 5c4 14-10 20-9 30-5-4-8-10-7-17C5 34 10 52 16 61c6 10 15 14 25 14 19 0 29-13 28-28-1-10-6-18-13-24 1 11-2 17-7 19 6-16 2-28-9-37Z" fill={`url(#${id}-fire)`}/>
        <path d="M39 30c3 13-7 17-10 25-1-4-3-6-5-8-5 13 1 25 16 25 13 0 20-13 15-24-1 5-4 8-7 9 3-12-2-19-9-27Z" fill={`url(#${id}-gold)`} stroke="none"/>
        <path d="M40 50c1 6-6 9-5 15 1 6 11 6 13 0 1-4-1-7-4-10 0 3-2 5-3 5 1-4 0-7-1-10Z" fill="#fff6b0" stroke="none"/>
        <path d="M19 38c-3 8-2 14 2 18" fill="none" stroke="#ffbc7e" strokeWidth="3"/>
      </> : index === 2 ? <>
        <circle cx="40" cy="40" r="32" fill={`url(#${id}-gold)`}/>
        <path d="M19 24c6-9 17-12 25-10" fill="none" stroke="#fff5ba" strokeWidth="3.5"/>
        <path d="M17 34q8-12 17-1M46 33q9-11 17 1" fill="none" strokeWidth="4"/>
        <path d="M18 43q22 10 44 0c-3 20-12 26-22 26S21 62 18 43Z" fill="#41233a"/>
        <path d="M21 45q19 8 38 0l-4 10q-15 6-30 0Z" fill="#fffdf2" stroke="none"/>
        <path d="M30 65q10-11 20 0-10 5-20 0Z" fill="#ed6b76" stroke="none"/>
        <path d="M15 37C9 40 2 49 4 54c2 6 13 4 16-2 2-4-1-11-5-15ZM65 37c6 3 13 12 11 17-2 6-13 4-16-2-2-4 1-11 5-15Z" fill={`url(#${id}-water)`} stroke="#1378a8" strokeWidth="1.8"/>
        <path d="m12 44-4 6m60-6 4 6" stroke="#d5fbff" strokeWidth="2.6"/>
      </> : <>
        <g transform="rotate(-19 40 44)">
          <path d="m38 63-16-25c-3-5 2-8 5-4l6 8-8-21c-2-5 4-7 6-3l9 19-7-24c-1-5 5-6 7-1l8 23-4-20c-1-5 5-6 6-1l7 23 2-12c1-5 7-3 6 2l-1 24c-1 11-4 17-12 20Z" fill="#d98938"/>
          <path d="m28 70-17-25c-3-5 2-9 6-5l10 11-10-26c-2-6 4-8 7-3l10 23-7-29c-1-5 5-7 7-1l9 28-5-26c-1-6 6-7 7-1l6 28 1-18c0-6 7-6 7 0l1 27c1 13-5 21-16 23Z" fill={`url(#${id}-hand)`}/>
          <path d="m28 52 8 10m7-17 3 10m-13-9 4 11" fill="none" stroke="#c68132" strokeWidth="1.6"/>
          <path d="m31 22 5 20m-15-12 7 17" fill="none" stroke="#fff0bb" strokeWidth="2.2"/>
        </g>
        <path d="m8 24-4-4m14-9-2-6m43 3 3-5m6 15 7-3" fill="none" stroke="#ffde79" strokeWidth="3.3"/>
      </>}
    </g>
  </svg>;
}
