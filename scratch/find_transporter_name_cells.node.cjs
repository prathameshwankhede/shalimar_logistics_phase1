const fs = require('fs');

function searchFile(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('TRANSPORTER NAME') || line.includes('company_name') || line.includes('ID:')) {
      console.log(`${filename} L${i + 1}: ${line.trim()}`);
    }
  });
}

searchFile('src/components/RateComparisonView.jsx');
searchFile('src/components/AdminDashboard.jsx');
searchFile('src/components/ParticularBidReportModal.jsx');
