/** Hand-drawn vector accessories, shared by the picker and every avatar pose. */
const ink='#071f32';
const outline=`stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const path=(d:string,fill:string,extra='')=>`<path d="${d}" fill="${fill}" ${outline} ${extra}/>`;
const line=(d:string,color=ink,width=3)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const star=(x:number,y:number,r=7,color='#ffdc65')=>`<path d="M${x} ${y-r}l${r*.3} ${r*.65} ${r*.7} ${r*.1}-${r*.5} ${r*.5} ${r*.15} ${r*.75}-${r*.65}-${r*.35}-${r*.65} ${r*.35} ${r*.15}-${r*.75}-${r*.5}-${r*.5} ${r*.7}-${r*.1}Z" fill="${color}" stroke="${ink}" stroke-width="1.8"/>`;
export function extraHat(hat:string,id:string):string|null {
  const gold=`url(#${id}-gold)`;
  const art:Record<string,string>={
    visor:path('M43 36q36-13 74 0v11q-38-8-74 0Z','#f5ecd3')+path('M47 43q-32 2-30 11 18 10 58-8Z','#37b8ca')+line('M52 36q18-5 34-4','#fff',3),
    bucket:path('M51 12q29-10 58 0l8 30H43Z','#65b8aa')+path('M43 34q36 8 74 0l12 13q-47 16-98 0Z','#367f80')+line('M54 16q23-6 43-3','#b7edd0')+path('M73 19h15v13H73Z','#fff1b8'),
    cowboy:path('M51 35 56 13q8-9 24 0 17-9 24 0l7 22Z','#bd783e')+path('M24 29q4 21 32 11 25-7 49 0 29 10 31-11 11 30-55 27Q13 57 24 29Z','#dfa65b')+line('M55 32q25-6 51 0','#523929',6)+star(80,32,6),
    beanie:path('M45 40q-2-29 35-30 36 1 35 30Z','#9566d4')+line('M61 16 58 35M77 13v23m18-21 5 21','#c4a0eb',2)+`<circle cx="80" cy="8" r="7" fill="#ead8ff" ${outline}/>`+path('M43 34h74v15H43Z','#6d46a4')+path('M73 36h14v11H73Z','#ffe5a4'),
    chef:path('M53 30C31 23 38 5 56 9 61-3 77 1 81 7 94-4 109 1 109 11 129 8 130 31 111 34Z','#fff9e5')+path('M53 29q28 9 56 0v18H53Z','#dce8e4')+line('M64 31v10m14-8v9m15-10v9','#91b6bf',2),
    piratehat:path('M26 44q12-4 22-23 16-25 32-6 17-19 32 6 10 19 22 23-24 9-54-1-30 10-54 1Z','#273c56')+line('M32 42q22 0 30-19m37 0q10 16 29 19','#eac46c')+`<ellipse cx="80" cy="26" rx="9" ry="8" fill="#fff3d1"/><path d="M75 31v5h10v-5" fill="#fff3d1"/><circle cx="76" cy="25" r="2" fill="${ink}"/><circle cx="84" cy="25" r="2" fill="${ink}"/>`+line('m68 37 24 5m-24 0 24-5','#fff3d1',2),
    viking:path('M48 39Q19 40 24 8q7 17 26 12m60 0q19 5 26-12 5 32-24 31','#fff2cd')+path('M45 43q0-32 35-32t35 32Z','#8aa8ba')+path('M73 12h14v31H73Z','#d4e2e8')+path('M43 38h74v12H43Z','#586e89')+[52,66,94,108].map(x=>`<circle cx="${x}" cy="44" r="2.3" fill="#ffe495"/>`).join(''),
    wizard:path('M50 41 68 8q7-8 31-4L85 17l24 24Z','#66449e')+path('M35 44q45-16 90 0-2 12-44 10-46 2-46-10Z','#42346e')+star(76,24,6)+star(91,36,4)+line('m60 36 11-17','#a589d5',2),
    safari:path('M46 40q-2-27 33-28 32-1 35 28Z','#d7c181')+path('M39 35q41 11 82 0l13 12q-53 17-108 0Z','#b2945d')+path('M47 29q32 7 66 0v10q-30 7-66 0Z','#6e6c46')+`<circle cx="63" cy="24" r="2" fill="#756943"/><circle cx="98" cy="24" r="2" fill="#756943"/>`+line('M65 16q14-3 24 0','#fff1b8'),
    hardhat:path('M44 43q0-30 36-30t36 30Z','#ffce42')+path('M74 8h12v34H74Z','#ffe37b')+line('M55 27v12m50-12v12','#d89822',4)+path('M37 40h86v10H37Z','#e9ae2c')+line('M43 44h28','#fff4a5'),
    propeller:path('M43 44q0-30 37-30t37 30Z','#ef6964')+path('M80 14q-19 8-18 30h36q1-22-18-30Z','#68c8dd')+line('M80 13V5',ink,3)+`<ellipse cx="66" cy="5" rx="15" ry="4" fill="#ffd95b" ${outline}/><ellipse cx="94" cy="5" rx="15" ry="4" fill="#8ce493" ${outline}/>`+path('M42 40h76v10H42Z','#ffd76c'),
    party:path('M53 45 80 6 108 45Z','#ee80ae')+path('m63 31 33-4 5 9-43 3Z','#9f72d7')+`<circle cx="80" cy="7" r="5" fill="#ffe486" ${outline}/>`+star(79,20,4)+path('M47 43h66v8H47Z','#ffe486')+line('m40 15-7-4m84 5 7-8m-5 28 8 1','#63d6d0',3),
    toilethat:path('M66 5h36v22H66Z','#ecffff')+path('M61 24h49q-1 17-17 18v8H75v-9q-12-3-14-17Z','#ecffff')+`<ellipse cx="84" cy="25" rx="25" ry="6" fill="#97d8e5" ${outline}/><ellipse cx="84" cy="25" rx="14" ry="2.5" fill="${ink}"/>`+path('M48 44 55 32l12 12h38l11-12 7 14-5 8H49Z',gold)+line('M92 11h5','#60adca',3),
  };
  return art[hat] ? `<g data-earned-hat="${hat}">${art[hat]}</g>` : null;
}

export function extraFace(face:string,head:string):string|null {
  // Separate eye centers leave the doughnut's center open.
  const left=head==='doughnut'?59:66,right=head==='doughnut'?101:94,y=head==='dawg'||head==='lion'||head==='raccoon'?92:85;
  const eyes=`<g data-feature="eyes"><ellipse cx="${left}" cy="70" rx="3.6" ry="4.8" fill="${ink}"/><ellipse cx="${right}" cy="70" rx="3.6" ry="4.8" fill="${ink}"/></g>`;
  const smile=line(`M69 ${y}q11 12 22 0`).replace('<path ','<path data-feature="mouth" ');
  const grin=path(`M64 ${y-2}q16 4 32 0-1 18-16 18T64 ${y-2}Z`,'#fff8df','data-feature="mouth"')+line(`M68 ${y+5}h24`,ink,1.5);
  const hearts='<g data-feature="eyes">'+[left,right].map(x=>`<path d="M${x} 78c-21-13-8-23 0-14 8-9 21 1 0 14Z" fill="#f06b95" stroke="${ink}" stroke-width="2"/>`).join('')+'</g>';
  const closeEyes='<g data-feature="eyes">'+line(`M${left-6} 72l6-5 6 5M${right-6} 72l6-5 6 5`)+'</g>';
  const art:Record<string,string>={
    grin:eyes+grin,
    smirk:eyes+line(`M70 ${y+6}q17 3 24-9`).replace('<path ','<path data-feature="mouth" ')+line(`m${right-8} 59 13-3`),
    shocked:`<g data-feature="eyes"><circle cx="${left}" cy="70" r="6" fill="#fff7df" ${outline}/><circle cx="${right}" cy="70" r="6" fill="#fff7df" ${outline}/><circle cx="${left}" cy="70" r="2.5" fill="${ink}"/><circle cx="${right}" cy="70" r="2.5" fill="${ink}"/></g><ellipse data-feature="mouth" cx="80" cy="${y+5}" rx="6" ry="8" fill="${ink}"/>`,
    laugh:closeEyes+grin,
    tears:closeEyes+line(`M69 ${y+5}q11-7 22 0`).replace('<path ','<path data-feature="mouth" ')+[left,right].map(x=>path(`M${x-3} 76q-7 9-6 15 5 8 10 0 1-6-4-15Z`,'#62c9f0')).join(''),
    heart:hearts+smile,
    star:'<g data-feature="eyes">'+star(left,70,9)+star(right,70,9)+'</g>'+grin,
    dizzy:'<g data-feature="eyes">'+[left,right].map(x=>line(`M${x-5} 64q12-5 12 6t-12 5q-5-9 4-10t3 8q-7 1-4-4`,ink,2)).join('')+'</g>'+line(`M69 ${y+4}q5-5 10 0t11 0`).replace('<path ','<path data-feature="mouth" '),
    tongue:eyes+path(`M68 ${y-1}q12 5 24 0-1 15-12 15T68 ${y-1}Z`,ink,'data-feature="mouth"')+path(`M79 ${y+5}h10v9q-4 7-10 0Z`,'#ef8d9f')+line(`M84 ${y+8}v5`,'#b34e72',1.5),
    focused:eyes+line(`M${left-8} 60l15 5M${right+8} 60l-15 5`,ink,4)+line(`M72 ${y+5}h16`).replace('<path ','<path data-feature="mouth" ')+line('m111 53 3 8 4-5','#77d4ee',3),
    monocle:eyes+smile+`<circle cx="${right}" cy="70" r="11" fill="#b5ecf5" fill-opacity=".2" stroke="#c89541" stroke-width="3"/>`+line(`M${right+9} 76q15 6 5 25`,'#e1b658',2)+line(`M${right-5} 65l5-4`,'#fff5cf',2),
    eyepatch:eyes+line('M45 56 114 81',ink,3)+path(`M${right-10} 62h20v11q-10 12-20 0Z`,'#283e56')+smile,
    zipit:eyes+path(`M65 ${y}h30v8H65Z`,'#c2d2dd','data-feature="mouth"')+[69,75,81,87,93].map(x=>line(`M${x} ${y}v8`,ink,1.5)).join('')+path(`M96 ${y+3}h6v9h-6Z`,'#ffdc73'),
  };
  return art[face] ? `<g data-earned-face="${face}">${art[face]}</g>` : null;
}
