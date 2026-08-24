const fs = require('fs');
const content = fs.readFileSync('src/components/AdminDashboard.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Clear All Data') || line.includes('Start Fresh')) {
    console.log(`L${i + 1}: ${line.trim()}`);
  }
});
