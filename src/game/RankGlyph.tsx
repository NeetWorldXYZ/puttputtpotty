type Kind = 'crown' | 'pin' | 'friends' | 'map' | 'clock' | 'target' | 'help' | 'trophy';
/** Small symbols for ranking controls, legible at 18–24px. */
export function RankGlyph({kind}:{kind:Kind}) {
  return <svg className={'rk-glyph rk-glyph-'+kind} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <g stroke="#06283b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {kind==='crown'&&<><path d="M5 24 2 8l8 6 6-11 6 11 8-6-3 16Z" fill="#ffdc5d"/><path d="M7 27h18M7 20 5 13m10-3 1-2" stroke="#fff2b0"/></>}
      {kind==='pin'&&<><path d="M16 30C11 23 4 17 4 11a12 12 0 0 1 24 0c0 6-7 12-12 19Z" fill="#55dcb8"/><circle cx="16" cy="11" r="4" fill="#082f43"/></>}
      {kind==='friends'&&<><circle cx="12" cy="9" r="6" fill="#67caf5"/><path d="M2 28v-7q10-12 20 0v7Z" fill="#49b6ed"/><path d="M23 4q10 5 2 12m1 4q5 1 5 8h-6" fill="#86d9f4"/><path d="M25 20v10m-5-5h10" stroke="#7bf0b9" strokeWidth="3"/></>}
      {kind==='map'&&<><path d="m2 6 9-4 10 4 9-4v24l-9 4-10-4-9 4Z" fill="#f9e5a3"/><path d="M11 3v22m10-19v23" fill="none"/><path d="m5 23 6-7 5 2 10-12" fill="none" stroke="#48ac9d" strokeDasharray="3 3" strokeWidth="3"/></>}
      {kind==='clock'&&<><circle cx="16" cy="16" r="14" fill="#6eddef"/><path d="M16 7v10l7 4" fill="none" strokeWidth="3"/><path d="M7 10q2-4 5-5" fill="none" stroke="#d8fbff"/></>}
      {kind==='target'&&<><circle cx="14" cy="18" r="12" fill="#ff666f"/><circle cx="14" cy="18" r="8" fill="none" stroke="#fff0dd"/><circle cx="14" cy="18" r="3" fill="#fff0dd"/><path d="m14 18 12-12" stroke="#fff0dd" strokeWidth="3"/><path d="m22 4 3-2v5h5l-2 4-6 1Z" fill="#67d7dd"/></>}
      {kind==='trophy'&&<><path d="M9 6H4q0 8 6 9M23 6h5q0 8-6 9" fill="none" stroke="#8a5a10" strokeWidth="3"/><path d="M9 3h14v9a7 7 0 0 1-14 0Z" fill="#ffc832" stroke="#8a5a10" strokeWidth="2"/><path d="M13 19h6v4h-6Z" fill="#c98a1c"/><path d="M9 27q7-5 14 0v3H9Z" fill="#ffc832" stroke="#8a5a10" strokeWidth="2"/></>}
      {kind==='help'&&<><circle cx="16" cy="16" r="14" fill="#f3f5e9"/><path d="M12 10q1-6 7-3t-2 10v2" fill="none" strokeWidth="3"/><circle cx="16" cy="25" r="1" fill="#06283b"/></>}
    </g>
  </svg>;
}
