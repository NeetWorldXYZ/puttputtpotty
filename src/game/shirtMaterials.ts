import { EARNABLE_SHIRTS, type EarnedShirt } from '../../server/potty/cosmeticCatalog';
const ink='#071f32';
const line=(d:string,color:string,w=2)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const star=(x:number,y:number,r:number)=>`<path d="M${x} ${y-r}l${r*.3} ${r*.65} ${r*.7} ${r*.1}-${r*.5} ${r*.5} ${r*.15} ${r*.75}-${r*.65}-${r*.35}-${r*.65} ${r*.35} ${r*.15}-${r*.75}-${r*.5}-${r*.5} ${r*.7}-${r*.1}Z" fill="#ffecb3"/>`;
export function shirtMaterial(key:string,id:string):string {
  if(!Object.prototype.hasOwnProperty.call(EARNABLE_SHIRTS,key))return '';
  const gear=EARNABLE_SHIRTS[key as EarnedShirt],a=gear.accent;
  let art='';
  switch(key){
    case 'varsity':art=`<path d="M48 110 41 155 13 146 32 120Zm64 0 7 45 28-9-19-26Z" fill="${a}"/>${line('M80 108v54','#153b61',4)}${[122,136,149].map(y=>`<circle cx="80" cy="${y}" r="1.5" fill="#f5df9f"/>`).join('')}${line('M48 150 64 143m33 0 14 7','#163e61',3)}<path d="M49 131v-11h8l5 3-1 4-4 3h-4v7h-4Z" fill="${a}"/>${line('M41 155q39 10 78 0',a,5)}`;break;
    case 'ranger':art=`<path d="m55 103 15 8-4 51-21-3 2-27-10 17-15-7 12-20Zm50 0-15 8 4 51 21-3-2-27 10 17 15-7-12-20Z" fill="${a}"/><path d="M47 131h19v19H47Zm47 0h19v19H94Z" fill="#bcac75" stroke="#486955" stroke-width="2"/><path d="m47 131 9 6 10-6m28 0 9 6 10-6" fill="none" stroke="#486955" stroke-width="2"/><path d="M74 114h12v48H74Z" fill="#365e55"/>${line('M80 116v41','#e6d6a3',1.5)}`;break;
    case 'wave':art=`<path d="M13 140q10-22 23-11t24-4 25 3 26-6 25 6 20-9v48H13Z" fill="#097b9f"/><path d="M22 145q8-20 23-8t23-2 22-4 23 5 21-1v32H22Z" fill="${a}"/><path d="M25 155q16-19 34-7t22-3 31 3 28-9v30H25Z" fill="#2c9fbc"/>${line('M42 135q3-8 12-5m32 11q6-10 15-5',a,3)}<circle cx="52" cy="119" r="5" fill="#fff3b3"/>`;break;
    case 'tour':art=`<path d="M16 131h130v12H16Z" fill="${a}"/><path d="M16 145h130v4H16Z" fill="#64bbcf"/>${line('M80 108v20',a,2)}<circle cx="80" cy="116" r="1.2" fill="${ink}"/><circle cx="80" cy="123" r="1.2" fill="${ink}"/>${line('m23 142 16 8m83 0 16-8',a,5)}`;break;
    case 'cosmic':art=`<path d="M15 169q20-42 68-40t68-17v18q-24 18-56 13t-47 26Z" fill="#8366ba"/><path d="M18 159q34-26 59-19t59-20" fill="none" stroke="#a4b8fa" stroke-width="4"/>${[[42,125,4],[66,138,3],[96,146,4],[114,121,3],[119,153,2],[49,151,2]].map(([x,y,r])=>star(x,y,r)).join('')}<circle cx="67" cy="118" r="2" fill="#dce5ff"/>`;break;
    case 'bones':art=`${line('M80 118v36',a,4)}${[123,132,141].map((y,i)=>line(`M75 ${y}q${-15+i*2} 9-19 0m29 0q${15-i*2} 9 19 0`,a,3)).join('')}${line('m38 125-11 17m97-17 10 17',a,4)}<circle cx="38" cy="125" r="3" fill="${a}"/><circle cx="125" cy="125" r="3" fill="${a}"/>`;break;
    case 'wild':art=`${['M21 127 49 123 38 132 44 135 18 139Z','M47 112 63 122 56 120 64 131 46 125Z','M75 106 87 118 76 126 80 135 66 124 73 117Z','M108 112 99 140 108 134 109 149 117 128Z','M128 128 119 136 128 138 140 134Z','M39 147 69 141 64 151 80 157 54 155Z','M84 149 94 144 91 162 84 161Z'].map(d=>`<path d="${d}" fill="${a}"/>`).join('')}`;break;
    case 'inferno':art=`<path d="M38 168q-8-22 14-36-3 14 5 16 1-21 13-24-3 19 7 25 5-12 3-19 17 11 15 26 8-3 11-21 18 14 11 33Z" fill="#f05431"/><path d="M46 169q-2-17 8-23 0 9 9 13 0-16 7-21 0 18 10 22 7-5 8-12 9 10 8 17 9-3 12-13l4 17Z" fill="#ffbd48"/>${line('m28 142 8-13m91 13-6-12','#ffba52',4)}`;break;
    case 'sprinkles':art=`<path d="M13 110h135v24q-8 2-11-5-2 17-9 15-7-1-7-16-5 12-12 5-6-12-12 1-6 15-12 0-5-9-11 2-8 9-13-4-6-11-11 2-9 15-13-4-7 8-13-3-6 9-12 5Z" fill="${a}"/>${[[37,124,4,-2],[59,117,2,4],[84,127,4,-1],[110,119,3,4],[126,128,-2,4],[52,146,4,2],[77,151,2,-4],[103,143,3,2],[116,153,-3,2]].map(([x,y,dx,dy],i)=>line(`M${x} ${y}l${dx} ${dy}`,['#e665a0','#658ee5','#46ba9a'][i%3],2.5)).join('')}`;break;
    case 'circuit':art=`<path d="m47 112 18 7 2 21-11 7-10-10Zm66 0-18 7-2 21 11 7 10-10Z" fill="#386b80"/>${line('M80 117v45M49 119v11l10 7v18m51-36v11l-10 7v18m-67-28 7 11m88-11-7 11',a,2)}${[[59,154],[100,154],[80,145],[49,119],[110,119]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.8" fill="${a}"/><circle cx="${x}" cy="${y}" r="1" fill="#fff"/>`).join('')}`;break;
    case 'dragonscale':art=`${Array.from({length:30},(_,i)=>{const x=43+(i%6)*13+(Math.floor(i/6)%2)*6,y=113+Math.floor(i/6)*11;return `<path d="M${x} ${y}q6-5 12 0l-2 5-4 4-4-4Z" fill="${i%3?'#c44b51':'#e1785c'}" stroke="#742e49" stroke-width="1"/>`;}).join('')}<path d="M28 123 44 113 46 127 34 135Zm104 0-16-10-2 14 12 8Z" fill="${a}" stroke="#794837" stroke-width="2"/>${line('M80 112v50',a,3)}`;break;
    case 'monarch':art=`<path d="m48 106 24 10-16 45-15-4 4-25-12 18-13-8 14-21Zm64 0-24 10 16 45 15-4-4-25 12 18 13-8-14-21Z" fill="#442b76"/><path d="m54 107 18 9-10 14-11-6Zm52 0-18 9 10 14 11-6Z" fill="#fff3d9"/>${line('M70 121 58 159m32-38 12 38M42 157q38 11 76 0',a,3)}${[[55,115],[60,120],[104,115],[99,120]].map(([x,y])=>`<path d="m${x} ${y} 2 4-4-1Z" fill="${ink}"/>`).join('')}<path d="m76 118 4 4 4-4-4-4Z" fill="#8df3e7" stroke="${a}" stroke-width="2"/>`;break;
    case 'champion':art=`<path d="M20 139 47 114 56 125 36 153Zm120 0-27-25-9 11 20 28Z" fill="${a}"/><path d="M65 111h30l-4 14H69Z" fill="#fbf1d0"/>${line('M77 113 74 137m9-24 3 24',a,2)}${star(80,145,8)}${line('M61 139q-8 9 4 16m34-16q8 9-4 16',a,2)}${line('M59 143l6 2m-5 5 6 1m35-8-6 2m5 5-6 1',a,2)}`;break;
  }
  return `<g data-shirt-material="${key}" clip-path="url(#${id}-garment)">${art}</g>`;
}
export function tailoredCollar(key:string,id:string):string|null {
  if(key==='monarch'||key==='ranger'||key==='champion')return `<path d="m67 108 13 9 13-9" fill="none" stroke="${ink}" stroke-width="3"/>`;
  if(key==='tour')return `<path d="m60 105 20 10-9 11-14-17m43-4-20 10 9 11 14-17" fill="#fff8e4" stroke="${ink}" stroke-width="2.5"/>`;
  if(key==='varsity')return `<path d="M57 104q23 18 46 0l-3 10q-20 14-40 0Z" fill="#fff0c5" stroke="${ink}" stroke-width="3"/><path d="M60 108q20 16 40 0" fill="none" stroke="#286fb7" stroke-width="2"/>`;
  if(key==='dragonscale')return `<path d="m55 106 16 7 9 10 9-10 16-7-5 13-20 12-20-12Z" fill="url(#${id}-gold)" stroke="${ink}" stroke-width="3"/>`;
  return null;
}
