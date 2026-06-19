import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\dhanu\\OneDrive\\Desktop\\CrowdCity AI\\server\\controllers\\issueController.js', 'utf8');
const lines = content.split('\n');

const keywords = ['validCategories', 'categories', 'pothole', 'garbage', 'leakage', 'streetlight', 'drainage', 'road'];

lines.forEach((line, idx) => {
  const match = keywords.some(k => line.includes(k));
  if (match) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
