import fs from 'fs';
import path from 'path';

const dir = 'c:\\Users\\dhanu\\OneDrive\\Desktop\\CrowdCity AI\\client\\js';
const files = fs.readdirSync(dir);

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.statSync(filePath).isFile() && path.extname(file) === '.js') {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('badge-category') || line.includes('badge') && line.includes('category') && line.includes('issue')) {
        console.log(`${file} : Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
