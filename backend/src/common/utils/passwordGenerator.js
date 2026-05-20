const WORDS_A = [
  'Mango', 'Tiger', 'Apple', 'Eagle', 'Storm', 'River', 'Cedar', 'Frost',
  'Brave', 'Swift', 'Solar', 'Amber', 'Blaze', 'Crisp', 'Delta', 'Ember',
];

const WORDS_B = [
  'Lion', 'Creek', 'Flame', 'Hawk', 'Ridge', 'Birch', 'Crest', 'Dune',
  'Grove', 'Maple', 'Spark', 'Trail', 'Stone', 'Cliff', 'Bloom', 'Flint',
];

function generate() {
  const a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)];
  const n = Math.floor(Math.random() * 90) + 10; // 10–99
  const b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
  return `${a}${n}-${b}`; // e.g. "Mango37-Lion"
}

module.exports = { generate };
