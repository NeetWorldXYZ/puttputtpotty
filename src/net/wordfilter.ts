/**
 * Name and slogan filter, shared by the client (instant feedback) and the
 * server (the rule). Catches slurs and profanity through the usual tricks:
 * capitals, leetspeak, symbols, repeated and separated letters.
 */

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't', '€': 'e', '£': 'l' };

/** Lowercase, leetspeak undone, accents dropped, repeated letters collapsed ("niiice" -> "nice"). */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/./g, (c) => LEET[c] ?? c)
    .replace(/(.)\1+/g, '$1');
}

/** Never part of an innocent word: matched anywhere, spaces and symbols removed. */
const ANYWHERE = ['niger', 'niga', 'nigr', 'chink', 'kike', 'wetback', 'raghead', 'towelhead', 'jigabo', 'fagot', 'trany', 'chinaman', 'ziperhead', 'cameljockey', 'porchmonkey', 'sandniger', 'hitler', 'nazi', 'heilh', 'whore', 'slut', 'bitch', 'fuck', 'fuk', 'asho', 'jiz', 'twat', 'wank', 'penis', 'vagina', 'dildo', 'blowjob', 'handjob', 'rapist', 'pedo', 'molest', 'kys'];

/** Can sit inside ordinary words (bass, cocoon, analysis): only as a whole word. */
const WHOLE = ['spic', 'gok', 'beaner', 'wop', 'dago', 'kraut', 'con', 'darkie', 'darky', 'negro', 'fag', 'dyke', 'retard', 'retarded', 'rape', 'cock', 'dick', 'pusy', 'cum', 'anal', 'anus', 'boner', 'as', 'ashole', 'cunt', 'cunts', 'nig', 'shit', 'porn', 'sex', 'sexy', 'tit', 'tits', 'ho', 'hoe', 'admin', 'moderator', 'staf', 'oficial', 'putputpoty'];

const wholeSet = new Set(WHOLE);

/** Why this text is not allowed, or null when it is fine. The reason never repeats the word. */
export function textProblem(input: string, what: 'name' | 'slogan' = 'name'): string | null {
  const nope = `That ${what} won't fly here.`;
  const raw = input.toLowerCase().replace(/[^a-z]/g, '');
  if (/k{3,}/.test(raw)) return nope;
  const folded = fold(input);
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  const joined = words.join('').replace(/(.)\1+/g, '$1'); // separated letters: n.i.g.g.e.r
  for (const bad of ANYWHERE) if (joined.includes(bad)) return nope;
  for (const w of words) if (wholeSet.has(w)) return nope;
  // Spaced-out letters ("f a g") read as one word.
  let run = '';
  for (const w of [...words, '']) {
    if (w.length === 1) run += w;
    else {
      if (run.length > 1 && wholeSet.has(run)) return nope;
      run = '';
    }
  }
  // Two-word combos that are fine apart.
  for (const p of ['gasthe', 'kilal', 'whitepower', 'blackpower']) if (joined.includes(p)) return nope;
  return null;
}

export const NAME_RE = /^[A-Za-z0-9 _.'\-]{2,24}$/;
export const SLOGAN_MAX = 60;

/** Full name check: shape plus the filter. */
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (!NAME_RE.test(n)) return "Names are 2 to 24 characters: letters, numbers, spaces, _ - . '";
  return textProblem(n, 'name');
}

/** Slogans are freer in shape (any printable text) but filtered the same way. */
export function sloganProblem(slogan: string): string | null {
  const s = slogan.trim();
  if (s.length > SLOGAN_MAX) return `Slogans are up to ${SLOGAN_MAX} characters.`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) return 'Slogans are plain text.';
  return textProblem(s, 'slogan');
}
