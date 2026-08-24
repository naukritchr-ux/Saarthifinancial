import { calculateShares } from "./extracted_files/invoiceHelpers.js";

// Mock allowed fields list
const allowedFields = [
  "enquiry_id",
  "candidateform_id",
  "franchiseName",
  "serviceCharges",
  "info",
  "billDate",
  "franchiseeShare",
  "ourShare",
  // Notice that "isManualShareOverride" is currently missing in the user's allowedFields list.
];

// Let's test the logic for update fields extraction
function processUpdate(reqBody, currentDbRow) {
  const updateFields = {};
  
  allowedFields.forEach((field) => {
    if (reqBody.hasOwnProperty(field)) {
      updateFields[field] = reqBody[field];
    }
  });

  // Re-run the update logic block
  const isManualOverride = updateFields.hasOwnProperty("isManualShareOverride")
    ? updateFields.isManualShareOverride
    : currentDbRow?.isManualShareOverride;

  if (
    isManualOverride ||
    updateFields.hasOwnProperty("serviceCharges") ||
    updateFields.hasOwnProperty("info") ||
    updateFields.hasOwnProperty("billDate")
  ) {
    const effectiveServiceCharges = updateFields.hasOwnProperty("serviceCharges")
      ? updateFields.serviceCharges
      : currentDbRow?.serviceCharges;
    const effectiveInfo = updateFields.hasOwnProperty("info")
      ? updateFields.info
      : currentDbRow?.info;
    const effectiveBillDate = updateFields.hasOwnProperty("billDate")
      ? updateFields.billDate
      : currentDbRow?.billDate;

    const effectiveFranchiseeShare = updateFields.hasOwnProperty("franchiseeShare")
      ? updateFields.franchiseeShare
      : currentDbRow?.franchiseeShare;
    const effectiveOurShare = updateFields.hasOwnProperty("ourShare")
      ? updateFields.ourShare
      : currentDbRow?.ourShare;

    const { franchiseeShare, ourShare } = calculateShares(
      effectiveServiceCharges,
      effectiveInfo,
      effectiveBillDate,
      isManualOverride,
      effectiveFranchiseeShare,
      effectiveOurShare
    );
    updateFields.franchiseeShare = franchiseeShare;
    updateFields.ourShare = ourShare;
  } else {
    delete updateFields.franchiseeShare;
    delete updateFields.ourShare;
  }

  return updateFields;
}

// Test case 1: Try to send a manual override with the current missing list
const reqBodyOverride = {
  isManualShareOverride: 1,
  franchiseeShare: 5000,
  ourShare: 5000,
  serviceCharges: 10000,
};

const currentDbRow = {
  isManualShareOverride: 0,
  serviceCharges: 10000,
  franchiseeShare: 7500,
  ourShare: 2500,
  info: "O",
  billDate: "2026-05-01"
};

const output = processUpdate(reqBodyOverride, currentDbRow);
console.log("Test with missing 'isManualShareOverride' in allowedFields:");
console.log("Input:", reqBodyOverride);
console.log("Output updateFields:", output);
if (output.franchiseeShare === 7500 && output.ourShare === 2500) {
  console.log("❌ BUG REPLICATED: The manual shares were overwritten by the default 75/25 formula because isManualShareOverride was stripped!");
} else {
  console.log("✅ SUCCESS");
}
