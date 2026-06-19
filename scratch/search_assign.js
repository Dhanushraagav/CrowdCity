import fs from 'fs';
import path from 'path';

const file = 'client/js/authority-issue-details.js';
const content = fs.readFileSync(file, 'utf8');

console.log(`Searching for "assign" or "assigned" in ${file}:`);
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('assign')) {
    console.log(`  Line ${idx + 1}: ${line.trim()}`);
  }
});
