const fs = require('fs');
const content = fs.readFileSync('src/components/TransporterPortal.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('handleExpressQuickSubmit') || line.includes('handleBatchSubmitAll')) {
    console.log(`L${i + 1}: ${line.trim()}`);
  }
});
