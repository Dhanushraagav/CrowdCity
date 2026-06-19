import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.gemini') && !file.includes('dist')) {
        results = results.concat(walk(filePath));
      }
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const workspaceDir = process.cwd();
const files = walk(workspaceDir);

console.log(`Searching for "alert(" in ${workspaceDir}...`);
files.forEach(f => {
  const ext = path.extname(f);
  if (ext === '.js' || ext === '.html') {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('alert(') && !f.includes('find_alerts.js')) {
      console.log(`Found in: ${path.relative(workspaceDir, f)}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('alert(')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
