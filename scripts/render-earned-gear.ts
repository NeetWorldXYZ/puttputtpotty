import { EARNABLE_BALLS,EARNABLE_SHIRTS } from '../server/potty/cosmeticCatalog';
import { DEFAULT_AVATAR,avatarPartSvg,avatarSvg } from '../src/game/avatarParts';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
export function gearSheet(slot:'ball'|'seat'):string {
  const catalog=slot==='ball'?EARNABLE_BALLS:EARNABLE_SHIRTS;
  const cards=Object.entries(catalog).map(([key,item],i)=>{
    const x=24+(i%4)*268,y=144+Math.floor(i/4)*258;
    const look={...DEFAULT_AVATAR,[slot]:key,seat:slot==='seat'?key:'ink',hat:'crown'};
    const part=avatarPartSvg(look,slot,'sheet-'+key);
    const metric={points:'TP',rankedWins:'RANKED WINS',places:'MAP LOCATIONS',dailyDays:'DAILY COURSE DAYS',aces:'LIFETIME ACES'}[item.metric];
    return `<g transform="translate(${x} ${y})"><rect width="250" height="242" rx="20" fill="url(#card)" stroke="#286681" stroke-width="2"/><text x="16" y="24" fill="#87b7c7" font-size="10">${String(i+1).padStart(2,'0')} / 13</text><svg x="21" y="${slot==='seat'?44:30}" width="${slot==='seat'?208:170}" height="${slot==='seat'?127:153}" viewBox="${part.viewBox}">${part.markup}</svg>${slot==='seat'?`<svg x="179" y="125" width="59" height="64" viewBox="0 0 160 170">${avatarSvg(look,'mini-'+key)}</svg>`:''}<text x="18" y="198" fill="#fff4da" font-size="20" font-weight="bold">${esc(item.label)}</text><text x="18" y="223" fill="#ffdf78" font-size="11" font-weight="bold">${item.target.toLocaleString()} ${metric}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1214" viewBox="0 0 1100 1214"><defs><linearGradient id="card" x2="1" y2="1"><stop stop-color="#153f54"/><stop offset="1" stop-color="#062338"/></linearGradient></defs><rect width="1100" height="1214" fill="#041a2c"/><g font-family="DejaVu Sans,sans-serif"><text x="30" y="37" fill="#7edbea" font-size="12" letter-spacing="3">PUTT PUTT POTTY / EARNED COLLECTION</text><text x="28" y="86" fill="#ffdf6f" font-size="40" font-weight="bold">${slot==='ball'?'SWEET ROLLS.':'SHARP THREADS.'}</text><text x="30" y="117" fill="#b8d4df" font-size="15">13 new ${slot==='ball'?'balls':'shirts'} · Permanent unlocks · No TP spent</text>${cards}<text x="30" y="1194" fill="#83abbc" font-size="12">Actual game artwork. Existing choices remain free. No changes to gameplay.</text></g></svg>`;
}
