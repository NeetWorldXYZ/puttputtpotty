/** Cosmetic milestones only. No TP is spent and no gameplay parameters change. */
export type HeadMetric = 'points' | 'rankedWins' | 'places' | 'dailyDays' | 'aces' | 'thrones';
export const EARNABLE_HEADS = {
  bubble: { label: 'Bubble Head', blurb: 'Clean look. Filthy short game.', metric: 'points', target: 450, requirement: 'Reach level 4 · 450 TP', palette: ['#b3fff1','#398fd5'], shirt: 'blue' },
  robot: { label: 'Bogey Bot', blurb: 'Built different. Calibrated for crowns.', metric: 'rankedWins', target: 10, requirement: 'Win 10 ranked matches', palette: ['#b9dbec','#57778f'], shirt: 'ink' },
  swamp: { label: 'Swamp Thing', blurb: 'Crawled out of the rough.', metric: 'places', target: 5, requirement: 'Finish rounds at 5 different map locations', palette: ['#bcf06a','#408864'], shirt: 'ink' },
  vampire: { label: 'Count Flush', blurb: 'A little bite in the back nine.', metric: 'dailyDays', target: 10, requirement: 'Finish a daily course on 10 different days', palette: ['#dec8ff','#9780c8'], shirt: 'red' },
  shark: { label: 'Shark Head', blurb: 'Smells a hole in one.', metric: 'aces', target: 25, requirement: 'Make 25 lifetime aces', palette: ['#73d5ec','#347bac'], shirt: 'blue' },
  ghost: { label: 'Porcelain Phantom', blurb: 'Haunting the leaderboard.', metric: 'points', target: 1750, requirement: 'Reach level 8 · 1,750 TP', palette: ['#effff6','#9ecbdf'], shirt: 'ink' },
  raccoon: { label: 'Trash Panda', blurb: 'Your crown looked unattended.', metric: 'places', target: 15, requirement: 'Finish rounds at 15 different map locations', palette: ['#b4c8d1','#647d90'], shirt: 'blue' },
  flame: { label: 'Hot Head', blurb: 'The winning streak has a face.', metric: 'rankedWins', target: 50, requirement: 'Win 50 ranked matches', palette: ['#ffe180','#ed7640'], shirt: 'ink' },
  lion: { label: 'Royal Lion', blurb: 'A mane event. No crown required.', metric: 'thrones', target: 5, requirement: 'Hold 5 thrones at the same time', palette: ['#ffe2a0','#d1a14f'], shirt: 'ink' },
  diamond: { label: 'Diamond Dome', blurb: 'Pressure makes a legend.', metric: 'points', target: 3850, requirement: 'Reach level 12 · 3,850 TP', palette: ['#d9ffff','#659ae4'], shirt: 'blue' },
  basketball: { label: 'Dunk Head', blurb: 'Nothing but cup.', metric: 'rankedWins', target: 25, requirement: 'Win 25 ranked matches', palette: ['#ffa343','#cc501c'], shirt: 'ink' },
  pickle: { label: 'Big Dill', blurb: 'Kind of a big dill around here.', metric: 'places', target: 10, requirement: 'Finish rounds at 10 different map locations', palette: ['#c1e660','#537c30'], shirt: 'white' },
  doughnut: { label: 'Glazed & Confused', blurb: 'A sweet little hole in one.', metric: 'dailyDays', target: 20, requirement: 'Finish a daily course on 20 different days', palette: ['#ffb5d8','#d65a99'], shirt: 'blue' },
} as const satisfies Record<string, {label:string;blurb:string;metric:HeadMetric;target:number;requirement:string;palette:readonly string[];shirt:string}>;

export type EarnableHead = keyof typeof EARNABLE_HEADS;
export interface HeadProgress { unlocked: string[]; shirts?:string[]; balls?:string[]; hats?:string[]; faces?:string[]; colors?:string[]; stats: Record<HeadMetric, number> }
export const STARTER_HEADS = ['classic','roll','turd','alien','dawg'] as const;
export function isEarnableHead(head:string):head is EarnableHead { return Object.prototype.hasOwnProperty.call(EARNABLE_HEADS,head); }
export function headUnlocked(head:string, progress:HeadProgress|null):boolean {
  return (STARTER_HEADS as readonly string[]).includes(head) || !!progress?.unlocked.includes(head);
}

/** Every new material has seven colourways; stored colour keys remain compatible. */
export function earnedHeadTones(head:string) {
  if (!isEarnableHead(head)) return null;
  const base=EARNABLE_HEADS[head].palette;
  return {
    white:{top:base[0],bottom:base[1],label:'Signature'},
    mint:{top:'#b0f1c9',bottom:'#539b91',label:'Jade'},
    pink:{top:'#ffbaca',bottom:'#be729b',label:'Rose'},
    sky:{top:'#b6e8ff',bottom:'#528dc0',label:'Glacier'},
    lavender:{top:'#d9c2ff',bottom:'#9271ba',label:'Twilight'},
    gold:{top:'#ffe3a3',bottom:'#c59655',label:'Honey'},
    onyx:{top:'#a8b1c7',bottom:'#58677d',label:'Slate'},
  };
}
