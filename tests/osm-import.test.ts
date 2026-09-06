import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM helper shared with the import and pre-build scripts
import { classify, centroid, osmId, placeFromFeature, OSMIUM_FILTER } from '../scripts/lib/poi.mjs';

describe('OpenStreetMap import helpers', () => {
  it('classifies the same tags the server accepts, and nothing else', () => {
    expect(classify({ amenity: 'toilets' })).toEqual({ poiType: 'toilets', label: 'Public toilet' });
    expect(classify({ amenity: 'nightclub' })).toEqual({ poiType: 'bar', label: 'Club' });
    expect(classify({ shop: 'mall' })?.poiType).toBe('retail');
    expect(classify({ highway: 'services' })?.poiType).toBe('park');
    expect(classify({ shop: 'bakery' })).toBeNull();
    // every filter value classifies
    for (const f of OSMIUM_FILTER as string[]) {
      const [key, vals] = f.replace('nw/', '').split('=');
      for (const v of vals.split(',')) expect(classify({ [key]: v }), `${key}=${v}`).not.toBeNull();
    }
  });

  it('maps osmium unique ids to our ids, including areas', () => {
    expect(osmId('n123')).toBe('osm:node:123');
    expect(osmId('w7')).toBe('osm:way:7');
    expect(osmId('a20')).toBe('osm:way:10');
    expect(osmId('a21')).toBe('osm:relation:10');
    expect(osmId('x1')).toBeNull();
  });

  it('takes a point for any geometry', () => {
    expect(centroid({ type: 'Point', coordinates: [-83.7, 42.2] })).toEqual({ lat: 42.2, lng: -83.7 });
    const poly = centroid({ type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]] });
    expect(poly.lat).toBeCloseTo(0.8);
    expect(poly.lng).toBeCloseTo(0.8);
    expect(centroid(null)).toBeNull();
  });

  it('turns a feature into a row with a sensible name', () => {
    expect(placeFromFeature({ type: 'Feature', properties: { '@id': 'n1', amenity: 'fuel', brand: 'Speedway' }, geometry: { type: 'Point', coordinates: [-83.74, 42.28] } })).toEqual({ id: 'osm:node:1', name: 'Speedway', poi_type: 'fuel', lat: 42.28, lng: -83.74 });
    expect(placeFromFeature({ type: 'Feature', properties: { '@id': 'n2', amenity: 'toilets' }, geometry: { type: 'Point', coordinates: [1, 2] } })?.name).toBe('Public toilet');
    expect(placeFromFeature({ type: 'Feature', properties: { '@id': 'n3', shop: 'bakery' }, geometry: { type: 'Point', coordinates: [1, 2] } })).toBeNull();
  });
});
