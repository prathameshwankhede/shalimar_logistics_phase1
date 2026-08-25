const fs = require('fs');

const files = [
  'src/components/AdminDashboard.jsx',
  'src/components/RateComparisonView.jsx',
  'src/components/TransporterPortal.jsx',
  'src/components/ParticularBidReportModal.jsx'
];

files.forEach((file) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('#ffffff') && (line.includes('company_name') || line.includes('transporter') || line.includes('company') || line.includes('mobile'))) {
      console.log(`${file} L${i + 1}: ${line.trim()}`);
    }
  });
});
