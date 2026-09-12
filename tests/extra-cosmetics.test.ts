import { expect,test } from 'vitest';
import { EARNABLE_HATS,EARNABLE_FACES,EARNABLE_COLORS,gearUnlocked,STARTER_HATS,STARTER_FACES,STARTER_COLORS } from '../server/potty/cosmeticCatalog';
import { normalizeAvatarChoice,needsUnlockCheck,lockedAvatarPart } from '../server/potty/avatarUnlocks';
import { DEFAULT_AVATAR,HEADS,avatarPartSvg,avatarSvg,normalizeAvatar,randomAvatar,starterAvatar } from '../src/game/avatarParts';

test('39 new cosmetics render, persist and enforce their unlocks',()=>{
  for(const [slot,field,catalog] of [['hat','hats',EARNABLE_HATS],['face','faces',EARNABLE_FACES],['porcelain','colors',EARNABLE_COLORS]] as const){
    expect(Object.keys(catalog)).toHaveLength(13);
    const artwork=new Set<string>();
    for(const key of Object.keys(catalog)){
      const av={...DEFAULT_AVATAR,[slot]:key};
      expect(normalizeAvatar(av)[slot]).toBe(key);
      expect(normalizeAvatarChoice(av,()=>({...DEFAULT_AVATAR}))[slot]).toBe(key);
      expect(needsUnlockCheck(av)).toBe(true);
      expect(gearUnlocked(slot,key,null)).toBe(false);
      expect(lockedAvatarPart(av,null)).toBe(slot==='porcelain'?'color':slot);
      const awards={[field]:[key]};
      expect(gearUnlocked(slot,key,awards)).toBe(true);
      expect(lockedAvatarPart(av,awards)).toBeNull();
      const art=avatarPartSvg(av,slot,'same-id');
      expect(art.viewBox).toBeTruthy();
      expect(art.markup).not.toMatch(/undefined|NaN/);
      artwork.add(art.markup);
      for(const head of Object.keys(HEADS))expect(avatarSvg({...av,head},'check')).not.toMatch(/undefined|NaN/);
    }
    expect(artwork.size).toBe(13);
  }
});
test('new players and bots only receive starter cosmetics',()=>{
  for(let i=0;i<100;i++)for(const av of [starterAvatar(()=>i/100),randomAvatar(()=>i/100)]){
    expect(STARTER_HATS).toContain(av.hat);expect(STARTER_FACES).toContain(av.face);expect(STARTER_COLORS).toContain(av.porcelain);
  }
});
