import { useId } from 'react';

/** Two thrones squaring off on a torn scrap of the course: decoration for the match lobby, in the Home map's style. */
export function MatchArt() {
  const id = useId().replace(/:/g, '');
  const outline = 'M14 40 118 14 240 6 348 28 352 206 236 224 122 214 8 226Z';
  return (
    <svg className="ml-art" viewBox="0 -14 360 264" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-paper`}>
          <path d={outline} />
        </clipPath>
        <radialGradient id={`${id}-gold`}>
          <stop stopColor="#fff5a4" stopOpacity=".95" />
          <stop offset="1" stopColor="#ffd23e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-red`}>
          <stop stopColor="#ff6e82" stopOpacity=".9" />
          <stop offset="1" stopColor="#ff6078" stopOpacity="0" />
        </radialGradient>
        <g id={`${id}-throne`} stroke="#09263c" strokeWidth="2.4" strokeLinejoin="round">
          <path d="M-19-16Q-19-36 0-36T19-16Q19-2 0 20Q-19-2-19-16Z" fill="currentColor" stroke="#fff1cf" strokeWidth="3" />
          <path d="m-10-25-3-10 8 5 5-9 5 9 8-5-3 10Z" fill="#ffd34c" />
          <rect x="-10" y="-22" width="20" height="15" rx="2" fill="#fffdf3" />
          <path d="M-12-8H12Q12 4 3 5L6 12H-6L-3 5Q-12 4-12-8Z" fill="#fffdf3" />
          <ellipse cy="-7" rx="12" ry="4" fill="#fff" />
          <ellipse cy="-7" rx="7" ry="2" fill="#5fd0e7" strokeWidth="1.5" />
        </g>
      </defs>
      <path d={outline} transform="translate(2 5)" fill="#08263b" stroke="#08263b" strokeWidth="13" strokeLinejoin="round" />
      <path d={outline} fill="#4a9b43" stroke="#fff0b8" strokeWidth="10" strokeLinejoin="round" />
      <g clipPath={`url(#${id}-paper)`}>
        <image href={`${import.meta.env.BASE_URL}art/arcade-course.webp`} x="-60" y="-220" width="480" height="1040" />
        {/* the arena: a putting green with a dashed ring and a cup in the middle */}
        <ellipse cx="180" cy="128" rx="150" ry="62" fill="#7cc95a" stroke="#08263b" strokeWidth="3" />
        <ellipse cx="180" cy="128" rx="128" ry="48" fill="none" stroke="#fff0cf" strokeWidth="3" strokeDasharray="9 8" />
        <ellipse cx="180" cy="146" rx="9" ry="4" fill="#08263b" />
        <path d="M180 146V112" stroke="#08263b" strokeWidth="3" />
        <path d="M180 112h22l-22 10Z" fill="#ff5c5c" stroke="#08263b" strokeWidth="2" strokeLinejoin="round" />
        {/* strokes flying in from each side */}
        <path d="M108 150q36-38 66-4" stroke="#fff0cf" strokeWidth="3" strokeDasharray="5 6" fill="none" />
        <path d="M252 150q-36-38-66-4" stroke="#fff0cf" strokeWidth="3" strokeDasharray="5 6" fill="none" />
        <circle cx="168" cy="140" r="5" fill="#7ee36b" stroke="#08263b" strokeWidth="2" />
        <circle cx="192" cy="140" r="5" fill="#fff" stroke="#08263b" strokeWidth="2" />
      </g>
      <g>
        <circle cx="92" cy="112" r="46" fill={`url(#${id}-gold)`} />
        <use href={`#${id}-throne`} transform="translate(92 106) scale(1.55)" color="#ffd34c" />
      </g>
      <g>
        <circle cx="268" cy="112" r="40" fill={`url(#${id}-red)`} />
        <use href={`#${id}-throne`} transform="translate(268 106) scale(1.55)" color="#f36578" />
      </g>
      {/* VS sticker */}
      <g transform="translate(180 66) rotate(-8)">
        <rect x="-36" y="-24" width="72" height="48" rx="14" fill="#08263b" transform="translate(2 4)" />
        <rect x="-36" y="-24" width="72" height="48" rx="14" fill="#ffd34c" stroke="#08263b" strokeWidth="3" />
        <text x="0" y="12" textAnchor="middle" fontFamily="Impact, 'Arial Narrow', sans-serif" fontStyle="italic" fontWeight="900" fontSize="34" fill="#08263b">
          VS
        </text>
      </g>
      {/* a few sparks */}
      <path d="m148 34 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#fff0b8" stroke="#08263b" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m214 30 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#fff0b8" stroke="#08263b" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
