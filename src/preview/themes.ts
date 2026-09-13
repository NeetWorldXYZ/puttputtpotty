export const BATH_THEMES = [
  {id:'royal',name:'Royal Restroom',tag:'PORCELAIN & GOLD',desc:'Paper bumpers. Plush mats. Royal flushes.',color:'#ffd264',floor:'#16728b',light:'#41b8c8',wall:'#fff0ca',trim:'#dca338',legacy:'luxuryHotel',tile:0,icon:'crown'},
  {id:'roadside',name:'Roadside Relief',tag:'THE PIT STOP',desc:'Gum, puddles and a questionable drain.',color:'#ff9860',floor:'#a9c885',light:'#d5e6a2',wall:'#efebd3',trim:'#dc6a42',legacy:'gasStation',tile:1,icon:'plunger'},
  {id:'locker',name:'Locker Room',tag:'HOME ADVANTAGE',desc:'Vents, fast tiles and the loudest crowd.',color:'#70d6fb',floor:'#398e98',light:'#6dc7c4',wall:'#dceaf1',trim:'#458daf',legacy:'stadium',tile:2,icon:'vent'},
  {id:'night',name:'After Hours',tag:'NEON FLUSH',desc:'Glowing pipes. Slippery shortcuts.',color:'#dba1ff',floor:'#63479c',light:'#a175d7',wall:'#e1d8f4',trim:'#c586fa',legacy:'diveBar',tile:3,icon:'pipe'},
  {id:'porta',name:'Porta Party',tag:'ROUGH AROUND THE EDGES',desc:'Plastic walls. Big plungers. Bigger laughs.',color:'#6ce1b6',floor:'#5b9891',light:'#92c4a8',wall:'#b5dace',trim:'#3d9b88',legacy:'portaPotty',tile:4,icon:'soap'},
  {id:'space',name:'Orbital Outhouse',tag:'MISSION: FLUSH',desc:'Air vents, pressure gates and transport tubes.',color:'#a5e2ff',floor:'#466b93',light:'#76a9c8',wall:'#f4f0df',trim:'#61c4e9',legacy:'spaceship',tile:5,icon:'toilet'},
] as const;
export type BathThemeId=typeof BATH_THEMES[number]['id'];
export function bathTheme(id?:string){return BATH_THEMES.find(t=>`bath-${t.id}`===id||t.id===id)??BATH_THEMES[0];}
export const themeByKey=(id:string)=>bathTheme(id);
