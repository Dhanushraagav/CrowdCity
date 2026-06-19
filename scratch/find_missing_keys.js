import fs from 'fs';
import path from 'path';

const clientDir = 'c:/Users/dhanu/OneDrive/Desktop/CrowdCity AI/client';

// Load translation files
const enPath = path.join(clientDir, 'locales/en.json');
const taPath = path.join(clientDir, 'locales/ta.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const taJson = JSON.parse(fs.readFileSync(taPath, 'utf8'));

const enKeys = new Set(Object.keys(enJson));
const taKeys = new Set(Object.keys(taJson));

// Regexes to find keys
const i18nRegexes = [
  /data-i18n="([^"]+)"/g,
  /data-i18n-placeholder="([^"]+)"/g,
  /data-i18n-title="([^"]+)"/g,
  /i18n\.t\(\s*['"]([^'"]+)['"]/g
];

const foundKeys = new Map(); // key -> file where it was found

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  
  for (const regex of i18nRegexes) {
    // Reset regex index
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const key = match[1];
      if (!foundKeys.has(key)) {
        foundKeys.set(key, []);
      }
      foundKeys.get(key).push(path.relative(clientDir, filePath));
    }
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'locales') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      scanFile(fullPath);
    }
  }
}

walkDir(clientDir);

const missingInEn = [];
const missingInTa = [];

for (const [key, files] of foundKeys.entries()) {
  // Ignore dynamic prefix matching suffixes like category_, status_, role_ which are computed dynamically
  if (key === 'category_' || key === 'status_' || key === 'role_') {
    continue;
  }
  if (!enKeys.has(key)) {
    missingInEn.push({ key, files: [...new Set(files)] });
  }
  if (!taKeys.has(key)) {
    missingInTa.push({ key, files: [...new Set(files)] });
  }
}

const report = {
  missingInEn,
  missingInTa
};

fs.writeFileSync('c:/Users/dhanu/OneDrive/Desktop/CrowdCity AI/scratch/missing_keys_report.json', JSON.stringify(report, null, 2));
console.log(`Report written. Missing in EN: ${missingInEn.length}, Missing in TA: ${missingInTa.length}`);
