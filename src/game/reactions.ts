/**
 * Canned after-match reactions. Only the key crosses the wire; every client
 * maps it to the same line, so nobody can type anything of their own.
 */
export type ReactionMood = 'trash' | 'sad' | 'nice';

export interface Reaction {
  key: string;
  /** Short chip label. */
  chip: string;
  /** The full line, shown in the speech bubble. */
  text: string;
  mood: ReactionMood;
}

export const REACTIONS: Reaction[] = [
  // Trash talk, for whoever came out on top.
  { key: 'flushed', chip: '🚽 Flushed', text: 'Flushed ya. Twice, for the smell.', mood: 'trash' },
  { key: 'wiped', chip: '🧻 Wiped', text: 'Wiped the floor with you. Single ply.', mood: 'trash' },
  { key: 'plunger', chip: '🪠 Plunger', text: 'Somebody get a plunger, that round was a clog.', mood: 'trash' },
  { key: 'seat_down', chip: '🪑 Seat down', text: 'Seat’s down. Sit on that.', mood: 'trash' },
  { key: 'courtesy', chip: '💦 Courtesy', text: 'Courtesy flush for that scorecard.', mood: 'trash' },
  { key: 'stall', chip: '🚪 Stall', text: 'Go sit in the stall and think about what you did.', mood: 'trash' },
  { key: 'ez', chip: '😴 EZ', text: 'I putted that with the lid closed.', mood: 'trash' },
  // Sad but funny, for whoever got flushed.
  { key: 'fell_in', chip: '😭 Fell in', text: 'I’ve fallen in and I can’t get out.', mood: 'sad' },
  { key: 'no_tp', chip: '🧻 No TP', text: 'Ran out of toilet paper on hole 3. Never recovered.', mood: 'sad' },
  { key: 'lid', chip: '🙈 The lid', text: 'The lid was down the whole time, I swear.', mood: 'sad' },
  { key: 'cramp', chip: '🤕 Cramp', text: 'Hand cramp. From the plunger. Unrelated.', mood: 'sad' },
  { key: 'lucky', chip: '🎲 Lucky', text: 'Lucky bounce off the bowl and you know it.', mood: 'sad' },
  { key: 'pride', chip: '🌀 Pride', text: 'My ball got flushed and so did my pride.', mood: 'sad' },
  { key: 'revenge', chip: '😤 Revenge', text: 'Revenge round. Right now. Bring a towel.', mood: 'sad' },
  // Good sport.
  { key: 'gg', chip: '🤝 GG', text: 'Good game. Clean bowl, clean putts.', mood: 'nice' },
  { key: 'clap', chip: '👏 Nice putts', text: 'Okay okay, nice putts. Genuinely.', mood: 'nice' },
  { key: 'rematch', chip: '🔁 Rematch?', text: 'Rematch? I’ll bring the plunger.', mood: 'nice' },
];

const BY_KEY = new Map(REACTIONS.map((r) => [r.key, r]));

export const reactionFor = (key: string): Reaction | undefined => BY_KEY.get(key);

/** The chips in the order that fits the result: winners see trash first, losers the sad stuff, ties the sportsmanship. */
export function reactionsFor(outcome: 'won' | 'lost' | 'tie'): Reaction[] {
  const first: ReactionMood = outcome === 'won' ? 'trash' : outcome === 'lost' ? 'sad' : 'nice';
  const order: ReactionMood[] = first === 'trash' ? ['trash', 'nice', 'sad'] : first === 'sad' ? ['sad', 'nice', 'trash'] : ['nice', 'trash', 'sad'];
  return order.flatMap((m) => REACTIONS.filter((r) => r.mood === m));
}

/** What a computer opponent fires back: it gloats when it won, sulks when it lost, and shrugs at a tie. */
export function botReply(outcome: 'won' | 'lost' | 'tie', rnd: () => number = Math.random): Reaction {
  const mood: ReactionMood = outcome === 'won' ? 'sad' : outcome === 'lost' ? 'trash' : 'nice';
  const pool = REACTIONS.filter((r) => r.mood === mood || (r.mood === 'nice' && rnd() < 0.25));
  return pool[Math.floor(rnd() * pool.length)];
}
