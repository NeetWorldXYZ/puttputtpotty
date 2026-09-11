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
      <path d="M45 74a36 36 0 0 0 54 30" fill="none" stroke="#9df4fa" stroke-width="2" opacity=".8"/>
      <path d="M99 43a33 33 0 0 1 13 20" fill="none" stroke="#fbe3ff" stroke-width="2"/>
      <path d="M47 88q24 9 45-4" fill="none" stroke="#c5fcf4" stroke-width="1.2" opacity=".35"/>
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
      <path d="M43 91v6q0 11 13 11h49q13 0 13-13" fill="none" stroke="#355a77" stroke-width="3"/>
      <path d="M45 92v6q0 7 11 7" fill="none" stroke="#dcf8ff" stroke-width="2"/>
      <path d="M56 94v5m5-4v4m38-4v4m5-5v5" stroke="#577c95" stroke-width="1.5"/>
      <path d="M87 38h15q8 0 10 8" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/>
      <path d="M53 62q18-5 39 0" fill="none" stroke="#9cf6f5" stroke-width="1" opacity=".35"/>
      ${[51,109].map(x=>`<circle cx="${x}" cy="47" r="3" fill="#edf9fc" stroke="#436578" stroke-width="1.5"/><path d="m${x-1} 46 2 2" stroke="#436578"/>`).join('')}
      <rect x="28" y="68" width="7" height="13" rx="3" fill="#54e8eb"/><rect x="127" y="68" width="7" height="13" rx="3" fill="#54e8eb"/>`;break;
    case 'swamp': shape=`
      <path d="m43 62-16-4 7 14-10 7 17 9m78-26 16-4-7 14 10 7-17 9" fill="${tone.bottom}" ${line} stroke-width="4"/>
      <path d="M40 77q-3-22 12-34-6-13 4-16 9-2 12 11 9-6 20-3 7-16 15-10 7 5-1 15 21 9 20 37l-3 21q-2 8-10 6-6 18-18 5-13 12-22 0-16 7-17-7-14 4-13-9Z" ${paint}/>
      <path d="M45 77q4 21 13 19 2 14 12 6 9 9 20 0 12 12 16-2 10 0 13-19v12q-1 14-10 11-6 18-18 5-13 12-22 0-16 7-17-7-14 4-13-9Z" fill="${tone.bottom}" opacity=".65"/>
      ${glint('M50 57q3-9 12-11')}
      <path d="M100 43q6 3 7 9v9" fill="none" stroke="#dffaaa" stroke-width="5" stroke-linecap="round"/>
      <circle cx="51" cy="82" r="3" fill="#d5f88c"/><circle cx="108" cy="91" r="3.5" fill="#295a53"/><circle cx="112" cy="55" r="2" fill="#295a53"/>`;break;
    case 'vampire': shape=`
      <path d="M45 63 26 48q-1 27 22 36m67-21 19-15q1 27-22 36" ${paint}/>
      <path d="m33 57 11 18m83-18-11 18" stroke="#b579b6" stroke-width="4" stroke-linecap="round"/>
      <path d="M42 68q-2-34 38-35t39 35q1 35-39 45-39-10-38-45Z" ${paint}/>
      <path d="M43 63q-5-36 37-36 44-1 38 36l-9-10-3-11q-17-5-26 13-9-18-26-13l-3 11Z" fill="#20263f" ${line} stroke-width="4"/>
      <path d="M52 40q13-12 27 5 12-18 28-7" fill="none" stroke="#7884af" stroke-width="3" stroke-linecap="round"/>
      <path d="M46 60q0 27 16 38m52-41q3 33-31 49" fill="none" stroke="${tone.bottom}" stroke-width="3" opacity=".6"/>
      ${glint('M52 54q2-5 5-7',2)}
      <ellipse cx="55" cy="82" rx="6" ry="3" fill="#d6a4d4"/><ellipse cx="105" cy="82" rx="6" ry="3" fill="#d6a4d4"/>`;break;
    case 'shark': shape=`
      <path d="M72 42q9-24 28-25l-3 28" fill="${tone.bottom}" ${line} stroke-width="5"/>
      <path d="m84 37 10-12-2 15" fill="#acdfe9" opacity=".55"/>
      <path d="M38 80q0-41 40-45 38-3 47 33l-4 22 8 9-16 0q-11 15-33 15-26 0-38-14l-13-1 11-10Z" ${paint}/>
      <path d="M42 86q9-10 18-7 20 10 40 0 11-4 22 7l-5 13q-12 13-37 12-24 1-35-13Z" fill="#edf4e8"/>
      <path d="m109 68 3 6m-1 4 1 6m3-18 3 7m-1 4 1 6m-69-14-2 7" stroke="#316b86" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M115 57q12 27-7 43-10 10-26 9" fill="none" stroke="${tone.bottom}" stroke-width="3" opacity=".6"/>
      <path d="m72 49 7-2m7 0 7 2" stroke="#34667e" stroke-width="2" stroke-linecap="round"/>
      ${glint('M49 58q7-11 19-13',4)}`;break;
    case 'ghost': shape=`
      <path d="M42 72q-1-39 36-39 42-1 42 43l-3 13 10 15q-12 11-25 1l-7 12-14-8-13 6-10-11q-13 9-24 0l10-17Z" ${paint}/>
      <path d="M114 58q7 34-10 39-11 5-17 0-16 10-39-5l-9 10 14-3 13 10 15-5 14 8 8-13q13 9 20 4l-9-14q8-19 0-31Z" fill="${tone.bottom}" opacity=".55"/>
      ${glint('M52 57q7-13 21-15',5)}
      <ellipse cx="53" cy="83" rx="6" ry="3" fill="#accfe5"/><ellipse cx="107" cy="83" rx="6" ry="3" fill="#accfe5"/>
      <path d="M42 90q15 7 20 0m39 2 11-5" fill="none" stroke="#eeffff" stroke-width="2" opacity=".8"/>
      <path d="M75 38q18-1 27 12" fill="none" stroke="#fff" stroke-width="2"/>
      ${star(131,49,5)}${star(30,87,4)}`;break;
    case 'raccoon': shape=`
      <path d="M44 54q-20-18-6-27 15-8 28 13m50 14q20-18 6-27-15-8-28 13" fill="${tone.bottom}" ${line} stroke-width="5"/>
      <path d="M46 43q-11-13-12-5-1 5 11 12m69-7q11-13 12-5 1 5-11 12" fill="#eac3c2"/>
      <path d="M41 65q4-30 39-30 35 0 39 30l8 17-9-1 9 12-13 1q-11 17-34 18-23-1-34-18l-13-1 9-12-9 1Z" ${paint}/>
      <path d="M80 43 69 59 49 62 43 77q11 11 24 3l13-9 13 9q13 8 24-3l-6-15-20-3Z" fill="#233c50"/>
      <path d="M57 91q4-14 23-13 19-1 23 13l-9 15q-15 9-28-1Z" fill="#f0ebd9"/>
      <path d="M74 84q6-4 12 0l-6 6Z" fill="${ink}"/>
      <path d="m45 83 10 1-6 6 9-1m56-6-10 1 6 6-10-1" fill="none" stroke="#d5e0df" stroke-width="2" stroke-linecap="round"/>
      <path d="m53 96 10 1m34 0 10-1" stroke="#506c7b" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M77 82h5" stroke="#91a6b0" stroke-width="1.2" stroke-linecap="round"/>
      ${glint('M53 49q7-8 17-7',3)}`;break;
    case 'flame': shape=`
      <defs><linearGradient id="${id}-fire" x1="0" y1="0" x2=".25" y2="1"><stop stop-color="#ffae35"/><stop offset=".45" stop-color="#ff632a"/><stop offset="1" stop-color="#d93631"/></linearGradient><radialGradient id="${id}-heat" cx=".52" cy=".65" r=".68"><stop stop-color="#fffac1"/><stop offset=".53" stop-color="#ffe364"/><stop offset="1" stop-color="#ff9b31"/></radialGradient></defs>
      <path data-material="living-fire" d="M80 114C45 115 28 98 34 75c3-12 10-19 7-30 13 7 16 18 15 24C69 53 48 30 76 12c-4 19 19 24 21 43 10-8 9-20 6-28 24 15 18 31 13 43 7-2 13-10 13-16 13 33-4 60-49 60Z" fill="url(#${id}-fire)" ${line} stroke-width="4.5"/>
      <path d="M80 109C58 111 43 96 44 82c0-9 5-13 7-18-1 15 13 19 13 4 0-17 17-26 13-41 19 18 19 37 13 47 12-2 14-17 17-25 7 12 5 27 0 34 10-3 14-10 15-17 6 22-15 42-42 43Z" fill="url(#${id}-heat)"/>
      <path d="M61 95q-4-8 0-18 1 11 10 13 11-2 14-17 14 15 14 25-19 14-38-3Z" fill="#fff8b8" opacity=".8"/>
      <path d="M37 91q0 9 10 15m70-16q7-8 7-16" fill="none" stroke="#ffb044" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M48 48q-9-7-5-17 1 8 7 9Zm63-27q-5-8 0-14 0 6 5 9ZM29 69q-5-6-1-13l4 8Z" fill="#ffae31"/>
      <path d="M47 44v-6m65-19-1-5" stroke="#fff091" stroke-width="1.5" stroke-linecap="round"/>`;break;
    case 'lion': shape=`
      <defs><linearGradient id="${id}-mane" x2=".5" y2="1"><stop stop-color="#dd9847"/><stop offset=".5" stop-color="#a75b30"/><stop offset="1" stop-color="#623d30"/></linearGradient></defs>
      <path d="M79 27q10-8 19 2 14-5 19 9 16 1 15 16 13 9 5 22 9 13-6 23 1 16-17 16-9 14-23 7-12 8-23-3-16 5-23-8-18 0-17-17-13-10-4-24-6-15 8-23 0-16 17-16 9-12 21-4Z" fill="url(#${id}-mane)" ${line} stroke-width="5"/>
      <path d="M44 49q-13 5-8 18-9 8 0 17-5 12 8 17m74-52q13 5 8 18 9 8 0 17 5 12-8 17M54 36q7-3 13 3m29-2 11 5M55 106l10 9m41-8-9 9" fill="none" stroke="#e4aa61" stroke-width="2.5" stroke-linecap="round" opacity=".65"/>
      <circle cx="49" cy="50" r="10" ${paint}/><circle cx="111" cy="50" r="10" ${paint}/>
      <circle cx="49" cy="50" r="4" fill="#c68456"/><circle cx="111" cy="50" r="4" fill="#c68456"/>
      <path d="M48 71q-1-33 32-34 33 1 32 34v14q-3 26-32 26-29 0-32-26Z" ${paint}/>
      <path d="M58 88q8-17 22-9 14-8 22 9v10q-22 23-44 0Z" fill="#fff1cc"/>
      <path d="M73 82q7-5 14 0l-7 7Z" fill="${ink}"/>
      <path d="m60 89 4 1m-5 4 4 1m33-5 4-1m-3 6 4-1" stroke="#ae8653" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M77 81h5" stroke="#9d9b8e" stroke-width="1.5" stroke-linecap="round"/>
      ${glint('M58 52q7-9 17-8',3)}`;break;
    case 'diamond': shape=`
      <path d="M44 41 62 30h36l18 11 11 28-13 27-34 19-34-19-13-27Z" ${paint}/>
      <path d="m44 41 18-11-9 24-20 15Zm18-11h36l-18 24Zm36 0 18 11-9 13-27 0Z" fill="#f1ffff" opacity=".8"/>
      <path d="m33 69 20-15-7 42Zm74-15 20 15-13 27Z" fill="#80b2ef"/>
      <path d="m46 96 34-6 34 6-34 19Z" fill="#8ba8ee"/>
      <path d="m53 54 27 0 27 0 7 42-34-6-34 6Z" fill="${tone.top}" opacity=".58"/>
      <path d="m44 41 18-11 18 24-27 0Zm63 13 20 15-20 8Zm7 42-34 19 16-25Z" fill="#fff" opacity=".32"/>
      <path d="m33 69 13 27 18-8Zm74-15 7 42-18-6Z" fill="#3c69b5" opacity=".32"/>
      <path d="M55 50 79 34l-9 16Z" fill="#fff" opacity=".6"/>
      <path d="m44 41 9 13 27 0 27 0 9-13M62 30 53 54 46 96 80 115l34-19-7-42-9-24M33 69l20-15m54 0 20 15" fill="none" stroke="#f0ffff" stroke-width="1.8" opacity=".8"/>
      ${star(45,41,7)}${star(123,96,5)}`;break;
    case 'basketball': shape=`
      <defs><radialGradient id="${id}-leather" cx=".3" cy=".24" r=".85"><stop stop-color="#ffd68b"/><stop offset=".32" stop-color="${tone.top}"/><stop offset="1" stop-color="${tone.bottom}"/></radialGradient><pattern id="${id}-pebble" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.3" cy="1.3" r=".7" fill="#6e340a" opacity=".23"/><circle cx="3.8" cy="3.8" r=".65" fill="#6e340a" opacity=".18"/></pattern></defs>
      <circle cx="80" cy="72" r="41" fill="url(#${id}-leather)" ${line} stroke-width="5"/>
      <circle cx="80" cy="72" r="38" fill="url(#${id}-pebble)"/>
      <path d="M52 42q20 28-5 52m60-51q-20 28 6 53M42 57q33-16 74 0M50 99q27-15 61-1" fill="none" stroke="#512e20" stroke-width="3.2"/>
      <path d="M80 32v22m0 40v17" stroke="#512e20" stroke-width="3.1"/>
      <path d="M44 54q14-18 37-18" fill="none" stroke="#ffe6a6" stroke-width="3" stroke-linecap="round" opacity=".65"/>
      <path d="M116 69q3 32-34 39" fill="none" stroke="#8b370e" stroke-width="3" opacity=".45"/>`;break;
    case 'pickle': shape=`
      <defs><linearGradient id="${id}-brine" x1=".15" y1=".15" x2=".9" y2=".85"><stop stop-color="${tone.top}"/><stop offset=".48" stop-color="#91b940"/><stop offset="1" stop-color="${tone.bottom}"/></linearGradient></defs>
      <path d="m75 37-1-12q5-6 10-2l-1 14" fill="#648b32" ${line} stroke-width="3"/>
      <path d="M47 80q-7-8-1-13-3-14 3-20-2-9 8-10 10-14 31-7 20 3 20 21 7 5 4 15 8 12 2 20 5 10-2 16 0 13-13 13-15 10-31 0-14 0-15-12-10-4-6-13Z" fill="url(#${id}-brine)" ${line} stroke-width="5"/>
      <path d="M57 52q-9 30 5 49" fill="none" stroke="#e0f79a" stroke-width="4" stroke-linecap="round" opacity=".75"/>
      <path d="M97 42q13 18 8 40 9 26-9 27" fill="none" stroke="#365f2b" stroke-width="3" opacity=".65"/>
      ${[[56,44,3],[102,57,3],[50,73,2.5],[105,90,3],[64,103,2.5],[91,104,2.5],[81,42,2],[98,47,1.7],[57,91,2]].map(([x,y,r])=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*1.3}" fill="#568330"/><path d="M${x-r*.6} ${y-r*.5}q0-${r} ${r}-.7" fill="none" stroke="#d4ed81" stroke-width="1.3" stroke-linecap="round"/>`).join('')}
      <path d="m71 108 8 2" stroke="#d1e887" stroke-width="2" stroke-linecap="round"/>`;break;
    case 'doughnut': shape=`
      <defs><linearGradient id="${id}-dough" x1=".2" y1="0" x2=".65" y2="1"><stop stop-color="#ffe3a0"/><stop offset=".55" stop-color="#e9a44d"/><stop offset="1" stop-color="#a96530"/></linearGradient><linearGradient id="${id}-icing" x1=".25" y1=".1" x2=".6" y2="1"><stop stop-color="#ffe7f1"/><stop offset=".3" stop-color="${tone.top}"/><stop offset="1" stop-color="${tone.bottom}"/></linearGradient></defs>
      <path data-material="doughnut-ring" fill-rule="evenodd" d="M122 73a42 40 0 1 1-84 0 42 40 0 1 1 84 0ZM80 61a11 10 0 1 0 0 20 11 10 0 1 0 0-20Z" fill="url(#${id}-dough)" ${line} stroke-width="4.5"/>
      <path fill-rule="evenodd" d="M42 71q-1-31 38-34 37-1 39 31l-4 9q-2 7-9 2 0 12-8 12-7 0-8-6-9 5-17 0-3 8-10 5-4-2-4-11-8 8-13 2Zm38-10a11 10 0 1 0 0 20 11 10 0 1 0 0-20Z" fill="url(#${id}-icing)" stroke="#bc5286" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M46 93q26 28 60 1" fill="none" stroke="#ffe0a0" stroke-width="2.3" stroke-linecap="round" opacity=".8"/>
      <path d="M70 66q6-8 16-4" fill="none" stroke="#9d512d" stroke-width="2.5"/>
      ${glint('M51 55q10-13 26-13',3.5)}
      ${[[52,61,4,-2,'#fff39a'],[65,49,3,4,'#57cded'],[85,45,5,1,'#fffbe6'],[99,52,-2,4,'#64d6cb'],[110,65,2,4,'#ffe370'],[94,85,4,-2,'#faf3ce'],[56,77,3,3,'#796fd6'],[103,73,4,-2,'#fff4b9'],[79,52,3,-2,'#a572d8'],[70,86,3,2,'#6ce3d3']].map(([x,y,dx,dy,c])=>`<path d="m${x} ${y} ${dx} ${dy}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`).join('')}`;break;
    default:return null;
  }
  return `<g data-part="head" data-head="${head}">${shape}</g>`;
}

/** Material-specific face details stay separate from the head and from hats. */
export function earnedFace(head:string,face:string,markup:string):string {
  if(head==='doughnut') {
    // Leave breathing room around the real doughnut hole.
    markup=markup
      .replace(/cx="66"/g,'cx="59"').replace(/cx="65"/g,'cx="58"')
      .replace(/cx="94"/g,'cx="101"').replace(/cx="93"/g,'cx="100"')
      .replace(/m88 70 6-3 6 3/g,'m95 70 6-3 6 3');
  }
  if(head==='robot') return markup.replace(/fill="#071f32"/g,'fill="#7ffff2"');
  if(head==='raccoon') markup=markup.replace(/(<g data-feature="eyes">)([\s\S]*?)(<\/g>)/,(_all,start,eyes,end)=>start+eyes.replace(/fill="#071f32"/g,'fill="#fff1cf"')+end);
  if(['raccoon','lion'].includes(head)) markup=markup.replace(/(data-feature="mouth" d="M\d+ )85/g,(_all,start)=>start+'92');
  if(face==='happy'||face==='wink'||face==='cool') {
    if(head==='vampire') markup+=`<path data-feature="fangs" d="m69 88 4 10 4-7m6 0 4 7 4-10" fill="#fff9e7" ${line} stroke-width="1.8"/>`;
    if(head==='shark') markup=markup.replace(/<path data-feature="mouth"[^>]*\/>/,`<path data-feature="mouth" d="M62 84q18 8 36 0-2 18-18 18T62 84Z" fill="${ink}"/><path d="m66 87 5 7 4-6 5 7 5-7 4 6 5-7" fill="#fffbed"/><path d="m73 98 4-5 5 6 5-5 3 3" fill="#fffbed"/>`);
  }
  return markup;
}
