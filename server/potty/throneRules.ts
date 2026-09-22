/** The check-in stays strict; finishing allows bounded indoor GPS drift. */
export function validThroneFinish(checkinDistance: number, checkinAccuracy: number, drift: number, accuracy: number): boolean {
  return [checkinDistance, checkinAccuracy, drift, accuracy].every(n => Number.isFinite(n) && n >= 0)
    && checkinAccuracy <= 150 && accuracy <= 150
    && checkinDistance <= 25 + Math.min(checkinAccuracy, 25)
    && drift <= 75;
}
