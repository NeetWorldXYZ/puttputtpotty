export const CARTS = [
 {id:'starter',name:'Club Cart',metric:'points',target:0,rule:'Your original ride',body:'#fffaf0',roof:'#5fae4c'},
 {id:'rolls',name:'Rolls Royce',metric:'points',target:250,rule:'Earn 250 lifetime TP',body:'#eaf8ff',roof:'#b6d3dc'},
 {id:'plunger',name:'Plunger Patrol',metric:'places',target:3,rule:'Play at 3 different map locations',body:'#f87543',roof:'#e94455'},
 {id:'bubble',name:'Bubble Buggy',metric:'dailyDays',target:5,rule:'Finish the daily on 5 different days',body:'#64e1e5',roof:'#cba9ff'},
 {id:'royal',name:'Royal Flush',metric:'rankedWins',target:10,rule:'Win 10 ranked matches',body:'#7653c9',roof:'#ffdc69'},
 {id:'hotseat',name:'Hot Seat',metric:'aces',target:15,rule:'Make 15 lifetime aces',body:'#24354c',roof:'#ff923c'},
 {id:'gold',name:'Golden Throne',metric:'points',target:3000,rule:'Earn 3,000 lifetime TP',body:'#ffce46',roof:'#fff09b'},
] as const;
export interface CartGarage {selected:string;unlocked:string[];stats:Record<string,number>}
/** Trusted catalog-only SVG, shared by the map marker and the garage. */
export function cartSvg(id:string):string {
 const c=CARTS.find(c=>c.id===id)??CARTS[0];
 let accessory='';
 if(c.id==='rolls')accessory='<rect x="13" y="2" width="36" height="10" rx="4" fill="#fffaf0"/><ellipse cx="17" cy="7" rx="4" ry="5" fill="#dfeced"/><ellipse cx="17" cy="7" rx="1.5" ry="2" fill="#203448"/><path d="M24 12v5h13v-5" fill="#fffaf0"/>';
 if(c.id==='plunger')accessory='<path d="M9 19V3" stroke="#dca553" stroke-width="4"/><path d="M3 20q6-13 12 0Z" fill="#e94455"/>';
 if(c.id==='bubble')accessory='<path d="M13 27q3 13 42 3l3-8H13Z" fill="#dbffff"/><g fill="#b9faff" stroke="#28798f" stroke-width="1.5"><circle cx="7" cy="10" r="5"/><circle cx="54" cy="13" r="4"/><circle cx="4" cy="25" r="3"/></g>';
 if(c.id==='royal'||c.id==='gold')accessory='<path d="m23 25-2-8 6 4 5-7 5 7 6-4-2 8Z" fill="#ffdf61"/><path d="M5 20h8v-9H4v7m1 4q0 7 9 7v-7Z" fill="#fff8dc"/>';
 if(c.id==='hotseat')accessory='<path d="M25 31q-5-5 1-10l2 5q5-5 4-10 10 9 6 15Z" fill="#ff6835"/><path d="M29 31q-2-4 4-8 0 5 3 8" fill="#ffe278"/>';
 return `<svg viewBox="0 0 64 48" aria-hidden="true"><ellipse cx="32" cy="44" rx="25" ry="3" fill="#001b3040"/><g stroke="#182e43" stroke-width="2.5" stroke-linejoin="round"><rect x="4" y="16" width="10" height="16" rx="4" fill="#ff813d"/><path d="M7 16V9m4 7V8"/><path d="M12 32V23q0-5 5-5h23l6 8h10q4 0 4 4v5H12Z" fill="${c.body}"/><path d="M15 29h43" stroke="#ffffff" stroke-opacity=".4"/><rect x="21" y="12" width="13" height="7" rx="3" fill="#4db8ff"/><path d="M18 8v10m28-10v18"/><rect x="14" y="2" width="36" height="6" rx="3" fill="${c.roof}"/>${accessory}</g><circle cx="22" cy="36" r="7" fill="#182e43"/><circle cx="50" cy="36" r="7" fill="#182e43"/><circle cx="22" cy="36" r="3" fill="${c.roof}"/><circle cx="50" cy="36" r="3" fill="${c.roof}"/><circle cx="58" cy="29" r="2" fill="#fff2a3"/></svg>`;
}
