export function HoleResultArt({ tone }: { tone: string }) {
  const crown = <path d="m82 44-7-24 17 10 18-23 18 23 17-10-7 24Z" fill="#ffdc4f" stroke="#05283e" strokeWidth="5" strokeLinejoin="round"/>;
  const ball = <><circle cx="110" cy="91" r="31" fill="#f7fcff" stroke="#05283e" strokeWidth="5"/><path d="m91 79 5 3m27-8 4 3m-34 23 4 3m25 5 4-2" stroke="#b4d3e5" strokeWidth="5" strokeLinecap="round"/></>;
  return <svg className={`hr-art hr-art-${tone}`} viewBox="0 0 220 160" fill="none" aria-hidden="true">
    {tone === 'ace' ? <>
      <g className="hr-ace-rays" stroke="#ffe275" strokeWidth="5" strokeLinecap="round">{Array.from({length:12},(_,i)=><path key={i} transform={`rotate(${i*30} 110 80)`} d="M110 6v13"/>)}</g>
      <path className="hr-ace-flame" d="M57 124Q26 84 70 43l2 33Q97 64 109 3q21 27 19 53l18-25q47 51 26 91Z" fill="#ff913f" stroke="#05283e" strokeWidth="5"/>
      <path d="M76 119q-16-30 20-61l4 23 23-30q28 40 20 68Z" fill="#ffe563"/>
      <g className="hr-royal-ball">{ball}<path d="M91 87h17l-3 12H94Zm22 0h17l-3 12h-11Z" fill="#06273e"/><path d="M106 90h9m-13 18q9 8 18-1" stroke="#06273e" strokeWidth="4" strokeLinecap="round"/>{crown}</g>
      <path d="M59 137h102l-9 17H68Z" fill="#ffda51" stroke="#05283e" strokeWidth="4"/>
      <text x="110" y="149" textAnchor="middle" fill="#06283d" stroke="none" fontFamily="Impact,sans-serif" fontSize="12">ONE SHOT. LEGEND.</text>
    </> : tone === 'birdie' ? <g className="hr-bird">
      <path d="m48 115 29 15-16 12m75-17 25 11" stroke="#ffca58" strokeWidth="5" strokeLinecap="round"/>
      <path d="M58 105Q27 81 30 57l40 21q2-41 41-41 35 0 41 35l30 8-27 17q-4 40-43 40-32 0-54-32Z" fill="#65d4a1" stroke="#05283e" strokeWidth="5" strokeLinejoin="round"/>
      <path className="hr-bird-wing" d="M104 91Q65 65 58 84q-5 35 42 33" fill="#b9f38e" stroke="#05283e" strokeWidth="4"/>
      <circle cx="133" cy="65" r="5" fill="#06273e"/><path d="m150 74 30 6-26 13" fill="#ffcc52" stroke="#05283e" strokeWidth="4"/>
      <path d="m100 40-8-19 18 6 11-16 7 25" fill="#ffdc4f" stroke="#05283e" strokeWidth="4"/>
      <path d="m28 31 3 8 9 3-9 3-3 8-3-8-9-3 9-3" fill="#fff4ab"/>
    </g> : tone === 'eagle' || tone === 'albatross' ? <>
      <g className="hr-wing hr-wing-left"><path d={tone === 'eagle' ? 'M102 84Q64 20 10 35l18 22-15 5 25 18-12 10 34 8-10 12 47 10Z' : 'M104 79Q70 22 5 14l20 34-18 4 25 19-14 11 38 9-11 15 51 16Z'} fill={tone === 'eagle' ? '#f1b94d' : '#c5b1ff'} stroke="#05283e" strokeWidth="5" strokeLinejoin="round"/><path d="m35 49 56 42m-51-17 49 24" stroke="#fff3b977" strokeWidth="4"/></g>
      <g className="hr-wing hr-wing-right" transform="translate(220 0) scale(-1 1)"><path d={tone === 'eagle' ? 'M102 84Q64 20 10 35l18 22-15 5 25 18-12 10 34 8-10 12 47 10Z' : 'M104 79Q70 22 5 14l20 34-18 4 25 19-14 11 38 9-11 15 51 16Z'} fill={tone === 'eagle' ? '#f1b94d' : '#c5b1ff'} stroke="#05283e" strokeWidth="5" strokeLinejoin="round"/></g>
      <path d="M77 73q-5-33 32-33 36 0 38 27l-24 5 16 17-22 2q13 28-7 49-24-7-32-31Z" fill={tone === 'eagle' ? '#fff5d6' : '#eef6ff'} stroke="#05283e" strokeWidth="5"/>
      <path d="m124 65 28 4-13 20-17-11" fill="#ffbc42" stroke="#05283e" strokeWidth="4"/><path d="m103 59 17 3" stroke="#06273e" strokeWidth="5" strokeLinecap="round"/>
      {tone === 'albatross' && <><ellipse className="hr-orbit" cx="110" cy="92" rx="96" ry="35" stroke="#eed9ff" strokeWidth="2" strokeDasharray="5 12"/>{crown}</>}
    </> : tone === 'par' ? <>
      <ellipse cx="110" cy="128" rx="82" ry="22" fill="#28b88b" stroke="#05283e" strokeWidth="5"/><ellipse cx="127" cy="124" rx="24" ry="7" fill="#05283e"/>
      <path d="M127 122V22" stroke="#e4f7ff" strokeWidth="6"/><path className="hr-flag" d="m130 24 47 17-47 20Z" fill="#ff6175" stroke="#05283e" strokeWidth="4"/>
      <g className="hr-ball" transform="translate(-32 26) scale(.8)">{ball}</g>
      <path d="m47 38 11 11 23-27" stroke="#8eecc4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    </> : <>
      <ellipse cx="108" cy="139" rx="58" ry="9" fill="#001b2e88"/>
      <g className="hr-sad-ball">{ball}<path d="m91 86 13 3m14 0 13-3m-31 24q10-8 20 0" stroke="#05283e" strokeWidth="4" strokeLinecap="round"/></g>
      <path d="m146 66 12-18q13 23-1 26-6 0-11-8" fill="#6ed6ef" stroke="#05283e" strokeWidth="3"/>
      <path d="m52 119-12-45m-7 0 13-3" stroke="#afbdc8" strokeWidth="6" strokeLinecap="round"/>
      {(tone === 'double' || tone === 'triple') && <path d="m85 63 47 19-5 12-47-19Z" fill="#ffe2ab" stroke="#05283e" strokeWidth="3"/>}
      {tone === 'triple' && <g className="hr-dizzy-stars" fill="#ffda62"><path d="m67 37 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z"/><path d="m140 31 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z"/></g>}
      {tone === 'cap' && <path d="M66 40h83v16H66Z" fill="#ffbb79" stroke="#05283e" strokeWidth="4"/>}
    </>}
  </svg>;
}
