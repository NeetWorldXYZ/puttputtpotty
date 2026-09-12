const RESULT_TONES = ['ace', 'albatross', 'eagle', 'birdie', 'par', 'over', 'double', 'triple', 'cap'] as const;
type ResultTone = typeof RESULT_TONES[number];
const artPath = (tone: string) => `/art/results/${tone}-mascot-v2.webp`;
let warmed = false;
/** Start downloads at round entry, before the first result card is needed. */
export function warmResultArt() {
  if (warmed || typeof Image === 'undefined') return;
  warmed = true;
  for (const tone of RESULT_TONES) {
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.src = artPath(tone);
  }
}
export function HoleResultArt({ tone }: { tone: ResultTone }) {
  return <img className="hr-result-illustration" src={artPath(tone)} alt="" width="640" height="640" decoding="async" draggable={false}/>;
}
