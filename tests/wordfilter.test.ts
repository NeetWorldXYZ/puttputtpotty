import { describe, expect, it } from 'vitest';
import { nameProblem, placeNameProblem, sloganProblem, textProblem } from '../src/net/wordfilter';

describe('name and slogan filter', () => {
  it('lets ordinary names through, including ones that contain awkward substrings', () => {
    for (const ok of ['KingKory', 'Sully Fan 99', 'Dickson', 'Cummings', 'Scunthorpe FC', 'Bass Pro', 'Cocoon', 'Analyst', 'Assassin', 'Peacock', 'Conspicuous', 'Spice Girl', 'Raccoon', 'Titan', 'Sexton', 'Hoedown', 'Grassy Knoll', 'Classic Rock', 'Bitcoin Bob', 'Golfer 4C85'])
      expect(nameProblem(ok), ok).toBeNull();
  });

  it('blocks slurs and profanity through capitals, leetspeak, symbols and repeats', () => {
    for (const bad of ['nigger', 'N1GG3R', 'n.i.g.g.e.r', 'niiigggeeer', 'NIGGA4', 'F4GGOT', 'f a g', 'ch1nk', 'K-I-K-E', 'sp1c', 'Hitler Fan', 'nazi_boy', 'KKK', 'KKKING', 'fuck you', 'FuKKing', 'b!tch', 'a$$hole', 'Cunt', 'wh0re', 'gas the', 'retard'])
      expect(nameProblem(bad), bad).not.toBeNull();
  });

  it('never repeats the word in the reason', () => {
    expect(nameProblem('nigger')).toBe("That name won't fly here.");
  });

  it('keeps reserved names off the throne', () => {
    expect(nameProblem('Admin')).not.toBeNull();
    expect(nameProblem('Moderator Mike')).not.toBeNull();
  });

  it('checks slogans the same way with a longer limit', () => {
    expect(sloganProblem('Sink it or swim in it')).toBeNull();
    expect(sloganProblem('x'.repeat(61))).toMatch(/60/);
    expect(sloganProblem('you are a cunt')).not.toBeNull();
    expect(textProblem('pure gold', 'slogan')).toBeNull();
  });

  it('lets business names keep their punctuation but still filters them', () => {
    for (const ok of ['Hourglass Coffee + Kitchen', "Joe's Bar & Grill", '7-Eleven (24h)', 'Bagels, Etc.', 'Bob/Ann Diner', 'Wash #2', 'Woo! Cafe', 'Gate B: Restroom'])
      expect(placeNameProblem(ok), ok).toBeNull();
    expect(placeNameProblem('Fuck Cafe')).not.toBeNull();
    expect(placeNameProblem('A')).not.toBeNull();
    expect(placeNameProblem('Bad <script> name')).not.toBeNull();
    expect(nameProblem('Hourglass Coffee + Kitchen')).not.toBeNull();
  });
});
