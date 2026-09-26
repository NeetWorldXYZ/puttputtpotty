import { expect, it } from 'vitest';
import { needsPlayerName } from '../src/net/playerName';

it('asks unnamed and automatic guest golfers to choose a name', () => {
  for (const name of [null, undefined, '', '  ', 'Golfer 0B7A', 'Golfer 3C5']) expect(needsPlayerName(name)).toBe(true);
});
it('keeps names chosen by returning players', () => {
  for (const name of ['KingKory', 'PuttPottyBobby', 'Sam', 'Golfer Joe']) expect(needsPlayerName(name)).toBe(false);
});
