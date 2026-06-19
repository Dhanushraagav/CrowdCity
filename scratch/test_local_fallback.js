import { getLocalFallbackAnalysis } from '../server/services/groqService.js';

const examples = [
  { title: "Broken Footpath near park", desc: "tripping hazard on footpath" },
  { title: "Streetlight Not Working", desc: "light bulb needs replacement" },
  { title: "Water Leakage", desc: "pipe burst near hydrant" },
  { title: "Blocked Drain", desc: "gutter is clogged" },
  { title: "Overflowing Garbage Bin", desc: "illegal trash dump" },
  { title: "Traffic Signal Failure", desc: "missing sign or broken signal" },
  { title: "Broken Bus Stop Bench", desc: "damaged public seat" },
  { title: "Park Equipment Damage", desc: "playground fence broken" },
  { title: "Dirty Public Toilet", desc: "unclean restroom facility" },
  { title: "Open Manhole", desc: "exposed street hole danger" },
  { title: "Mosquito Breeding Area", desc: "standing water pollution" },
  { title: "Unknown issue", desc: "alien spacecraft landed" }
];

console.log("Verifying Local Fallback Analyzer...\n");
examples.forEach(ex => {
  const result = getLocalFallbackAnalysis(ex.title, ex.desc);
  console.log(`Title: "${ex.title}"`);
  console.log(` -> Category: "${result.category}"`);
  console.log(` -> Department: "${result.department}"`);
  console.log(` -> Priority: "${result.priority}"\n`);
});
