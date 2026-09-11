import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAW_DIR = path.resolve(__dirname, '../data/raw_tnrd');

if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

function fetchHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false, timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}: Status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

function parseTableRows(html) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i) || html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tbodyMatch) return [];
  const rowMatches = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  const rows = [];
  for (const r of rowMatches) {
    const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(td => {
      return td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}

async function main() {
  console.log('=== Sourcing Authoritative TNRD Government Datasets ===');

  // 1. Fetch Blocks (English + Tamil)
  console.log('\n1. Fetching TNRD 388 Blocks...');
  const blocksEnHtml = await fetchHttps('https://tnrd.tn.gov.in/rdweb_newsite/project/admin/block_lgd_bcode.php?xls=1&lang=en');
  const blocksTaHtml = await fetchHttps('https://tnrd.tn.gov.in/rdweb_newsite/project/admin/block_lgd_bcode.php?xls=1&lang=ta');

  const blocksEnRows = parseTableRows(blocksEnHtml);
  const blocksTaRows = parseTableRows(blocksTaHtml);

  const tamilBlockNameByLgd = new Map();
  for (const r of blocksTaRows) {
    if (r.length >= 4) {
      const blockLgd = r[2].trim();
      const blockNameTa = r[3].trim();
      tamilBlockNameByLgd.set(blockLgd, blockNameTa);
    }
  }

  const blocks = [];
  for (const r of blocksEnRows) {
    if (r.length >= 4) {
      const distLgd = r[0].trim();
      const distName = r[1].trim();
      const blockLgd = r[2].trim();
      const blockName = r[3].trim();
      const blockNameTa = tamilBlockNameByLgd.get(blockLgd) || blockName;

      blocks.push({
        district_lgd_code: distLgd,
        district_name: distName,
        block_lgd_code: blockLgd,
        block_name: blockName,
        block_name_ta: blockNameTa,
        source: 'tnrd.tn.gov.in',
        verified_at: new Date().toISOString()
      });
    }
  }
  console.log(`✓ Parsed ${blocks.length} official Blocks`);
  fs.writeFileSync(path.join(RAW_DIR, 'tnrd_blocks.json'), JSON.stringify(blocks, null, 2), 'utf-8');

  // 2. Fetch Village Panchayats (English + Tamil)
  console.log('\n2. Fetching TNRD 12,525 Village Panchayats (English & Tamil)...');
  const vpEnHtml = await fetchHttps('https://tnrd.tn.gov.in/rdweb_newsite/project/admin/village_lgd_pvcode.php?xls=1&lang=en');
  const vpTaHtml = await fetchHttps('https://tnrd.tn.gov.in/rdweb_newsite/project/admin/village_lgd_pvcode.php?xls=1&lang=ta');

  const vpEnRows = parseTableRows(vpEnHtml);
  const vpTaRows = parseTableRows(vpTaHtml);

  const tamilVpByLgd = new Map();
  for (const r of vpTaRows) {
    if (r.length >= 6) {
      const vpLgd = r[4].trim();
      const vpNameTa = r[5].trim();
      tamilVpByLgd.set(vpLgd, vpNameTa);
    }
  }

  const villagePanchayats = [];
  for (const r of vpEnRows) {
    if (r.length >= 6) {
      const distLgd = r[0].trim();
      const distName = r[1].trim();
      const blockLgd = r[2].trim();
      const blockName = r[3].trim();
      const vpLgd = r[4].trim();
      const vpName = r[5].trim();
      const vpNameTa = tamilVpByLgd.get(vpLgd) || vpName;

      villagePanchayats.push({
        district_lgd_code: distLgd,
        district_name: distName,
        block_lgd_code: blockLgd,
        block_name: blockName,
        village_lgd_code: vpLgd,
        village_name: vpName,
        village_name_ta: vpNameTa,
        source: 'tnrd.tn.gov.in',
        verified_at: new Date().toISOString()
      });
    }
  }
  console.log(`✓ Parsed ${villagePanchayats.length} official Village Panchayats`);
  fs.writeFileSync(path.join(RAW_DIR, 'tnrd_village_panchayats.json'), JSON.stringify(villagePanchayats, null, 2), 'utf-8');

  console.log('\n=== TNRD Ingestion Raw Data Successfully Acquired ===');
}

main().catch(err => {
  console.error('Fatal fetch error:', err);
  process.exit(1);
});
