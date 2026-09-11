/** Hand-built vector materials and silhouettes, sharing the original face/hat anchors.
 * All artwork fits the existing 160 × 170 portrait; nothing is a baked-in hat. */
const ink='#071f32';
const line=`stroke="${ink}" stroke-linejoin="round" stroke-linecap="round"`;
const glint=(d:string,w=3)=>`<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity=".7"/>`;
const star=(x:number,y:number,s:number)=>`<path d="M${x} ${y-s}q0 ${s} ${s} ${s}q-${s} 0-${s} ${s}q0-${s}-${s}-${s}q${s} 0 ${s}-${s}Z" fill="#efffff"/>`;

export function earnedHeadArt(head:string,tone:{top:string;bottom:string},id:string):string|null {
  const paint=`fill="url(#${id}-skin)" ${line} stroke-width="5.5"`;
  let shape='';
  switch(head){
    case 'bubble': shape=`
      <defs><radialGradient id="${id}-soap" cx=".3" cy=".22" r=".85"><stop stop-color="#e6fff9"/><stop offset=".3" stop-color="${tone.top}"/><stop offset=".73" stop-color="${tone.bottom}"/><stop offset="1" stop-color="#bfadf5"/></radialGradient></defs>
      <circle cx="80" cy="72" r="40" fill="url(#${id}-soap)" ${line} stroke-width="5.5"/>
      <path d="M112 58q12 43-33 48-20 0-31-18 20 14 39 3 18-10 25-33" fill="#9aeada" opacity=".4"/>
      <path d="M52 62q3-20 24-22" fill="none" stroke="#f0fffb" stroke-width="6" stroke-linecap="round"/>
      <path d="M91 103q18-7 22-23" fill="none" stroke="#ffc3ef" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="95" cy="45" rx="6" ry="3.5" transform="rotate(25 95 45)" fill="#fff" opacity=".65"/>
      <circle cx="39" cy="40" r="9" fill="${tone.top}" ${line} stroke-width="3"/>${glint('M35 39q0-3 4-3',2)}
      <circle cx="123" cy="99" r="6" fill="${tone.top}" ${line} stroke-width="2.5"/>${star(115,36,4)}`;break;
    case 'robot': shape=`
      <path d="M36 59h-7q-5 0-5 7v18q0 7 5 7h9m87-32h7q5 0 5 7v18q0 7-5 7h-9" fill="#4c7189" ${line} stroke-width="4"/>
      <rect x="39" y="34" width="82" height="78" rx="21" ${paint}/>
      <path d="M43 55V51q0-13 15-13h44q10 0 13 9H56Z" fill="#f0faff" opacity=".65"/>
      <path d="M112 51v41q0 11-13 12H55l-9-8q3 13 18 13h36q18 0 18-17V52Z" fill="${tone.bottom}"/>
      <rect x="48" y="57" width="64" height="27" rx="10" fill="#082c45" ${line} stroke-width="3"/>
      <path d="M54 60h31" stroke="#7dcbdb" stroke-width="2" opacity=".5"/>
      <path d="M68 100h24" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
      ${[51,109].map(x=>`<circle cx="${x}" cy="47" r="3" fill="#edf9fc" stroke="#436578" stroke-width="1.5"/><path d="m${x-1} 46 2 2" stroke="#436578"/>`).join('')}
      <rect x="28" y="68" width="7" height="13" rx="3" fill="#54e8eb"/><rect x="127" y="68" width="7" height="13" rx="3" fill="#54e8eb"/>`;break;
    case 'swamp': shape=`
      <path d="m43 62-16-4 7 14-10 7 17 9m78-26 16-4-7 14 10 7-17 9" fill="${tone.bottom}" ${line} stroke-width="4"/>
      <path d="M40 77q-3-22 12-34l2-15 15 10q12-7 25-2l11-12 4 20q15 10 13 33l-3 21q-2 8-10 6-6 18-18 5-13 12-22 0-16 7-17-7-14 4-13-9Z" ${paint}/>
      <path d="M45 77q4 21 13 19 2 14 12 6 9 9 20 0 12 12 16-2 10 0 13-19v12q-1 14-10 11-6 18-18 5-13 12-22 0-16 7-17-7-14 4-13-9Z" fill="${tone.bottom}" opacity=".65"/>
      ${glint('M50 57q3-9 12-11')}
      <path d="M100 43q6 3 7 9v9" fill="none" stroke="#dffaaa" stroke-width="5" stroke-linecap="round"/>
      <circle cx="51" cy="82" r="3" fill="#d5f88c"/><circle cx="108" cy="91" r="3.5" fill="#295a53"/><circle cx="112" cy="55" r="2" fill="#295a53"/>`;break;
    case 'vampire': shape=`
      <path d="M45 63 26 48q-1 27 22 36m67-21 19-15q1 27-22 36" ${paint}/>
      <path d="m33 57 11 18m83-18-11 18" stroke="#b579b6" stroke-width="4" stroke-linecap="round"/>
      <path d="M42 68q-2-34 38-35t39 35q1 35-39 45-39-10-38-45Z" ${paint}/>
      <path d="M43 62q-4-36 37-35 44-1 38 35L106 44 88 45 80 55 72 45 54 44Z" fill="#263049" ${line} stroke-width="4"/>
      <path d="m56 37 16-4 8 9 8-9 13 4" fill="none" stroke="#656e93" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="55" cy="82" rx="6" ry="3" fill="#d6a4d4"/><ellipse cx="105" cy="82" rx="6" ry="3" fill="#d6a4d4"/>`;break;
    case 'shark': shape=`
      <path d="M72 42q9-24 28-25l-3 28" fill="${tone.bottom}" ${line} stroke-width="5"/>
      <path d="m84 37 10-12-2 15" fill="#acdfe9" opacity=".55"/>
      <path d="M38 80q0-41 40-45 38-3 47 33l-4 22 8 9-16 0q-11 15-33 15-26 0-38-14l-13-1 11-10Z" ${paint}/>
      <path d="M42 86q9-10 18-7 20 10 40 0 11-4 22 7l-5 13q-12 13-37 12-24 1-35-13Z" fill="#edf4e8"/>
      <path d="m110 69 3 7m-2 4 1 6m-63-17-2 7" stroke="${tone.bottom}" stroke-width="2.5" stroke-linecap="round"/>
      ${glint('M49 58q7-11 19-13',4)}`;break;
    case 'ghost': shape=`
      <path d="M42 72q-1-39 36-39 42-1 42 43l-3 13 10 15q-12 11-25 1l-7 12-14-8-13 6-10-11q-13 9-24 0l10-17Z" ${paint}/>
      <path d="M114 58q7 34-10 39-11 5-17 0-16 10-39-5l-9 10 14-3 13 10 15-5 14 8 8-13q13 9 20 4l-9-14q8-19 0-31Z" fill="${tone.bottom}" opacity=".55"/>
      ${glint('M52 57q7-13 21-15',5)}
      <ellipse cx="53" cy="83" rx="6" ry="3" fill="#accfe5"/><ellipse cx="107" cy="83" rx="6" ry="3" fill="#accfe5"/>
      ${star(131,49,5)}${star(30,87,4)}`;break;
    case 'raccoon': shape=`
      <path d="M45 53q-22-27-6-34 18-6 29 20m46 14q22-27 6-34-18-6-29 20" fill="${tone.bottom}" ${line} stroke-width="5"/>
      <path d="M47 40q-11-17-12-11-3 7 11 17m67-6q11-17 12-11 3 7-11 17" fill="#eac3c2"/>
      <path d="M41 65q4-30 39-30 35 0 39 30l8 17-9-1 9 12-13 1q-11 17-34 18-23-1-34-18l-13-1 9-12-9 1Z" ${paint}/>
      <path d="M80 43 69 59 49 62 43 77q11 11 24 3l13-9 13 9q13 8 24-3l-6-15-20-3Z" fill="#233c50"/>
      <path d="M57 91q4-14 23-13 19-1 23 13l-9 15q-15 9-28-1Z" fill="#f0ebd9"/>
      <path d="M74 84q6-4 12 0l-6 6Z" fill="${ink}"/>
      ${glint('M53 49q7-8 17-7',3)}`;break;
    case 'flame': shape=`
      <defs><linearGradient id="${id}-fire" x2=".2" y2="1"><stop stop-color="#fff293"/><stop offset=".4" stop-color="#ffa231"/><stop offset="1" stop-color="#d84046"/></linearGradient></defs>
      <path d="M42 94q-16-24-4-46 1 14 12 16-8-29 15-45-3 21 8 24 17-14 14-30 31 20 23 49 11-3 15-18 14 33-9 55-31 32-64 7Z" fill="url(#${id}-fire)" ${line} stroke-width="5"/>
      <path d="M48 85q1-21 17-35 0 15 13 8 11-3 15-16 22 22 20 43-2 28-34 28-31-1-31-28Z" ${paint}/>
      <path d="M52 87q6 18 24 19 24 2 34-23-1 28-31 28-23-2-27-24" fill="#f89b40" opacity=".65"/>
      ${glint('M55 66q2-7 8-11',3)}
      <path d="m27 32 4-7 1 9m92-8 2-7 3 9" fill="#ffda61"/>`;break;
    case 'lion': shape=`
      <defs><linearGradient id="${id}-mane" x2=".5" y2="1"><stop stop-color="#dd9847"/><stop offset=".5" stop-color="#a75b30"/><stop offset="1" stop-color="#623d30"/></linearGradient></defs>
      <path d="m79 25 12 5 12-3 9 12 13 4 2 14 10 10-5 14 5 12-14 8-7 14-16-2-12 10-13-6-14 3-10-12-15-3-2-15-9-12 7-14-1-13 14-7 6-13 15 3Z" fill="url(#${id}-mane)" ${line} stroke-width="5.5"/>
      <path d="m42 55-4 15 7 12-2 13 13 4 5 12m52-54 11 12-5 13 3 9-13 9-5 12m-42-75 10-4 9 4" fill="none" stroke="#e4aa61" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <circle cx="49" cy="50" r="10" ${paint}/><circle cx="111" cy="50" r="10" ${paint}/>
      <circle cx="49" cy="50" r="4" fill="#c68456"/><circle cx="111" cy="50" r="4" fill="#c68456"/>
      <path d="M48 71q-1-33 32-34 33 1 32 34v14q-3 26-32 26-29 0-32-26Z" ${paint}/>
      <path d="M58 88q8-17 22-9 14-8 22 9v10q-22 23-44 0Z" fill="#fff1cc"/>
      <path d="M73 82q7-5 14 0l-7 7Z" fill="${ink}"/>
      ${glint('M58 52q7-9 17-8',3)}`;break;
    case 'diamond': shape=`
      <path d="M44 41 62 30h36l18 11 11 28-13 27-34 19-34-19-13-27Z" ${paint}/>
      <path d="m44 41 18-11-9 24-20 15Zm18-11h36l-18 24Zm36 0 18 11-9 13-27 0Z" fill="#f1ffff" opacity=".8"/>
      <path d="m33 69 20-15-7 42Zm74-15 20 15-13 27Z" fill="#80b2ef"/>
      <path d="m46 96 34-6 34 6-34 19Z" fill="#8ba8ee"/>
      <path d="m53 54 27 0 27 0 7 42-34-6-34 6Z" fill="${tone.top}" opacity=".58"/>
      <path d="m44 41 9 13 27 0 27 0 9-13M62 30 53 54 46 96 80 115l34-19-7-42-9-24M33 69l20-15m54 0 20 15" fill="none" stroke="#f0ffff" stroke-width="1.8" opacity=".8"/>
      ${star(45,41,7)}${star(123,96,5)}`;break;
    default:return null;
  }
  return `<g data-part="head" data-head="${head}">${shape}</g>`;
}

/** Material-specific face details stay separate from the head and from hats. */
export function earnedFace(head:string,face:string,markup:string):string {
  if(head==='robot') return markup.replace(/fill="#071f32"/g,'fill="#7ffff2"');
  if(head==='raccoon') markup=markup.replace(/(<g data-feature="eyes">)([\s\S]*?)(<\/g>)/,(_all,start,eyes,end)=>start+eyes.replace(/fill="#071f32"/g,'fill="#fff1cf"')+end);
  if(['raccoon','lion'].includes(head)) markup=markup.replace(/(data-feature="mouth" d="M\d+ )85/g,(_all,start)=>start+'92');
  if(face==='happy'||face==='wink'||face==='cool') {
    if(head==='vampire') markup+=`<path data-feature="fangs" d="m69 88 4 10 4-7m6 0 4 7 4-10" fill="#fff9e7" ${line} stroke-width="1.8"/>`;
    if(head==='shark') markup=markup.replace(/<path data-feature="mouth"[^>]*\/>/,`<path data-feature="mouth" d="M62 84q18 8 36 0-2 18-18 18T62 84Z" fill="${ink}"/><path d="m66 87 5 7 4-6 5 7 5-7 4 6 5-7" fill="#fffbed"/><path d="m73 98 4-5 5 6 5-5 3 3" fill="#fffbed"/>`);
  }
  return markup;
}
