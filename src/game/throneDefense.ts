/** Display-only mirror of the database rule; the server decides ownership. */
export function defenseAllowance(defendedAt: string, now = Date.now()): number {
 const age = now - Date.parse(defendedAt);
 if (!Number.isFinite(age) || age < 72 * 3600000) return 0;
 return Math.min(3, 1 + Math.floor((age - 72 * 3600000) / 86400000));
}
export function captureTarget(score: number, defendedAt: string, now = Date.now()): number {
 return score + defenseAllowance(defendedAt, now);
}
export function defenseText(score:number, defendedAt:string, elapsedMs:number|null, now=Date.now()):string {
  const age=now-Date.parse(defendedAt);
  if (!(age>=48*3600000)) {
    if (elapsedMs===null) return `Beat ${score} strokes to capture.`;
    const seconds=Math.floor(elapsedMs/1000);
    const time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}${elapsedMs%1000?'.'+String(elapsedMs%1000).padStart(3,'0').replace(/0+$/,''):''}`;
    return `Beat ${score}, or tie it in under ${time}.`;
  }
  const extra=defenseAllowance(defendedAt,now);
  return extra ? `Weakened defense: shoot ${score+extra} or better (+${extra} to the target).` : `Shoot ${score} or better. A tie takes this throne.`;
}
