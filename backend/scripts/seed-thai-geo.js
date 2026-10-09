/**
 * Seeds Thai provinces / districts / subdistricts (+ postal codes) into Supabase.
 * Run once after migration 001:   npm run seed:thai-geo
 * Safe to re-run (upserts by id).
 *
 * Data: src/db/data/thai_geo.json — from github.com/kongvut/thai-province-data (MIT).
 */
require('dotenv').config();
const path = require('path');
const supabase = require('../src/config/supabase');

const data = require(path.join(__dirname, '../src/db/data/thai_geo.json'));
const BATCH = 1000;

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

(async () => {
  await upsert('th_provinces', data.provinces.map(([id, name_th, name_en]) => ({ id, name_th, name_en })));
  await upsert('th_districts', data.districts.map(([id, province_id, name_th, name_en]) => ({ id, province_id, name_th, name_en })));
  await upsert('th_subdistricts', data.subdistricts.map(([id, district_id, name_th, name_en, postal_code]) => ({
    id, district_id, name_th, name_en, postal_code,
  })));
  console.log('✅ Thai geography seeded');
})().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
