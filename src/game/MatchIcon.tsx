/** Shared match emblem, designed to stay legible in the dock and on Home. */
export function MatchIcon() {
  return <svg className="match-emblem" viewBox="0 0 64 64" fill="none" stroke="#092b40" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g transform="translate(32 31) rotate(40)">
      <rect x="-3" y="-8" width="6" height="34" rx="3" fill="#e7b56b"/>
      <path d="M-1 0v20" stroke="#fff0be" strokeWidth="1.5"/>
      <path d="M-11-8q1-14 11-14T11-8Z" fill="#43c6d9"/>
      <path d="M-6-12q1-6 5-6" stroke="#cff9ff" strokeWidth="2.5"/>
      <rect x="-14" y="-9" width="28" height="7" rx="3.5" fill="#2796af"/>
    </g>
    <g transform="translate(32 31) rotate(-40)">
      <rect x="-3" y="-8" width="6" height="34" rx="3" fill="#e7b56b"/>
      <path d="M-1 0v20" stroke="#fff0be" strokeWidth="1.5"/>
      <path d="M-11-8q1-14 11-14T11-8Z" fill="#ff8062"/>
      <path d="M-6-12q1-6 5-6" stroke="#ffe5b9" strokeWidth="2.5"/>
      <rect x="-14" y="-9" width="28" height="7" rx="3.5" fill="#d9584e"/>
    </g>
    <circle cx="32" cy="46" r="8" fill="#fff9e8"/>
    <g fill="#aecdd2" stroke="none"><circle cx="29" cy="43" r="1.5"/><circle cx="35" cy="44" r="1.5"/><circle cx="32" cy="49" r="1.5"/></g>
    <path d="M32 4v4M5 23l4 2m50-2-4 2" stroke="#ffdf69" strokeWidth="3"/>
  </svg>;
}
