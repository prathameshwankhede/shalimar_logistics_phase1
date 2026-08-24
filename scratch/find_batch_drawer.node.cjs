const fs = require('fs');
const content = fs.readFileSync('src/components/AdminDashboard.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Close Batch') || line.includes('Showing all') || line.includes('maxHeight')) {
    console.log(`L${i + 1}: ${line.trim()}`);
  }
});
