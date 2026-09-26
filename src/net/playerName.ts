/** Server-generated names should never count as a player choosing their identity. */
export function needsPlayerName(name: string | null | undefined): boolean {
  return !name?.trim() || /^Golfer [A-F0-9]+$/i.test(name.trim());
}
