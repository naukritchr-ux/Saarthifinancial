import db from "../config/db.js";
import {
  formatDateForMySQL,
  generateBillNumber,
  calculateServiceCharges,
  calculateGST,
  calculateDueDate,
  calculateShares
} from "../utils/invoiceHelpers.js";
import { processInvoiceIncentives } from "../controllers/incentiveController.js";

const enquiryToInvoiceMiddleware = async (req, res, next) => {
  const originalEnd = res.end;

  res.end = async function (chunk, encoding) {
    if (res.statusCode === 200 || res.statusCode === 201) {
      const url = req.originalUrl;
      const method = req.method;

      let responseData = {};
      try {
        responseData = chunk ? JSON.parse(chunk.toString()) : {};
      } catch (error) {
        console.error("⚠️ Could not parse response body:", error);
      }

      try {
        if (url.includes("/api/CandidateForm") && (method === "POST" || method === "PUT")) {
          await handleCandidateToInvoice(req.body, responseData);
        } else if (
          (url.includes("/api/CandidateForm2") || url.includes("/api/CandidateForm3")) &&
          (method === "POST" || method === "PUT")
        ) {
          await handleFormToCancellation(req.body, responseData, url);
        }
      } catch (err) {
        console.error("❌ Middleware processing error:", err);
      }
    }

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

async function handleCandidateToInvoice(candidateFormData, responseData) {
  const enquiryId = candidateFormData.enquiry_id;
  if (!enquiryId) return;

  const [enquiries] = await db.query("SELECT * FROM enquiries WHERE id = ?", [enquiryId]);
  if (enquiries.length === 0) {
    console.error("❌ Enquiry not found for ID:", enquiryId);
    return;
  }

  const enquiry = enquiries[0];
  const candidateFormId = responseData?.insertId || responseData?.id || null;

  // If an invoice already exists for this enquiry, update it instead of inserting a new one
  const [existingInvoices] = await db.query("SELECT id FROM invoice WHERE enquiry_id = ? LIMIT 1", [enquiryId]);
  if (existingInvoices.length > 0) {
    const invoiceId = existingInvoices[0].id;
    await db.query(
      `UPDATE invoice SET 
        candidateform_id = ?,
        franchiseName = ?,
        companyName = ?,
        companyAddress = ?,
        gstNo = ?,
        candidateName = ?,
        mobileNumber = ?,
        emailOfCandidate = ?,
        postOfCandidate = ?,
        yearOfExp = ?,
        sourceOfResume = ?,
        dateOfJoining = ?,
        annualSalaryOffered = ?
      WHERE id = ?`,
      [
        candidateFormId,
        enquiry.franchiseeName || null,
        enquiry.companyName || null,
        enquiry.addressLine1 || null,
        enquiry.gstNo || null,
        candidateFormData.candidateName || null,
        candidateFormData.mobileNumber || null,
        candidateFormData.emailId || null,
        candidateFormData.hireFor || null,
        candidateFormData.yearofexp || null,
        candidateFormData.sourceOfCV || null,
        formatDateForMySQL(candidateFormData.dateOfJoining) || null,
        candidateFormData.salaryOffer || null,
        invoiceId,
      ]
    );
    console.log("ℹ️ Existing invoice updated for enquiry:", enquiryId);
    await db.query("UPDATE enquiries SET enquiryStatus = 'invoiced' WHERE id = ?", [enquiryId]);
    return;
  }

  const invoiceData = {
    enquiry_id: enquiryId,
    candidateform_id: candidateFormId,
    franchiseName: enquiry.franchiseeName,
    contactPersonName: enquiry.hrExecutiveName,
    payingGst: "",
    isProprietor: "",
    teamLeader: enquiry.teamLeaderName,
    companyName: enquiry.companyName,
    companyAddress: enquiry.addressLine1,
    companyCity: "",
    state: "",
    isFromMaharashtra: "",
    contactPerson: enquiry.hrExecutiveName,
    designation: enquiry.designation,
    contactNumber: enquiry.mobileNo,
    contactEmail: enquiry.emailId,
    gstNo: enquiry.gstNo,
    industry: "",
    subIndustry: "",
    serviceCharge: enquiry.placementFees,
    creditPeriod: enquiry.creditPeriod,
    replacementPeriod: enquiry.replacementPeriod,
    candidateName: candidateFormData.candidateName,
    mobileNumber: candidateFormData.mobileNumber,
    emailOfCandidate: candidateFormData.emailId,
    postOfCandidate: candidateFormData.hireFor,
    yearOfExp: candidateFormData.yearofexp,
    sourceOfResume: candidateFormData.sourceOfCV,
    dateOfJoining: formatDateForMySQL(candidateFormData.dateOfJoining),
    annualSalaryOffered: candidateFormData.salaryOffer,
    nameOfBd: enquiry.bdMemberName,
    billDate: new Date().toISOString().split("T")[0],
    billNumber: generateBillNumber(),
    info: "O"
  };

  const serviceCharges = calculateServiceCharges(invoiceData.annualSalaryOffered, invoiceData.serviceCharge);
  const { cgst, sgst, igst, totalGst } = calculateGST(serviceCharges, invoiceData.isFromMaharashtra);
  const totalBillAmt = serviceCharges + totalGst;
  const dueDate = calculateDueDate(invoiceData.billDate, invoiceData.creditPeriod);
  // Same shared formula used in invoiceController.createInvoice — keeps the
  // franchisee/company split consistent regardless of which path created
  // the invoice, and respects the April 2026 rate change automatically via
  // invoiceData.billDate.
  const { franchiseeShare, ourShare } = calculateShares(
    serviceCharges,
    invoiceData.info,
    invoiceData.billDate
  );

  Object.assign(invoiceData, {
    serviceCharges,
    CGST: cgst,
    SGST: sgst,
    IGST: igst,
    totalGST: totalGst,
    totalBillAmt,
    dueDate,
    tds: Math.round(serviceCharges * 0.1),
    franchiseeShare,
    ourShare,
    franchiseeGST: Math.round(serviceCharges * 0.18)
  });

  const [invoiceResult] = await db.query("INSERT INTO invoice SET ?", [invoiceData]);
  console.log("✅ Invoice created. ID:", invoiceResult.insertId);

  // Process incentives for the new invoice
  try {
    await processInvoiceIncentives(invoiceResult.insertId);
    console.log("✅ Incentives processed for invoice ID:", invoiceResult.insertId);
  } catch (error) {
    console.error("❌ Error processing incentives for invoice ID:", invoiceResult.insertId, error);
  }

  await db.query("UPDATE enquiries SET enquiryStatus = 'invoiced' WHERE id = ?", [enquiryId]);
}

async function handleFormToCancellation(formData, responseData, url) {
  const enquiryId = formData.enquiry_id;
  if (!enquiryId) return;

  const isForm2 = url.includes("/api/CandidateForm2");

  const [enquiries] = await db.query("SELECT * FROM enquiries WHERE id = ?", [enquiryId]);
  if (enquiries.length === 0) {
    console.error("❌ Enquiry not found for ID:", enquiryId);
    return;
  }

  const enquiry = enquiries[0];
  const formId = responseData.id || null;

  const cancellationData = {
    enquiry_id: enquiryId,
    [isForm2 ? "candidateform2_id" : "candidateform3_id"]: formId,
    emailAddress: enquiry.emailId,
    nameOfFranchise: enquiry.franchiseeName,
    nameOfCompany: enquiry.companyName,
    cancelChange: isForm2 ? "Cancel" : "Change",
    billNo: formData.billNo,
    serviceChargeAmount: isForm2 ? formData.serviceCharge : 0,
    reasonOfCancel: isForm2 ? formData.reasonForCreditNote : formData.revisionDetails,
    candidateName: isForm2 ? "" : formData.candidateName,
    detailsChangesRequired: isForm2 ? "" : formData.revisionDetails
  };

  const [cancelResult] = await db.query("INSERT INTO cancellation SET ?", [cancellationData]);
  console.log("✅ Cancellation created. ID:", cancelResult.insertId);

  const newStatus = isForm2 ? "cancelled" : "revised";
  await db.query("UPDATE enquiries SET enquiryStatus = ? WHERE id = ?", [newStatus, enquiryId]);
}

export default enquiryToInvoiceMiddleware;
