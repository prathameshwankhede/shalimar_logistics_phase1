const fs = require('fs');
const content = fs.readFileSync('src/components/TransporterPortal.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Close Batch') || line.includes('maxHeight') || line.includes('sub-indents')) {
    console.log(`L${i + 1}: ${line.trim()}`);
  }
});
