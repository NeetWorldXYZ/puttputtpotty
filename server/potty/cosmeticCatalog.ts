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
export const EARNABLE_HATS = {
  visor: {"label": "Tour Visor", "metric": "points", "target": 200, "requirement": "Earn 200 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  bucket: {"label": "Bucket Brigade", "metric": "dailyDays", "target": 3, "requirement": "Finish a daily course on 3 different days", "color": "#ffe18a", "accent": "#338da8"},
  cowboy: {"label": "Rough Rider", "metric": "places", "target": 3, "requirement": "Finish rounds at 3 different map locations", "color": "#ffe18a", "accent": "#338da8"},
  beanie: {"label": "Chill Caddy", "metric": "points", "target": 650, "requirement": "Earn 650 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  chef: {"label": "Chef Bogey", "metric": "aces", "target": 8, "requirement": "Make 8 lifetime aces", "color": "#ffe18a", "accent": "#338da8"},
  piratehat: {"label": "Captain Flush", "metric": "rankedWins", "target": 10, "requirement": "Win 10 ranked matches", "color": "#ffe18a", "accent": "#338da8"},
  viking: {"label": "Viking Throne", "metric": "places", "target": 8, "requirement": "Finish rounds at 8 different map locations", "color": "#ffe18a", "accent": "#338da8"},
  wizard: {"label": "Putt Wizard", "metric": "points", "target": 1800, "requirement": "Earn 1,800 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  safari: {"label": "Safari Scout", "metric": "dailyDays", "target": 12, "requirement": "Finish a daily course on 12 different days", "color": "#ffe18a", "accent": "#338da8"},
  hardhat: {"label": "Course Crew", "metric": "rankedWins", "target": 25, "requirement": "Win 25 ranked matches", "color": "#ffe18a", "accent": "#338da8"},
  propeller: {"label": "Air Head", "metric": "aces", "target": 30, "requirement": "Make 30 lifetime aces", "color": "#ffe18a", "accent": "#338da8"},
  party: {"label": "Party Putter", "metric": "points", "target": 3500, "requirement": "Earn 3,500 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  toilethat: {"label": "Royal Flush", "metric": "rankedWins", "target": 50, "requirement": "Win 50 ranked matches", "color": "#ffe18a", "accent": "#338da8"},
} as const satisfies Record<string,GearReward>;
export const EARNABLE_FACES = {
  grin: {"label": "Big Grin", "metric": "points", "target": 200, "requirement": "Earn 200 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  smirk: {"label": "2 EZ", "metric": "dailyDays", "target": 3, "requirement": "Finish a daily course on 3 different days", "color": "#ffe18a", "accent": "#338da8"},
  shocked: {"label": "No Way", "metric": "places", "target": 3, "requirement": "Finish rounds at 3 different map locations", "color": "#ffe18a", "accent": "#338da8"},
  laugh: {"label": "Laughing", "metric": "points", "target": 650, "requirement": "Earn 650 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  tears: {"label": "Bogey Tears", "metric": "aces", "target": 8, "requirement": "Make 8 lifetime aces", "color": "#ffe18a", "accent": "#338da8"},
  heart: {"label": "Heart Eyes", "metric": "rankedWins", "target": 10, "requirement": "Win 10 ranked matches", "color": "#ffe18a", "accent": "#338da8"},
  star: {"label": "Star Struck", "metric": "places", "target": 8, "requirement": "Finish rounds at 8 different map locations", "color": "#ffe18a", "accent": "#338da8"},
  dizzy: {"label": "Dizzy", "metric": "points", "target": 1800, "requirement": "Earn 1,800 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  tongue: {"label": "Goofball", "metric": "dailyDays", "target": 12, "requirement": "Finish a daily course on 12 different days", "color": "#ffe18a", "accent": "#338da8"},
  focused: {"label": "Locked In", "metric": "rankedWins", "target": 25, "requirement": "Win 25 ranked matches", "color": "#ffe18a", "accent": "#338da8"},
  monocle: {"label": "Fancy Pants", "metric": "aces", "target": 30, "requirement": "Make 30 lifetime aces", "color": "#ffe18a", "accent": "#338da8"},
  eyepatch: {"label": "One Eye", "metric": "points", "target": 3500, "requirement": "Earn 3,500 lifetime TP", "color": "#ffe18a", "accent": "#338da8"},
  zipit: {"label": "Zip It", "metric": "rankedWins", "target": 50, "requirement": "Win 50 ranked matches", "color": "#ffe18a", "accent": "#338da8"},
} as const satisfies Record<string,GearReward>;
export const EARNABLE_COLORS = {
  arctic: {"label": "Arctic", "metric": "points", "target": 200, "requirement": "Earn 200 lifetime TP", "color": "#e9ffff", "accent": "#66b6d1"},
  lava: {"label": "Lava", "metric": "dailyDays", "target": 3, "requirement": "Finish a daily course on 3 different days", "color": "#ffbf62", "accent": "#d84537"},
  deepsea: {"label": "Deep Sea", "metric": "places", "target": 3, "requirement": "Finish rounds at 3 different map locations", "color": "#48bfce", "accent": "#234778"},
  radioactive: {"label": "Radioactive", "metric": "points", "target": 650, "requirement": "Earn 650 lifetime TP", "color": "#d6ff61", "accent": "#54ac36"},
  cottoncandy: {"label": "Cotton Candy", "metric": "aces", "target": 8, "requirement": "Make 8 lifetime aces", "color": "#ffc8ef", "accent": "#a475de"},
  royalviolet: {"label": "Royal Violet", "metric": "rankedWins", "target": 10, "requirement": "Win 10 ranked matches", "color": "#bda0ff", "accent": "#6342b6"},
  rosegold: {"label": "Rose Gold", "metric": "places", "target": 8, "requirement": "Finish rounds at 8 different map locations", "color": "#ffe1ca", "accent": "#bb7784"},
  copper: {"label": "Copper", "metric": "points", "target": 1800, "requirement": "Earn 1,800 lifetime TP", "color": "#edb279", "accent": "#984f37"},
  silver: {"label": "Silver", "metric": "dailyDays", "target": 12, "requirement": "Finish a daily course on 12 different days", "color": "#e2edf6", "accent": "#7c94ab"},
  nightshade: {"label": "Nightshade", "metric": "rankedWins", "target": 25, "requirement": "Win 25 ranked matches", "color": "#919dd4", "accent": "#3b3d73"},
  sunset: {"label": "Sunset", "metric": "aces", "target": 30, "requirement": "Make 30 lifetime aces", "color": "#ffd58c", "accent": "#e26da1"},
  aurora: {"label": "Aurora", "metric": "points", "target": 3500, "requirement": "Earn 3,500 lifetime TP", "color": "#a0ffdf", "accent": "#6970d6"},
  obsidian: {"label": "Obsidian", "metric": "rankedWins", "target": 50, "requirement": "Win 50 ranked matches", "color": "#65798c", "accent": "#263a50"},
} as const satisfies Record<string,GearReward>;
export const STARTER_HATS = ['none','crown','cap','tophat','plunger','halo'] as const;
export const STARTER_FACES = ['happy','cool','wink','angry','sleepy'] as const;
export const STARTER_COLORS = ['white','mint','pink','sky','lavender','gold','onyx'] as const;
export type EarnedBall = keyof typeof EARNABLE_BALLS;
export type EarnedShirt = keyof typeof EARNABLE_SHIRTS;
export const STARTER_SHIRTS = ['white','ink','red','blue','wood','gold'] as const;
export const STARTER_BALLS = ['white','tomato','lemon','lime','sky','grape','bubblegum','ink','stripe','dots','tiger'] as const;
export function gearReward(slot:string,key:string):GearReward|null {
  const catalog=slot==='seat'?EARNABLE_SHIRTS:slot==='ball'?EARNABLE_BALLS:slot==='hat'?EARNABLE_HATS:slot==='face'?EARNABLE_FACES:slot==='porcelain'?EARNABLE_COLORS:null;
  return catalog && Object.prototype.hasOwnProperty.call(catalog,key) ? (catalog as Record<string,GearReward>)[key] : null;
}
export interface GearAwards { shirts?:string[]; balls?:string[]; hats?:string[]; faces?:string[]; colors?:string[] }
export function gearUnlocked(slot:string,key:string,progress:GearAwards|null):boolean {
  if(!gearReward(slot,key)) return true;
  return (slot==='seat'?progress?.shirts:slot==='ball'?progress?.balls:slot==='hat'?progress?.hats:slot==='face'?progress?.faces:progress?.colors)?.includes(key) ?? false;
}
