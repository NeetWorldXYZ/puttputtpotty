#!/usr/bin/env node
// Builds the three-hole course of every imported bathroom in a region that
// has none yet, busiest neighbourhoods first, so nobody waits on generation.
//
//   node scripts/prebuild.mjs --region michigan [--shard 0 --shards 8] [--minutes 300] [--batch 100]
//   node scripts/prebuild.mjs --dry-run            (builds two sample courses, no database)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Produces the same rows the API
// builds on demand; a row that appears meanwhile is left alone.
import { buildCourse } from './lib/course.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((x) => x.length));
if (args['dry-run']) {
  const samples = [
    { id: 'osm:node:424242', name: "Sully's Tavern", poi_type: 'bar', lat: 42.28, lng: -83.74 },
    { id: 'osm:way:9090', name: 'Speedway', poi_type: 'fuel', lat: 42.29, lng: -83.75 },
  ];
  for (const s of samples) {
    const t0 = performance.now();
    const { row, fallbacks } = buildCourse(s);
    console.log(row.id, row.theme, row.difficulty, 'par', row.par, 'pars', row.holes.map((h) => h.par), 'fallbacks', fallbacks, `${((performance.now() - t0) / 1000).toFixed(1)}s`, `${JSON.stringify(row.holes).length} bytes`);
  }
  process.exit(0);
}

const region = args.region;
if (!region) {
  console.error('usage: prebuild.mjs --region <name> [--shard i --shards n] [--minutes m] [--batch b]');
  process.exit(2);
}
const shard = Number(args.shard ?? 0);
const shards = Number(args.shards ?? 1);
const minutes = Number(args.minutes ?? 300);
const batch = Number(args.batch ?? 100);
const { createClient } = await import('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const deadline = Date.now() + minutes * 60_000;
let built = 0;
let fallbackHoles = 0;
const t0 = Date.now();
while (Date.now() < deadline) {
  const { data: places, error } = await supabase.rpc('prebuild_candidates', { in_region: region, shard, shards, lim: batch });
  if (error) throw new Error(`candidates failed: ${error.message}`);
  if (!places?.length) {
    console.log(`${region} shard ${shard}/${shards}: nothing left to build`);
    break;
  }
  const rows = [];
  for (const p of places) {
    if (Date.now() >= deadline) break;
    const { row, fallbacks } = buildCourse(p);
    fallbackHoles += fallbacks;
    rows.push(row);
  }
  // ignoreDuplicates: never overwrite a course the API built meanwhile.
  const { error: insErr } = await supabase.from('locations').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (insErr) throw new Error(`insert failed: ${insErr.message}`);
  built += rows.length;
  const rate = built / ((Date.now() - t0) / 60_000);
  console.log(`${region} shard ${shard}/${shards}: built ${built} courses (${rate.toFixed(0)}/min, ${fallbackHoles} fallback holes)`);
  if (rows.length < places.length) break;
}
console.log(`${region} shard ${shard}/${shards}: done, ${built} courses`);
