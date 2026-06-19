import fs from 'fs';
import path from 'path';

const clientJsDir = 'c:/Users/dhanu/OneDrive/Desktop/CrowdCity AI/client/js';
const files = fs.readdirSync(clientJsDir).filter(f => f.endsWith('.js'));

const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(clientJsDir, file), 'utf8');
  if (content.includes('language-change')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('language-change')) {
        // Find surrounding lines (3 lines after)
        const block = lines.slice(idx, idx + 8).map(l => l.trim()).join(' | ');
        results.push({
          file,
          lineNum: idx + 1,
          context: block
        });
      }
    });
  }
}

console.log(JSON.stringify(results, null, 2));
