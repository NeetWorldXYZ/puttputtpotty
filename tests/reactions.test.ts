import { describe, expect, it } from 'vitest';
import { REACTIONS, botReply, reactionFor, reactionsFor } from '../src/game/reactions';

describe('after-match reactions', () => {
  it('uses unique keys the server accepts', () => {
    const keys = REACTIONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9_]{2,24}$/);
  });
  it('keeps lines short enough for a bubble', () => {
    for (const r of REACTIONS) {
      expect(r.text.length).toBeLessThanOrEqual(60);
      expect(r.chip.length).toBeLessThanOrEqual(14);
    }
  });
  it('leads with the mood that fits the result', () => {
    expect(reactionsFor('won')[0].mood).toBe('trash');
    expect(reactionsFor('lost')[0].mood).toBe('sad');
    expect(reactionsFor('tie')[0].mood).toBe('nice');
    expect(reactionsFor('won')).toHaveLength(REACTIONS.length);
  });
  it('looks keys up and ignores strangers', () => {
    expect(reactionFor('gg')?.text).toContain('Good game');
    expect(reactionFor('hax')).toBeUndefined();
  });
  it('bot gloats when it wins and sulks when it loses', () => {
    let i = 0;
    const seq = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.1];
    const rnd = () => seq[i++ % seq.length];
    expect(botReply('lost', rnd).mood).toBe('trash');
    i = 0;
    expect(botReply('won', rnd).mood).toBe('sad');
  });
});
