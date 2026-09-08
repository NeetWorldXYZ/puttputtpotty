/**
 * The course: a MapLibre style that draws the real world as a golf course.
 * Fairway greens for land, toilet-blue water hazards, sand bunkers, cream
 * cart paths for roads, little tan clubhouses for buildings, ink outlines
 * everywhere. Vector tiles (OpenMapTiles schema) from OpenFreeMap, which is
 * free and keyless; attribution stays on screen.
 */
import type { StyleSpecification } from 'maplibre-gl';

const INK = '#233e46';
const FAIRWAY = '#85bf68';
const ROUGH = '#569952';
const GREEN = '#a2d47d';
const WATER = '#54bee4';
const SAND = '#f2dfa4';
const PATH = '#fff2d5';
const BUILDING = '#dec99d';
const FONT = ['Noto Sans Bold'];
const FONT_REG = ['Noto Sans Regular'];

export const COURSE_STYLE: StyleSpecification = {
  version: 8,
  name: 'Putt Putt Potty Course',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': FAIRWAY } },
    // Rough: woods, grass, wetland
    {
      id: 'landcover',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'wood', 'grass', 'wetland', 'farmland'],
      paint: { 'fill-color': ROUGH, 'fill-opacity': 0.9 },
    },
    { id: 'sand', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', filter: ['==', 'class', 'sand'], paint: { 'fill-color': SAND } },
    // Built-up areas read as mown fairway; parks as putting greens
    {
      id: 'landuse-built',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', 'class', 'residential', 'suburb', 'neighbourhood', 'commercial', 'industrial', 'retail'],
      paint: { 'fill-color': GREEN, 'fill-opacity': 0.55 },
    },
    { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': GREEN, 'fill-opacity': 0.9 } },
    { id: 'park-outline', type: 'line', source: 'openmaptiles', 'source-layer': 'park', paint: { 'line-color': INK, 'line-width': 1, 'line-opacity': 0.35 } },
    { id: 'cemetery-etc', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', filter: ['in', 'class', 'cemetery', 'stadium', 'pitch', 'playground', 'school', 'university', 'hospital'], paint: { 'fill-color': '#b8e7a0', 'fill-opacity': 0.7 } },
    // Water hazards
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': WATER } },
    { id: 'water-outline', type: 'line', source: 'openmaptiles', 'source-layer': 'water', paint: { 'line-color': INK, 'line-width': 2 } },
    { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', paint: { 'line-color': WATER, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 5] } },
    // Railways as tracks
    { id: 'rail', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', filter: ['==', 'class', 'rail'], paint: { 'line-color': INK, 'line-width': 1.5, 'line-dasharray': [3, 3], 'line-opacity': 0.5 } },
    // Cart paths: casing then fill
    {
      id: 'road-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'class', 'rail'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': INK,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'class'], ['motorway', 'trunk'], 3, ['primary', 'secondary'], 2, 0.8], 16, ['match', ['get', 'class'], ['motorway', 'trunk'], 16, ['primary', 'secondary'], 12, ['tertiary', 'minor'], 9, 5]],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.35, 14, 0.9],
      },
    },
    {
      id: 'road',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'class', 'rail'], ['!=', 'brunnel', 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#f4c98a', ['path', 'track'], '#d9c9a0', PATH],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['match', ['get', 'class'], ['motorway', 'trunk'], 2, ['primary', 'secondary'], 1.2, 0.4], 16, ['match', ['get', 'class'], ['motorway', 'trunk'], 12, ['primary', 'secondary'], 9, ['tertiary', 'minor'], 6.5, 3]],
      },
    },
    // Clubhouses
    { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': BUILDING, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 15, 1] } },
    { id: 'building-outline', type: 'line', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14, paint: { 'line-color': INK, 'line-width': 1.2 } },
    // Labels: places big and bold, streets small
    {
      id: 'water-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT_REG, 'text-size': 12, 'symbol-placement': 'line' },
      paint: { 'text-color': '#175b80', 'text-halo-color': '#cfefff', 'text-halo-width': 1.5 },
    },
    {
      id: 'road-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT_REG, 'text-size': 11, 'symbol-placement': 'line', 'symbol-spacing': 300 },
      paint: { 'text-color': INK, 'text-halo-color': PATH, 'text-halo-width': 1.5 },
    },
    {
      id: 'place-town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town', 'village'],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': ['match', ['get', 'class'], 'city', 18, 'town', 15, 13], 'text-transform': 'uppercase', 'text-letter-spacing': 0.08 },
      paint: { 'text-color': INK, 'text-halo-color': '#f5ffdf', 'text-halo-width': 2 },
    },
    {
      id: 'place-hood',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 13,
      filter: ['in', 'class', 'suburb', 'neighbourhood', 'hamlet'],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 12 },
      paint: { 'text-color': INK, 'text-halo-color': '#f5ffdf', 'text-halo-width': 1.5, 'text-opacity': 0.8 },
    },
  ],
};

/** A circle polygon in lon/lat for the GPS accuracy ring. */
export function circlePolygon(lng: number, lat: number, radiusM: number, steps = 40): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}
