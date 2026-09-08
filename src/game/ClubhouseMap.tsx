import { useId } from 'react';

/** Decorative invitation, not live location data. */
export function ClubhouseMap() {
  const id = useId().replace(/:/g, '');
  const outline = 'M20 44 116 24 222 8 326 30 346 224 232 245 123 229 5 244Z';
  return <svg className="clubhouse-map-art" viewBox="0 0 360 258" aria-hidden="true">
    <defs>
      <clipPath id={`${id}-paper`}><path d={outline}/></clipPath>
      <radialGradient id={`${id}-gold`}><stop stopColor="#fff5a4" stopOpacity=".95"/><stop offset="1" stopColor="#ffd23e" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-red`}><stop stopColor="#ff6e82" stopOpacity=".9"/><stop offset="1" stopColor="#ff6078" stopOpacity="0"/></radialGradient>
      <g id={`${id}-throne`} stroke="#09263c" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M-19-16Q-19-36 0-36T19-16Q19-2 0 20Q-19-2-19-16Z" fill="currentColor" stroke="#fff1cf" strokeWidth="3"/>
        <path d="m-10-25-3-10 8 5 5-9 5 9 8-5-3 10Z" fill="#ffd34c"/>
        <rect x="-10" y="-22" width="20" height="15" rx="2" fill="#fffdf3"/>
        <path d="M-12-8H12Q12 4 3 5L6 12H-6L-3 5Q-12 4-12-8Z" fill="#fffdf3"/>
        <ellipse cy="-7" rx="12" ry="4" fill="#fff"/><ellipse cy="-7" rx="7" ry="2" fill="#5fd0e7" strokeWidth="1.5"/>
      </g>
    </defs>
    <path d={outline} transform="translate(2 5)" fill="#08263b" stroke="#08263b" strokeWidth="13" strokeLinejoin="round"/>
    <path d={outline} fill="#4a9b43" stroke="#fff0b8" strokeWidth="10" strokeLinejoin="round"/>
    <g clipPath={`url(#${id}-paper)`}>
      <image href={`${import.meta.env.BASE_URL}art/arcade-course.webp`} x="-40" y="-160" width="440" height="953"/>
      <path d="M116 24 123 229 232 245 222 8Z" fill="#faffaa" opacity=".13"/>
      <path d="M116 24 123 229M222 8 232 245" stroke="#082b34" opacity=".2" strokeWidth="3"/>
      <path d="M37 203Q98 188 135 153T253 92Q292 77 326 51" stroke="#fff0cf" strokeWidth="7" fill="none"/>
    </g>
    <g className="clubhouse-red-marker"><circle cx="74" cy="124" r="32" fill={`url(#${id}-red)`}/><use href={`#${id}-throne`} transform="translate(74 117)" color="#f36578"/></g>
    <g className="clubhouse-gold-marker"><circle cx="184" cy="130" r="44" fill={`url(#${id}-gold)`}/><ellipse cx="184" cy="155" rx="23" ry="8" fill="none" stroke="#fff0a2" strokeWidth="3"/><use href={`#${id}-throne`} transform="translate(184 127) scale(1.15)" color="#ffd34c"/></g>
    <use href={`#${id}-throne`} transform="translate(278 164)" color="#9aaebd"/>
  </svg>;
}
