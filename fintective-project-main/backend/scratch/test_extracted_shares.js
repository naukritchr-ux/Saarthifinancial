import { calculateShares } from "./extracted_files/invoiceHelpers.js";

const testCases = [
  // Pre-April 2026 (60/40 Split)
  { serviceCharges: 10000, info: "O", billDate: "2026-03-31", expectedFranchise: 6000, expectedCompany: 4000, label: "Pre-cutoff normal split" },
  { serviceCharges: 10000, info: "CN", billDate: "2026-03-31", expectedFranchise: 6000, expectedCompany: 0, label: "Pre-cutoff CN override" },
  { serviceCharges: 10000, info: "PP", billDate: "2026-03-31", expectedFranchise: 6000, expectedCompany: 2000, label: "Pre-cutoff PP override (halved company share)" },
  
  // Post-April 2026 (75/25 Split)
  { serviceCharges: 10000, info: "O", billDate: "2026-04-01", expectedFranchise: 7500, expectedCompany: 2500, label: "Post-cutoff normal split" },
  { serviceCharges: 10000, info: "CN", billDate: "2026-04-01", expectedFranchise: 7500, expectedCompany: 0, label: "Post-cutoff CN override" },
  { serviceCharges: 10000, info: "PP", billDate: "2026-04-01", expectedFranchise: 7500, expectedCompany: 1250, label: "Post-cutoff PP override (halved company share)" },
  
  // Fallback to today (Post-April 2026 since current date is 2026)
  { serviceCharges: 10000, info: "O", billDate: null, expectedFranchise: 7500, expectedCompany: 2500, label: "Fallback to current date (post-cutoff)" },
];

let failed = 0;
for (const tc of testCases) {
  const result = calculateShares(tc.serviceCharges, tc.info, tc.billDate);
  const pass = result.franchiseeShare === tc.expectedFranchise && result.ourShare === tc.expectedCompany;
  if (pass) {
    console.log(`✅ PASS: ${tc.label} (${tc.billDate || 'today'}, info: ${tc.info}) -> Franchise: ${result.franchiseeShare}, Company: ${result.ourShare}`);
  } else {
    console.error(`❌ FAIL: ${tc.label} (${tc.billDate || 'today'}, info: ${tc.info}) -> Got: { Franchise: ${result.franchiseeShare}, Company: ${result.ourShare} }, Expected: { Franchise: ${tc.expectedFranchise}, Company: ${tc.expectedCompany} }`);
    failed++;
  }
}

if (failed === 0) {
  console.log("\n🎉 All functional test cases passed successfully!");
  process.exit(0);
} else {
  console.error(`\n❌ ${failed} test cases failed.`);
  process.exit(1);
}
