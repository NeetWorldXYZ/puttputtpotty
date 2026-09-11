// Local visual QA: actual game vectors, including the smallest shared portraits.
import { avatarSvg, avatarPartSvg, DEFAULT_AVATAR } from '../src/game/avatarParts';
import { EARNABLE_HEADS } from '../src/game/earnedHeads';
const labels=['LEVEL 4 · 450 TP','10 RANKED WINS','5 MAP LOCATIONS','10 DAILY COURSE DAYS','25 LIFETIME ACES','LEVEL 8 · 1,750 TP','15 MAP LOCATIONS','50 RANKED WINS','HOLD 5 THRONES','LEVEL 12 · 3,850 TP','25 RANKED WINS','10 MAP LOCATIONS','20 DAILY COURSE DAYS'];
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
export function reviewSheet(spotlight=false) {
  const keys=Object.keys(EARNABLE_HEADS) as (keyof typeof EARNABLE_HEADS)[];
  const list=spotlight?(['flame','basketball','pickle','doughnut'] as const):keys;
  const columns=spotlight?4:5, rows=Math.ceil(list.length/columns), width=columns*254+50, height=195+rows*385+65;
  const cards=list.map((head,i)=>{
    const h=EARNABLE_HEADS[head],lastRow=Math.floor(i/columns)===rows-1,count=lastRow?list.length-(rows-1)*columns:columns;
    const x=28+(i%columns)*254+(columns-count)*127,y=195+Math.floor(i/columns)*385;
    const av={...DEFAULT_AVATAR,head,seat:h.shirt},part=avatarPartSvg(av,'head',`sheet-${head}`);
    return `<g transform="translate(${x} ${y})"><rect width="238" height="365" rx="22" fill="#082c43" stroke="#367a95" stroke-width="2"/><text x="16" y="25" fill="#98c7d5" font-size="10" letter-spacing="1">${keys.indexOf(head)>9?'NEW ADDITION':'POLISHED EDITION'}</text><svg x="22" y="32" width="194" height="184" viewBox="20 4 120 124">${part.markup}</svg><text x="119" y="239" text-anchor="middle" font-weight="bold" font-size="18" fill="#ffedb9">${escape(h.label)}</text><text x="119" y="262" text-anchor="middle" font-size="10" fill="#99bcc9">${labels[keys.indexOf(head)]}</text><path d="M20 280h198" stroke="#46778b"/><svg x="38" y="289" width="53" height="56" viewBox="0 0 160 170">${avatarSvg(av,'mini-'+head)}</svg><svg x="102" y="289" width="53" height="56" viewBox="0 0 160 170">${avatarSvg({...av,hat:'crown',face:'cool'},'crown-'+head)}</svg><svg x="167" y="289" width="53" height="56" viewBox="0 0 160 170">${avatarSvg({...av,hat:'cap'},'cap-'+head)}</svg></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="sheet-bg" x2=".5" y2="1"><stop stop-color="#14516e"/><stop offset="1" stop-color="#021b2d"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#sheet-bg)"/><g font-family="DejaVu Sans,Arial,sans-serif"><text x="${width/2}" y="47" text-anchor="middle" font-size="12" letter-spacing="4" fill="#96d9e7">PUTT PUTT POTTY · THE EARNED COLLECTION</text><text x="${width/2}" y="105" text-anchor="middle" font-size="${spotlight?32:40}" font-weight="bold" fill="#fff3d1">${spotlight?'MORE HEAT. MORE PERSONALITY.':'13 HEADS. A LITTLE MORE ATTITUDE.'}</text><text x="${width/2}" y="139" text-anchor="middle" font-size="15" fill="#b1d5df">${spotlight?'Redrawn Hot Head + basketball, pickle &amp; doughnut':'Sharpened materials · Separate hats &amp; expressions · Actual vector game art'}</text>${cards}<text x="${width/2}" y="${height-28}" text-anchor="middle" font-size="12" fill="#b8cfd8">ARTWORK REVIEW · Unlock requirements are planned, not active. Production is unchanged.</text></g></svg>`;
}
