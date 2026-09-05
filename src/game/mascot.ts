/**
 * The mascot: a crowned toilet with a golf ball. One SVG body used by the
 * home screen (inline) and the app icon (public/icon.svg is generated from
 * the same markup by scripts/icons.mjs). Ink outlines, porcelain gradient.
 */
export const MASCOT_VIEWBOX = '0 0 160 170';

export const MASCOT_BODY = `
<defs>
  <linearGradient id="porc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6e2ee"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffb020"/></linearGradient>
  <radialGradient id="ball" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c4cfdb"/></radialGradient>
</defs>
<ellipse cx="80" cy="160" rx="54" ry="7" fill="rgba(0,0,0,0.3)"/>
<!-- tank -->
<rect x="40" y="46" width="80" height="50" rx="10" fill="url(#porc)" stroke="#1f2a44" stroke-width="5"/>
<rect x="34" y="40" width="92" height="14" rx="6" fill="#ffffff" stroke="#1f2a44" stroke-width="5"/>
<rect x="112" y="60" width="16" height="7" rx="3.5" fill="#c7d1dd" stroke="#1f2a44" stroke-width="3.5"/>
<!-- eyes + smile on the tank -->
<circle cx="64" cy="70" r="9" fill="#fff" stroke="#1f2a44" stroke-width="4"/>
<circle cx="96" cy="70" r="9" fill="#fff" stroke="#1f2a44" stroke-width="4"/>
<circle cx="66.5" cy="71.5" r="4" fill="#1f2a44"/>
<circle cx="98.5" cy="71.5" r="4" fill="#1f2a44"/>
<circle cx="68" cy="69.5" r="1.4" fill="#fff"/>
<circle cx="100" cy="69.5" r="1.4" fill="#fff"/>
<path d="M66 86 Q80 94 94 86" fill="none" stroke="#1f2a44" stroke-width="4" stroke-linecap="round"/>
<!-- bowl -->
<path d="M26 104 C26 94 44 90 80 90 C116 90 134 94 134 104 L128 128 C122 148 104 156 80 156 C56 156 38 148 32 128 Z" fill="url(#porc)" stroke="#1f2a44" stroke-width="5"/>
<!-- seat + water -->
<ellipse cx="80" cy="104" rx="46" ry="15" fill="#ffffff" stroke="#1f2a44" stroke-width="5"/>
<ellipse cx="80" cy="105" rx="31" ry="9" fill="#4db8ff" stroke="#1f2a44" stroke-width="4"/>
<ellipse cx="70" cy="103" rx="9" ry="3" fill="#9fdcff"/>
<!-- crown -->
<path d="M44 40 L52 16 L66 30 L80 8 L94 30 L108 16 L116 40 Z" fill="url(#gold)" stroke="#1f2a44" stroke-width="5" stroke-linejoin="round"/>
<circle cx="52" cy="16" r="4.5" fill="#ff6f3c" stroke="#1f2a44" stroke-width="3"/>
<circle cx="80" cy="8" r="5" fill="#ff6f3c" stroke="#1f2a44" stroke-width="3"/>
<circle cx="108" cy="16" r="4.5" fill="#ff6f3c" stroke="#1f2a44" stroke-width="3"/>
<circle cx="70" cy="34" r="2.5" fill="#fff" opacity="0.8"/>
<!-- golf ball rolling up with motion lines -->
<path d="M8 150 h14 M4 142 h16 M10 134 h10" stroke="#1f2a44" stroke-width="3.5" stroke-linecap="round" opacity="0.6"/>
<circle cx="36" cy="146" r="13" fill="url(#ball)" stroke="#1f2a44" stroke-width="4.5"/>
<circle cx="31" cy="141" r="1.8" fill="#aab6c4"/>
<circle cx="39" cy="140" r="1.8" fill="#aab6c4"/>
<circle cx="34" cy="148" r="1.8" fill="#aab6c4"/>
<circle cx="41" cy="149" r="1.8" fill="#aab6c4"/>
`;
