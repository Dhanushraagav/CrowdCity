import fs from 'fs';
import path from 'path';

const content = fs.readFileSync('c:/Users/dhanu/OneDrive/Desktop/CrowdCity AI/client/js/profile.js', 'utf8');
const lines = content.split('\n');
const results = [];

lines.forEach((line, idx) => {
  if (line.includes('i18n') || line.includes('render') || line.includes('load')) {
    results.push({
      lineNum: idx + 1,
      line: line.trim()
    });
  }
});

console.log(JSON.stringify(results, null, 2));
