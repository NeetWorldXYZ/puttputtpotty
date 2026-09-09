import type { Avatar, BallLook } from './avatarParts';

const INK = '#071f32';
type Tone = {top:string;bottom:string};
const cleanId = (id:string) => 'look-'+id.replace(/[^a-zA-Z0-9_-]/g,'');
const stroke = `stroke="${INK}" stroke-linejoin="round" stroke-linecap="round"`;

function defs(id:string,tone:Tone,shirt:string):string {
  return `<defs>
    <linearGradient id="${id}-skin" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="${tone.top}"/><stop offset=".66" stop-color="${tone.top}"/><stop offset="1" stop-color="${tone.bottom}"/></linearGradient>
    <linearGradient id="${id}-shirt" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="${shirt}"/><stop offset="1" stop-color="${shirt}"/></linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#fff09a"/><stop offset=".45" stop-color="#ffd643"/><stop offset="1" stop-color="#e59a21"/></linearGradient>
    <linearGradient id="${id}-red" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#ff6972"/><stop offset=".55" stop-color="#ff334f"/><stop offset="1" stop-color="#c8223c"/></linearGradient>
    <linearGradient id="${id}-hat" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#315269"/><stop offset=".5" stop-color="#163348"/><stop offset="1" stop-color="#071b2e"/></linearGradient>
  </defs>`;
}

function shirtSvg(key:string,id:string):string {
  const outline='M52 107 Q80 98 108 107 L129 123 L142 144 L124 152 L115 136 L118 158 Q80 167 42 158 L45 136 L36 152 L18 144 L31 123 Z';
  const pizza=key==='wood';
  return `<g data-part="shirt">
    <clipPath id="${id}-garment"><path d="${outline}"/></clipPath>
    <path d="${outline}" fill="url(#${id}-shirt)" ${stroke} stroke-width="6"/>
    ${pizza?`<g clip-path="url(#${id}-garment)" fill="#ef4736" stroke="#d42b30" stroke-width="1.3">${[[36,121,7],[61,114,6],[91,112,7],[121,130,6],[54,144,7],[84,156,6],[110,148,7],[26,147,5],[80,130,5]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`:''}
    <path d="M111 112l14 16 10 15-10 4-12-18 1 25q-34 8-68 0l-1 4q35 10 73 0l-3-22 9 16 18-8-13-21Z" fill="${INK}" opacity=".17"/>
    <path d="M49 118l-12 11-8 12" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="4" stroke-linecap="round"/>
    ${pizza?`<path d="m60 108 20 9-11 12-14-19m45-2-20 9 11 12 14-19" fill="#ffe99c" ${stroke} stroke-width="3"/><path d="M80 118v24" stroke="#bf7930" stroke-width="2"/><circle cx="80" cy="131" r="1.6" fill="${INK}"/>`:`<path d="M53 112Q45 99 61 99h38q16 0 8 13l-27 8Z" fill="url(#${id}-shirt)" ${stroke} stroke-width="4"/><path d="m57 104 23 11 23-11" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/><path d="m67 115-2 12m28-12 2 12" stroke="${INK}" stroke-width="2.5"/><path d="M66 147q14 6 28 0l2 9H64Z" fill="${INK}" opacity=".08"/>`}
    <path d="M88 134L86 121L93 126L98 118L103 126L110 121L108 134Z" fill="url(#${id}-gold)" ${stroke} stroke-width="2.5"/>
    <path d="M91 131h15" stroke="#fff6b9" stroke-width="1.5"/>
  </g>`;
}

function headSvg(head:string,tone:Tone,id:string):string {
  const paint=`fill="url(#${id}-skin)" ${stroke} stroke-width="6"`;
  let shape='';
  switch(head){
    case 'roll': shape=`<path d="M109 80q17 8 13 19l10 5q-8 15-22 7l-10-19" ${paint}/><path d="M43 38v59q0 14 37 14t37-14V38Z" ${paint}/><path d="M104 46v57q8-1 10-7V46" fill="${tone.bottom}" opacity=".62"/><path d="M50 52v39" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/><path d="M113 56v36" stroke="${INK}" stroke-opacity=".3" stroke-width="1.3" stroke-dasharray="3 4"/><ellipse cx="80" cy="38" rx="37" ry="12" fill="#fff8e7" ${stroke} stroke-width="5"/><ellipse cx="80" cy="38" rx="23" ry="7" fill="none" stroke="${tone.bottom}" stroke-width="2"/><ellipse cx="80" cy="38" rx="13" ry="4.5" fill="${INK}"/><path d="M118 105q4 3 8 2" stroke="#fff" stroke-width="2" fill="none"/>`;break;
    case 'turd': shape=`<path d="M41 109c-14 0-17-16-3-24-8-12 1-24 15-26-4-12 10-21 25-20 9-2 8-11 5-16 17 0 27 14 18 23 12 3 18 14 12 23 14 6 15 18 5 25 13 7 10 19-5 19Z" ${paint}/><path d="M44 91q15-4 28-3m36-15q-9-4-18-3M59 58q10-5 20-4" fill="none" stroke="${tone.bottom}" stroke-width="6" stroke-linecap="round"/><path d="M39 100q23 13 73 4" fill="none" stroke="${tone.bottom}" stroke-width="5" opacity=".55"/><path d="M87 29q8 4 6 9M54 65l-5 5M40 96l3-1" stroke="#fff2d8" stroke-opacity=".38" stroke-width="3" fill="none" stroke-linecap="round"/>`;break;
    case 'alien': shape=`<path d="m58 38-9-15m53 15 9-15" fill="none" ${stroke} stroke-width="5"/><circle cx="47" cy="20" r="7" ${paint}/><circle cx="113" cy="20" r="7" ${paint}/><circle cx="45" cy="18" r="2" fill="#ecffc6"/><circle cx="111" cy="18" r="2" fill="#ecffc6"/><path d="M80 30c-45 0-48 33-36 55 8 16 26 26 36 26s28-10 36-26c12-22 9-55-36-55Z" ${paint}/><path d="M55 46q9-7 18-8" stroke="#fff" stroke-opacity=".4" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M111 60q7 24-23 42" stroke="${tone.bottom}" stroke-width="6" stroke-opacity=".45" fill="none" stroke-linecap="round"/>`;break;
    case 'dawg': shape=`<path d="M50 40Q29 31 27 51q-3 28 18 29l12-26m53-14q21-9 23 11 3 28-18 29l-12-26" fill="${tone.bottom}" ${stroke} stroke-width="5"/><path d="M37 46q-6 10 0 21m88-21q6 10 0 21" stroke="#e9b486" stroke-width="3" opacity=".6" fill="none" stroke-linecap="round"/><path d="M80 33q-35 0-38 30l-1 22q2 24 39 25 37-1 39-25l-1-22q-3-30-38-30Z" ${paint}/><path d="M79 35q-9 12-6 33l-14 8q-9 4-8 16 3 18 29 19 26-1 29-19 1-12-8-16l-14-8q3-21-6-33Z" fill="#fff2d7"/><path d="M52 51q8-6 15-6" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="80" cy="82" rx="8" ry="5.5" fill="${INK}"/><ellipse cx="78" cy="80" rx="2.5" ry="1.3" fill="#6b8390"/>`;break;
    default: shape=`<circle cx="80" cy="71" r="39" ${paint}/><path d="M103 44a38 38 0 0 1-44 58 36 36 0 0 0 44-58Z" fill="${tone.bottom}" opacity=".34"/><path d="M57 45q11-7 22-6" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="3.5" stroke-linecap="round"/>`;
  }
  return `<g data-part="head" data-head="${head}">${shape}</g>`;
}

function faceSvg(face:string,head='classic'):string {
  const eyes=`<g data-feature="eyes"><ellipse cx="66" cy="70" rx="3.6" ry="4.8" fill="${INK}"/><ellipse cx="94" cy="70" rx="3.6" ry="4.8" fill="${INK}"/><circle cx="65" cy="68" r="1" fill="#fff"/><circle cx="93" cy="68" r="1" fill="#fff"/></g>`;
  const mouthY=head==='dawg'?92:85;
  const smile=`<path data-feature="mouth" d="M68 ${mouthY}q12 13 24 0" fill="none" ${stroke} stroke-width="3.8"/>`;
  let art=eyes+smile;
  if(face==='cool')art=`<g data-feature="eyes"><path d="M52 63 h25v10q-12 12-25 0Zm31 0h25v10q-12 12-25 0Z" fill="${INK}"/><path d="M77 67h6" stroke="${INK}" stroke-width="4"/><path d="m58 66 10 0m21 0h10" stroke="#7993a0" stroke-opacity=".5" stroke-width="1.5"/></g>${smile}`;
  if(face==='wink')art=`<g data-feature="eyes"><ellipse cx="66" cy="70" rx="3.6" ry="4.8" fill="${INK}"/><circle cx="65" cy="68" r="1" fill="#fff"/><path d="m88 70 6-3 6 3" fill="none" ${stroke} stroke-width="3.5"/></g>${smile}`;
  if(face==='angry')art=`${eyes}<path d="m58 59 15 5m29-5-15 5" fill="none" ${stroke} stroke-width="3.8"/><path data-feature="mouth" d="M70 ${mouthY+5}q10-9 20 0" fill="none" ${stroke} stroke-width="3.5"/>`;
  if(face==='sleepy')art=`${eyes}<path data-feature="mustache" d="M80 84c-9-11-14 9-23-2 0 13 14 13 23 6 9 7 23 7 23-6-9 11-14-9-23 2Z" fill="${INK}"/><path data-feature="mouth" d="M74 97q6 5 12 0" fill="none" ${stroke} stroke-width="3"/>`;
  return `<g data-part="face" data-face="${face}">${art}</g>`;
}

function hatSvg(hat:string,id:string):string {
  let art='';
  if(hat==='crown')art=`<path d="M44 40 L52 16 L66 30 L80 8 L94 30 L108 16 L116 40 Z" fill="url(#${id}-gold)" ${stroke} stroke-width="5"/><path d="M50 36h60" stroke="#fff4ad" stroke-width="3"/><path d="M48 42h64v5H48Z" fill="#dca12c" ${stroke} stroke-width="3"/>${[[52,16,4],[80,8,4.5],[108,16,4]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd65b" ${stroke} stroke-width="2.5"/><circle cx="${x-1}" cy="${y-1}" r="1.1" fill="#fff9bd"/>`).join('')}`;
  if(hat==='cap')art=`<path d="M42 43Q39 8 79 7q40 0 39 36l-8 5-28-3-37 7Z" fill="url(#${id}-red)" ${stroke} stroke-width="5"/><path d="M78 10q-8 10-6 30m27-27q8 13 8 28" fill="none" stroke="#a9243b" stroke-width="2.5"/><path d="M53 21q5-6 10-7" stroke="#ffabb0" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M83 42v-8q13-13 24 0v10Z" fill="#0e3549" ${stroke} stroke-width="3.5"/><path d="M87 39h16" stroke="#ff7a86" stroke-width="2"/><path d="M45 40q-29 4-26 17 12 7 40-11Z" fill="#f73452" ${stroke} stroke-width="4"/><path d="M79 5h7" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if(hat==='tophat')art=`<path d="M56 2q24-7 48 0l-2 37H58Z" fill="url(#${id}-hat)" ${stroke} stroke-width="4"/><path d="M59 27h43v10H59Z" fill="#fb3e53"/><ellipse cx="80" cy="39" rx="37" ry="7" fill="url(#${id}-hat)" ${stroke} stroke-width="4"/><path d="M61 5q6-2 11-2l-1 22h-8Z" fill="#678798" opacity=".25"/>`;
  if(hat==='plunger')art=`<path d="M77 29 83 0q4-2 7 2l-6 29" fill="#d86c38" ${stroke} stroke-width="3.5"/><path d="m82 22 3-16" stroke="#ffba76" stroke-width="2"/><path d="M59 40q1-17 20-17t22 17" fill="url(#${id}-red)" ${stroke} stroke-width="4"/><ellipse cx="80" cy="41" rx="27" ry="6" fill="#dd3e33" ${stroke} stroke-width="4"/><path d="M66 34q3-7 9-7" stroke="#ffb387" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  if(hat==='halo')art=`<ellipse cx="80" cy="16" rx="31" ry="9" fill="none" stroke="${INK}" stroke-width="8"/><ellipse cx="80" cy="16" rx="31" ry="9" fill="none" stroke="url(#${id}-gold)" stroke-width="5"/><path d="M58 11q19-8 35-2" fill="none" stroke="#fffac1" stroke-width="2" stroke-linecap="round"/>`;
  return `<g data-part="hat" data-hat="${hat}"${hat==='tophat' || hat==='plunger' ? ' transform="translate(0 5)"' : ''}>${art}</g>`;
}

function ballSvg(look:BallLook,cx:number,cy:number,r:number,id:string):string {
  const dimplePositions=[[-.52,-.22],[-.18,-.5],[.18,-.64],[.5,-.44],[-.67,.14],[-.32,.04],[.04,-.12],[.38,-.02],[.68,.12],[-.46,.43],[-.08,.3],[.26,.32],[.51,.49],[-.12,.66],[.2,.65]];
  let detail=dimplePositions.map(([x,y])=>`<circle cx="${cx+x*r}" cy="${cy+y*r}" r="${r*.12}" fill="${look.accent}" opacity=".68"/><path d="M${cx+(x-.085)*r} ${cy+(y+.055)*r}q${r*.08} ${r*.09} ${r*.17} 0" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="${r*.035}"/>`).join('');
  if(look.pattern==='stripe')detail+=`<rect x="${cx-r}" y="${cy-r*.28}" width="${r*2}" height="${r*.56}" fill="${look.accent}"/>`;
  if(look.pattern==='dots')detail+=dimplePositions.filter((_,i)=>i%3===0).map(([x,y])=>`<circle cx="${cx+x*r}" cy="${cy+y*r}" r="${r*.18}" fill="${look.accent}"/>`).join('');
  if(look.motif==='eight')detail=`<circle cx="${cx}" cy="${cy+r*.12}" r="${r*.51}" fill="#fff7e4"/><text x="${cx}" y="${cy+r*.4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${r*.82}" font-weight="900" fill="${INK}">8</text>`;
  if(look.motif==='fire')detail=`<g transform="translate(${cx-r} ${cy-r}) scale(${r/50})"><path d="M49 10c4 23-25 27-14 47-2-9-8-15-15-16-13 34 9 50 30 50 31 0 42-30 25-48 0 14-6 14-9 18 8-25-7-37-17-51Z" fill="#ffd145"/><path d="M51 43c2 13-14 17-11 29-3-4-6-7-9-7 0 17 13 23 23 20 15-5 16-17 8-29 0 10-5 10-5 10 2-10-2-17-6-23Z" fill="#fff3a1"/></g>`;
  return `<g data-part="ball"><defs><clipPath id="${id}-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><radialGradient id="${id}-sphere" cx=".3" cy=".24" r=".8"><stop stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".4"/></radialGradient></defs><circle data-ball-outline="true" cx="${cx}" cy="${cy}" r="${r}" fill="${look.color}" ${stroke} stroke-width="${r*.12+1.2}"/><g clip-path="url(#${id}-clip)">${detail}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-sphere)"/><ellipse cx="${cx-r*.36}" cy="${cy-r*.48}" rx="${r*.19}" ry="${r*.13}" transform="rotate(-30 ${cx-r*.36} ${cy-r*.48})" fill="#fff" opacity=".8"/></g></g>`;
}

export function renderAvatarArt(av:Avatar,tone:Tone,shirt:string,ball:BallLook,rawId:string):string {
  const id=cleanId(rawId);
  return defs(id,tone,shirt)+shirtSvg(av.seat,id)+headSvg(av.head,tone,id)+faceSvg(av.face,av.head)+hatSvg(av.hat,id)+ballSvg(ball,133,147,14,id);
}

/** Part cards isolate the choice. Head and colour cards always have a neutral face. */
export function renderAvatarPart(av:Avatar,part:keyof Avatar,tone:Tone,shirt:string,ball:BallLook,rawId:string):{markup:string;viewBox:string} {
  const id=cleanId(rawId),base=defs(id,tone,shirt);
  if(part==='seat')return {markup:base+shirtSvg(av.seat,id),viewBox:'10 96 140 76'};
  if(part==='hat') {
    const frames:Record<string,string>={none:'47 -5 66 66',crown:'37 -1 86 56',cap:'12 -2 112 65',tophat:'36 -5 88 65',plunger:'48 -4 64 62',halo:'42 -9 76 50'};
    return {markup:base+(av.hat==='none'?`<g stroke="#e7f2e8" stroke-width="6" fill="none"><circle cx="80" cy="28" r="23"/><path d="m64 12 32 32"/></g>`:hatSvg(av.hat,id)),viewBox:frames[av.hat]};
  }
  if(part==='ball')return {markup:ballSvg(ball,50,50,40,id),viewBox:'0 0 100 100'};
  if(part==='face')return {markup:base+headSvg('classic',tone,id)+faceSvg(av.face),viewBox:'35 26 90 90'};
  return {markup:base+headSvg(av.head,tone,id)+faceSvg('happy',av.head),viewBox:av.head==='classic'?'35 26 90 90':'20 11 120 107'};
}
