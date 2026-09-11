/** Shared cosmetic catalog. These values never affect a shot, score, or TP award. */
export type GearMetric = 'points' | 'rankedWins' | 'places' | 'dailyDays' | 'aces';
export interface GearReward { label:string; metric:GearMetric; target:number; requirement:string; color:string; accent:string }
export const EARNABLE_BALLS = {
  pearl: {label:'Royal Pearl',metric:'points',target:250,requirement:'Earn 250 lifetime TP',color:'#c6fff5',accent:'#73b6d9'},
  meteor: {label:'Meteor',metric:'rankedWins',target:5,requirement:'Win 5 ranked matches',color:'#542b3e',accent:'#ffae33'},
  ooze: {label:'Ooze Ball',metric:'places',target:3,requirement:'Finish rounds at 3 different map locations',color:'#52db7e',accent:'#c4ff64'},
  glacier: {label:'Glacier',metric:'dailyDays',target:5,requirement:'Finish a daily course on 5 different days',color:'#83d9fc',accent:'#e8ffff'},
  hoops: {label:'Court King',metric:'rankedWins',target:15,requirement:'Win 15 ranked matches',color:'#f58b32',accent:'#a74620'},
  sushi: {label:'Sushi Roll',metric:'aces',target:15,requirement:'Make 15 lifetime aces',color:'#153f40',accent:'#eef6d5'},
  orbit: {label:'Orbit',metric:'points',target:1000,requirement:'Earn 1,000 lifetime TP',color:'#6686ec',accent:'#f8b968'},
  glaze: {label:'Sugar Rush',metric:'dailyDays',target:15,requirement:'Finish a daily course on 15 different days',color:'#f494bf',accent:'#ffdfa5'},
  pirate: {label:'Black Pearl',metric:'places',target:12,requirement:'Finish rounds at 12 different map locations',color:'#23384b',accent:'#e9be58'},
  dragonball: {label:'Dragon Egg',metric:'rankedWins',target:35,requirement:'Win 35 ranked matches',color:'#933549',accent:'#ffb258'},
  disco: {label:'Disco Ball',metric:'aces',target:40,requirement:'Make 40 lifetime aces',color:'#a3c6ec',accent:'#f0d1fa'},
  nebula: {label:'Nebula',metric:'points',target:2800,requirement:'Earn 2,800 lifetime TP',color:'#342d78',accent:'#ce8bfa'},
  prism: {label:'Crown Jewel',metric:'points',target:5000,requirement:'Earn 5,000 lifetime TP',color:'#72e6e3',accent:'#e2fffc'},
} as const satisfies Record<string,GearReward>;
export const EARNABLE_SHIRTS = {
  varsity: {label:'Varsity',metric:'points',target:350,requirement:'Earn 350 lifetime TP',color:'#286fb7',accent:'#fff3c8'},
  ranger: {label:'Trail Caddy',metric:'places',target:4,requirement:'Finish rounds at 4 different map locations',color:'#649271',accent:'#dfc88b'},
  wave: {label:'Wave Rider',metric:'dailyDays',target:7,requirement:'Finish a daily course on 7 different days',color:'#2bbaca',accent:'#d8fff1'},
  tour: {label:'Tour Pro',metric:'rankedWins',target:8,requirement:'Win 8 ranked matches',color:'#f1ecda',accent:'#153b55'},
  cosmic: {label:'Star Chaser',metric:'points',target:1250,requirement:'Earn 1,250 lifetime TP',color:'#51428d',accent:'#baa5ff'},
  bones: {label:'Bad to the Bone',metric:'aces',target:20,requirement:'Make 20 lifetime aces',color:'#1e3546',accent:'#d8e9d9'},
  wild: {label:'Wild Thing',metric:'places',target:8,requirement:'Finish rounds at 8 different map locations',color:'#ec9a35',accent:'#4b322a'},
  inferno: {label:'Inferno',metric:'rankedWins',target:30,requirement:'Win 30 ranked matches',color:'#263048',accent:'#ff9138'},
  sprinkles: {label:'Sprinkle Drip',metric:'dailyDays',target:18,requirement:'Finish a daily course on 18 different days',color:'#f394b8',accent:'#fff0c1'},
  circuit: {label:'Circuit Breaker',metric:'points',target:2300,requirement:'Earn 2,300 lifetime TP',color:'#254b61',accent:'#71f2db'},
  dragonscale: {label:'Dragon Guard',metric:'rankedWins',target:60,requirement:'Win 60 ranked matches',color:'#a63b4d',accent:'#ffc369'},
  monarch: {label:'Royal Robes',metric:'points',target:4400,requirement:'Earn 4,400 lifetime TP',color:'#6737a4',accent:'#ffdc73'},
  champion: {label:'Ace of Clubs',metric:'aces',target:60,requirement:'Make 60 lifetime aces',color:'#122f45',accent:'#ffdc73'},
} as const satisfies Record<string,GearReward>;
export type EarnedBall = keyof typeof EARNABLE_BALLS;
export type EarnedShirt = keyof typeof EARNABLE_SHIRTS;
export const STARTER_SHIRTS = ['white','ink','red','blue','wood','gold'] as const;
export const STARTER_BALLS = ['white','tomato','lemon','lime','sky','grape','bubblegum','ink','stripe','dots','tiger'] as const;
export function gearReward(slot:string,key:string):GearReward|null {
  const catalog=slot==='seat'?EARNABLE_SHIRTS:slot==='ball'?EARNABLE_BALLS:null;
  return catalog && Object.prototype.hasOwnProperty.call(catalog,key) ? (catalog as Record<string,GearReward>)[key] : null;
}
export interface GearAwards { shirts?:string[]; balls?:string[] }
export function gearUnlocked(slot:string,key:string,progress:GearAwards|null):boolean {
  if(!gearReward(slot,key)) return true;
  return (slot==='seat'?progress?.shirts:progress?.balls)?.includes(key) ?? false;
}
