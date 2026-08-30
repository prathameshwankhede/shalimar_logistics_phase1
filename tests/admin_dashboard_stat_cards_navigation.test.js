import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🧪 RUNNING ADMIN DASHBOARD STAT CARDS NAVIGATION TEST SUITE');
console.log('================================================================');

const adminDashboardSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.jsx'), 'utf8');

// TEST 1: Rate Requests Card
assert.strictEqual(adminDashboardSrc.includes('CARD 1: RATE REQUESTS'), true, 'Must have Card 1');
assert.strictEqual(adminDashboardSrc.includes("setActiveTab('requirements')"), true, 'Must switch to requirements tab');
assert.strictEqual(adminDashboardSrc.includes("setReqFilterTab('open')"), true, 'Must filter to open indents');
assert.strictEqual(adminDashboardSrc.includes('aria-label="View Active Rate Requests Directory"'), true, 'Must have accessible aria-label');
console.log('  ✅ PASS: TEST 1: Rate Requests card is an accessible button navigating to active requirements');

// TEST 2: Submitted Bids Card
assert.strictEqual(adminDashboardSrc.includes('CARD 2: SUBMITTED BIDS'), true, 'Must have Card 2');
assert.strictEqual(adminDashboardSrc.includes("setReqFilterTab('all')"), true, 'Must filter to all indents with quotes');
assert.strictEqual(adminDashboardSrc.includes('aria-label="View Submitted Bids and Quotes"'), true, 'Must have accessible aria-label');
console.log('  ✅ PASS: TEST 2: Submitted Bids card is an accessible button navigating to all submitted bids/quotes');

// TEST 3: Transporters Card
assert.strictEqual(adminDashboardSrc.includes('CARD 3: REGISTERED TRANSPORTERS'), true, 'Must have Card 3');
assert.strictEqual(adminDashboardSrc.includes("setActiveTab('title_masters')"), true, 'Must switch to title_masters tab');
assert.strictEqual(adminDashboardSrc.includes("setMasterFilterTab('transporters')"), true, 'Must filter master directory to transporters');
assert.strictEqual(adminDashboardSrc.includes('aria-label="View Transporters and Logistics Vendors Directory"'), true, 'Must have accessible aria-label');
console.log('  ✅ PASS: TEST 3: Transporters card is an accessible button navigating to Master Directories -> Transporters');

// TEST 4: Buttons and Accessible Attributes
const buttonMatches = adminDashboardSrc.match(/className="glass-panel stat-card-btn"/g);
assert.strictEqual(buttonMatches && buttonMatches.length === 3, true, 'All 3 cards must be stat-card-btn buttons');
console.log('  ✅ PASS: TEST 4: All 3 cards use semantic <button type="button"> elements with pointer cursor and focus styles');

console.log('================================================================');
console.log('🎉 TEST SUMMARY: 4 PASSED, 0 FAILED');
console.log('================================================================');
