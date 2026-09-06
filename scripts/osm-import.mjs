#!/usr/bin/env node
// Loads OpenStreetMap bathrooms for one region into public.osm_places.
//
//   osmium tags-filter region.pbf <filters> -o filtered.pbf
//   osmium export filtered.pbf -f geojsonseq --add-unique-id=type_id -o places.geojsonseq
//   node scripts/osm-import.mjs --region michigan --file places.geojsonseq [--dry-run]
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Rows of the region that the
// file no longer contains are removed; the region's bounding box is recorded
// in osm_coverage so the API knows where the import is authoritative.
import fs from 'node:fs';
import readline from 'node:readline';
import { placeFromFeature, OSMIUM_FILTER } from './lib/poi.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((x) => x.length));
if (args.filters) {
  console.log(OSMIUM_FILTER.join(' '));
  process.exit(0);
}
/** Proves the secrets work before anything is downloaded. */
async function preflight() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  if (!/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(url.trim())) throw new Error(`SUPABASE_URL should look like https://<project-ref>.supabase.co (got ${url.replace(/[a-z]/g, 'x')})`);
  const client = createClient(url.trim(), key.trim(), { auth: { persistSession: false } });
  const { error } = await client.from('osm_coverage').select('region').limit(1);
  if (error) {
    const hint = /invalid api key/i.test(error.message)
      ? 'The key is not one this project recognises. In Supabase: Project Settings > API keys, copy the whole "service_role" (legacy) key or a "secret" key, not the publishable/anon key.'
      : /permission denied|row-level security/i.test(error.message)
        ? 'That key is not the service role: it cannot bypass row security. Use the "service_role" or a "secret" key.'
        : '';
    throw new Error(`database check failed: ${error.message}. ${hint}`);
  }
  return client;
}
if (args.check) {
  await preflight();
  console.log('secrets ok');
  process.exit(0);
}

const region = args.region;
const file = args.file;
const dryRun = !!args['dry-run'];
if (!region || !file) {
  console.error('usage: osm-import.mjs --region <name> --file <places.geojsonseq> [--dry-run]');
  process.exit(2);
}

const BATCH = 1000;
const startedAt = new Date().toISOString();
let supabase = null;
if (!dryRun) supabase = await preflight();

const bbox = { min_lat: 90, min_lng: 180, max_lat: -90, max_lng: -180 };
const byType = {};
const seen = new Set();
let read = 0;
let kept = 0;
let batch = [];
const samples = [];

async function flush() {
  if (!batch.length) return;
  const rows = batch;
  batch = [];
  if (!supabase) return;
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.from('osm_places').upsert(rows, { onConflict: 'id' });
    if (!error) return;
    if (attempt >= 4) throw new Error(`upsert failed: ${error.message}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
for await (const line of rl) {
  const t = line.replace(/^\x1e/, '').trim(); // geojsonseq lines start with RS
  if (!t) continue;
  read++;
  let feature;
  try {
    feature = JSON.parse(t);
  } catch {
    continue;
  }
  const p = placeFromFeature(feature);
  if (!p || seen.has(p.id)) continue;
  seen.add(p.id);
  kept++;
  byType[p.poi_type] = (byType[p.poi_type] ?? 0) + 1;
  bbox.min_lat = Math.min(bbox.min_lat, p.lat);
  bbox.max_lat = Math.max(bbox.max_lat, p.lat);
  bbox.min_lng = Math.min(bbox.min_lng, p.lng);
  bbox.max_lng = Math.max(bbox.max_lng, p.lng);
  if (samples.length < 3) samples.push(p);
  batch.push({ ...p, region, updated_at: startedAt });
  if (batch.length >= BATCH) {
    await flush();
    if (kept % 10000 < BATCH) console.log(`${region}: ${kept} places so far`);
  }
}
await flush();
console.log(`${region}: read ${read} features, kept ${kept}`, byType);
console.log('samples', samples);
if (!kept) {
  console.error('nothing to import; leaving the region untouched');
  process.exit(1);
}
if (dryRun) process.exit(0);

// Places that vanished from OpenStreetMap since the last import.
const { error: delErr, count } = await supabase.from('osm_places').delete({ count: 'exact' }).eq('region', region).lt('updated_at', startedAt);
if (delErr) throw new Error(`prune failed: ${delErr.message}`);
console.log(`${region}: removed ${count ?? 0} stale places`);

const { error: covErr } = await supabase.from('osm_coverage').upsert({ region, ...bbox, places: kept, imported_at: new Date().toISOString() });
if (covErr) throw new Error(`coverage failed: ${covErr.message}`);
console.log(`${region}: coverage`, bbox);

// Neighbourhood density, in batches (orders the pre-build: busy areas first).
let filled = 0;
for (;;) {
  const { data, error } = await supabase.rpc('osm_refresh_density', { in_region: region, batch: 2000 });
  if (error) throw new Error(`density failed: ${error.message}`);
  if (!data) break;
  filled += data;
}
console.log(`${region}: density filled for ${filled} places`);
