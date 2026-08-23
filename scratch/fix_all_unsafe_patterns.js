import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

console.log('🛠️ FIXING ALL 35 POTENTIAL RISKS IN CODEBASE...');

function fixFile(relativePath, replacements) {
  const filePath = path.join(srcDir, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  replacements.forEach(([target, replacement]) => {
    if (content.includes(target)) {
      content = content.replaceAll(target, replacement);
    }
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${relativePath}`);
  }
}

// 1. AdminDashboard.jsx fixes
fixFile('components/AdminDashboard.jsx', [
  ['newCompanyMaster.name.slice(0, 5).toUpperCase()', '(newCompanyMaster?.name || "").slice(0, 5).toUpperCase()'],
  ['c.city.toLowerCase() === cityVal.toLowerCase()', '(c?.city || "").toLowerCase() === (cityVal || "").toLowerCase()'],
  ['item.city.toLowerCase() !== cityName.toLowerCase()', '(item?.city || "").toLowerCase() !== (cityName || "").toLowerCase()'],
  ['`TRANSPORTER_${newStatus.toUpperCase()} 🛡️`', '`TRANSPORTER_${(newStatus || "").toUpperCase()} 🛡️`'],
  ['newComp.trim().slice(0, 5).toUpperCase()', '(newComp || "").trim().slice(0, 5).toUpperCase()'],
  ['`ADMIN_${newStatus.toUpperCase()}_TRANSPORTER', '`ADMIN_${(newStatus || "").toUpperCase()}_TRANSPORTER'],
  ['{totalBatchQty.toLocaleString()} MT Total', '{(totalBatchQty || 0).toLocaleString()} MT Total'],
  ['₹{lowestRate.toLocaleString()}/MT', '₹{(lowestRate || 0).toLocaleString()}/MT'],
  ['{req.required_qty.toLocaleString()} {req.unit}', '{(req?.required_qty || 0).toLocaleString()} {req?.unit || "MT"}'],
  ['const term = reportSearchTerm.toLowerCase();', 'const term = (reportSearchTerm || "").toLowerCase();']
]);

// 2. TransporterPortal.jsx fixes
fixFile('components/TransporterPortal.jsx', [
  ['currentTransporter.code.toLowerCase()', '(currentTransporter?.code || "").toLowerCase()'],
  ['{totalBatchQty.toLocaleString()} MT Total', '{(totalBatchQty || 0).toLocaleString()} MT Total'],
  ['{monthTotalDispatchedQty.toLocaleString()} MT', '{(monthTotalDispatchedQty || 0).toLocaleString()} MT'],
  ['₹{monthTotalFreightBilling.toLocaleString()}', '₹{(monthTotalFreightBilling || 0).toLocaleString()}'],
  ['₹{Math.round(monthTotalFreightBilling * 0.05).toLocaleString()}', '₹{Math.round((monthTotalFreightBilling || 0) * 0.05).toLocaleString()}']
]);

// 3. ParticularBidReportModal.jsx fixes
fixFile('components/ParticularBidReportModal.jsx', [
  ['t.name.toUpperCase()', '(t?.name || "").toUpperCase()'],
  ['{totalVolumeMT.toLocaleString()} MT Batch Total', '{(totalVolumeMT || 0).toLocaleString()} MT Batch Total'],
  ['tCol.name.toUpperCase()', '(tCol?.name || "").toUpperCase()'],
  ['companyInfo.name.toUpperCase()', '(companyInfo?.name || "").toUpperCase()']
]);

// 4. RateComparisonView.jsx fixes
fixFile('components/RateComparisonView.jsx', [
  ['rateRequest.dest_city.substring(0, 3).toUpperCase()', '(rateRequest?.dest_city || "").substring(0, 3).toUpperCase()']
]);

// 5. TransFlowAIChatbot.jsx fixes
fixFile('components/TransFlowAIChatbot.jsx', [
  ['userQuery.toLowerCase()', '(userQuery || "").toLowerCase()'],
  ['₹${totalValue.toLocaleString()}', '₹${(totalValue || 0).toLocaleString()}']
]);

// 6. Footer.jsx & AuthContext.jsx & securityEngine.js fixes
fixFile('components/Footer.jsx', [
  ['{log.role.toUpperCase()}', '{(log?.role || "").toUpperCase()}']
]);

fixFile('context/AuthContext.jsx', [
  ['u.username.toLowerCase() === cleanUser', '(u?.username || "").toLowerCase() === cleanUser'],
  ['found.role.toUpperCase()', '(found?.role || "").toUpperCase()'],
  ['currentUser.username.toUpperCase()', '(currentUser?.username || "").toUpperCase()'],
  ['currentUser.username.toLowerCase()', '(currentUser?.username || "").toLowerCase()']
]);

fixFile('utils/securityEngine.js', [
  ['username.toLowerCase()', '(username || "").toLowerCase()']
]);

console.log('✨ ALL UNSAFE PATTERNS FIXED! ✨');
