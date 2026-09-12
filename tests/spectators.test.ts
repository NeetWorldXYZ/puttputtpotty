import { describe, it, expect } from 'vitest';
import { ARCHETYPES, buildSkeleton } from '../src/generator/archetypes';
import { unionWalls } from '../src/generator/geom';
import { Rng } from '../src/generator/rng';
import { emptyHole } from '../src/sim/types';
import { wallLoops, pointInRegion, distToWalls } from '../src/render/region';
import { placeFanAreas } from '../src/render/fanAreas';
import { placeSpectators } from '../src/render/spectators';
import { placeProps } from '../src/render/props';
import { themeById } from '../src/render/themes';

describe('spectator placement', () => {
  it('gives every course shape orderly crowds without touching the playable floor or modifying the hole', () => {
    for (const archetype of ARCHETYPES) for (const width of ['tight','normal','wide'] as const) {
      const sk = buildSkeleton(archetype, new Rng(`${archetype}:${width}`), { length:'medium',width });
      const hole = { ...emptyHole(archetype), bounds:{x:0,y:0,w:30,h:sk.height+2}, walls:unionWalls(sk.cells),tee:sk.tee,cup:sk.cup };
      const before=JSON.stringify(hole);
      const region=wallLoops(hole);
      const theme=themeById('stadium');
      const props=placeProps(hole,region,{...theme,props:theme.props.filter(p=>p!=='crowd')});
      const areas=placeFanAreas(hole,region,props);
      for(const a of areas){expect(pointInRegion(region,a.x,a.y)).toBe(false);expect(distToWalls(hole,a.x,a.y)).toBeGreaterThanOrEqual(3.4);}
      const reserved=[...props,...areas.map(p=>({kind:'crowd' as const,x:p.x,y:p.y,r:0,seed:0}))];
      const crowd=placeSpectators(hole,region,reserved);
      expect(crowd.length,`${archetype}/${width}`).toBeGreaterThan(5);
      expect(crowd.length).toBeLessThanOrEqual(150);
      for (const [i,p] of crowd.entries()) {
        expect(pointInRegion(region,p.x,p.y)).toBe(false);
        expect(distToWalls(hole,p.x,p.y)).toBeGreaterThanOrEqual(1.4);
        for(const q of crowd.slice(i+1))expect(Math.hypot(q.x-p.x,q.y-p.y)).toBeGreaterThanOrEqual(1.5);
        for(const q of reserved)expect(Math.hypot(q.x-p.x,q.y-p.y)).toBeGreaterThanOrEqual(3.1);
      }
      expect(placeSpectators(hole,region,reserved)).toEqual(crowd);
      expect(JSON.stringify(hole)).toBe(before);
    }
  });
});
