import db from "../config/db.js"
import jwt from "jsonwebtoken"
import { calculateShares } from "../utils/invoiceHelpers.js"
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret"

// --- START OF MODIFICATION ---
export const getFranchisePayments = async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    let user = null

    if (authHeader) {
      const token = authHeader.split(" ")[1]
      try {
        user = jwt.verify(token, JWT_SECRET)
      } catch (err) {
        console.error("Token verification failed:", err)
      }
    }

    // Base query to select invoices with 'PP' or 'PR' status
    // Aliasing columns to match the frontend's expected keys
    let query = `
      SELECT
        id,
        franchiseName AS 'FRANCHISEE NAME',
        companyName AS 'CLIENT NAME',
        billNumber AS 'INVOICE NO',
        billDate AS 'INVOICE DATE',
        annualSalaryOffered AS 'ANNUAL SALARY',
        serviceCharge AS 'SERVICE CHARGE AGREED',
        serviceCharges AS 'SERVICE CHARGE',
        totalGST AS 'TOTAL GST',
        totalBillAmt AS 'TOTAL BILL AMT',
        amountReceived AS 'AMOUNT RECEIVED',
        tds AS 'TDS',
        franchiseeShare AS 'FRANCHISE SHARE',
        franchiseeGST AS 'GST IF ANY',
        amountDue AS 'AMOUNT DUE',
        tdsFF AS 'TDS FF',
        info AS 'STATUS',
        paidOnDate as 'PAID ON DATE',
        payment_mode as 'PAYMENT MODE',
        uid_transaction_id as 'UID NO',
        (amountDue - tdsFF) AS 'AMOUNT PAID'
      FROM invoice
      WHERE info IN ('PP', 'PR')
    `
    const queryParams = []

    // Filter by franchisee if the user is a franchisee
    if (user) {
  if (user.role === "franchisee" && user.franchiseName) {
    query += " AND franchiseName = ?"
    queryParams.push(user.franchiseName)
  } else if (user.role === "teamLeader" && user.name) {
    query += " AND teamLeader = ?"
    queryParams.push(user.name)
  }
}
    
    // Add search functionality
    const { search } = req.query
    if (search) {
      const searchTerm = `%${search}%`
      query +=
        " AND (franchiseName LIKE ? OR companyName LIKE ? OR billNumber LIKE ? OR info LIKE ?)"
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    const [results] = await db.query(query, queryParams)
    res.json(results)
  } catch (err) {
    console.error("Error fetching franchise payments:", err)
    res.status(500).json({ error: err.message })
  }
}
// This new controller must be linked to the GET /api/franchise-payments route in your router file.
// --- END OF MODIFICATION ---

export const getAllInvoices = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        console.error("Token verification failed:", err);
      }
    }

    let query = "SELECT * FROM invoice";
    const queryParams = [];
    const conditions = [];

    if (user) {
      if (user.role === "franchisee" && user.franchiseeName) {
        conditions.push("franchiseName = ?");
        queryParams.push(user.franchiseeName);
      } 
      // ADDED: Filter by team leader name from token
      else if (user.role === "teamLeader" && user.name) {
  // Use wildcards to match first and last names
  // This allows "SURBHI JAIN" to match "Surbhi Vinod Jain"
  const nameParts = user.name.split(" ");
  const first = nameParts[0];
  const last = nameParts[nameParts.length - 1];

  conditions.push("teamLeader LIKE ?");
  queryParams.push(`${first}%${last}`);
      }
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    const [results] = await db.query(query, queryParams);
    res.json(results);
  } catch (err) {
    console.error("Error fetching invoices:", err);
    res.status(500).json({ error: err.message });
  }
}
export const getInvoiceById = async (req, res) => {
  const { id } = req.params

  try {
    const [results] = await db.query("SELECT * FROM invoice WHERE id = ?", [id])

    if (results.length === 0) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    res.json(results[0])
  } catch (err) {
    console.error("Error fetching invoice:", err)
    res.status(500).json({ error: err.message })
  }
}

// Function to calculate GST based on Maharashtra status
const calculateGST = (serviceCharges, isFromMaharashtra) => {
  const serviceChargesNum = Number.parseFloat(serviceCharges) || 0

  if (isFromMaharashtra === "Yes") {
    // Maharashtra: CGST 9% + SGST 9%
    const cgst = Math.round(serviceChargesNum * 0.09)
    const sgst = Math.round(serviceChargesNum * 0.09)
    const totalGST = cgst + sgst

    return {
      CGST: cgst,
      SGST: sgst,
      IGST: 0,
      totalGST: totalGST,
    }
  } else {
    // Outside Maharashtra: IGST 18%
    const igst = Math.round(serviceChargesNum * 0.18)

    return {
      CGST: 0,
      SGST: 0,
      IGST: igst,
      totalGST: igst,
    }
  }
}

export const updateInvoice = async (req, res) => {
  const { id } = req.params
  const invoiceData = { ...req.body }
  delete invoiceData.id

  try {
    console.log("=== UPDATE INVOICE DEBUG ===")
    console.log("Invoice ID:", id)
    console.log("Raw request body:", req.body)

    const updateFields = {}

    const allowedFields = [
      "enquiry_id",
      "candidateform_id",
      "franchiseName",
      "contactPersonName",
      "payingGst",
      "isProprietor",
      "teamLeader",
      "companyName",
      "companyAddress",
      "companyCity",
      "pinCode",
      "state",
      "isFromMaharashtra",
      "companyFromMaharashtra",
      "contactPerson",
      "designation",
      "contactNumber",
      "contactEmail",
      "gstNo",
      "industry",
      "subIndustry",
      "serviceCharge",
      "creditPeriod",
      "replacementPeriod",
      "candidateName",
      "mobileNumber",
      "emailOfCandidate",
      "postOfCandidate",
      "yearOfExp",
      "sourceOfResume",
      "dateOfJoining",
      "annualSalaryOffered",
      "nameOfBd",
      "billDate",
      "billNumber",
      "serviceCharges",
      "CGST",
      "SGST",
      "IGST",
      "totalGST",
      "totalBillAmt",
      "dueDate",
      "info",
      "creditDate",
      "creditNoteNo",
      "dateReceived",
      "amountReceived",
      "tds",
      "tdsFF",
      "franchiseeShare",
      "franchiseeGST",
      "amountDue",
      "paidOnDate",
      "soaNo",
      "debitCorrection",
      "gstPaidStatus",
      "gstPaidReceived",
      "ourShare",
      "monthOfBill",
      "financialYear",
      "financialYearReceived",
      "revisionDetails",
      "franchiseeInvoice",
      "remarks",
      "areYouPayingGstClient",
      "tallyUpdated",
      "candidateEmailId",
      "candidateMobileNumber",
      "candidateYearOfExp",
      "sourceOfCV",
      "candidateDateOfBirth",
      "candidateSalaryOffer",
      "candidateHireFor",
      "candidateDateOfJoining",
      "payment_mode",
      "uid_transaction_id",
      "is_payment_done",
      "tlVerified",
    ]

    const dateFields = [
      "billDate",
      "dateOfJoining",
      "creditDate",
      "dateReceived",
      "paidOnDate",
      "dueDate",
      "candidateDateOfBirth",
      "candidateDateOfJoining",
    ]

    const decimalFields = [
      "serviceCharges",
      "CGST",
      "SGST",
      "IGST",
      "totalGST",
      "totalBillAmt",
      "amountReceived",
      "tds",
      "tdsFF",
      "franchiseeShare",
      "franchiseeGST",
      "amountDue",
      "ourShare",
    ]

    allowedFields.forEach((field) => {
      if (invoiceData.hasOwnProperty(field)) {
        const value = invoiceData[field]

        if (dateFields.includes(field)) {
          if (value && !isNaN(new Date(value).getTime())) {
            updateFields[field] = new Date(value).toISOString().split("T")[0]
          } else {
            updateFields[field] = null
          }
        } else if (decimalFields.includes(field)) {
          if (value === null || value === undefined || value === "") {
            updateFields[field] = null // Set to NULL if empty or null
          } else {
            const parsedValue = parseFloat(value)
            // If parsing fails (returns NaN), also set to NULL
            updateFields[field] = isNaN(parsedValue) ? null : parsedValue
          }
        } else {
          updateFields[field] = value
        }
      }
    })

    console.log("Update fields after sanitization:", updateFields)

    // Server-side recompute of franchiseeShare/ourShare — re-enabled so the
    // frontend can no longer silently override these two fields with its
    // own (possibly stale/inconsistent) numbers. We recompute from the
    // *effective* serviceCharges/info/billDate: whatever's in this update
    // request, falling back to the invoice's current stored values for
    // anything not being changed in this call (partial updates still get
    // the correct split).
    if (
      updateFields.hasOwnProperty("serviceCharges") ||
      updateFields.hasOwnProperty("info") ||
      updateFields.hasOwnProperty("billDate")
    ) {
      const [[currentRow]] = await db.query(
        "SELECT serviceCharges, info, billDate FROM invoice WHERE id = ?",
        [id]
      )

      const effectiveServiceCharges = updateFields.hasOwnProperty("serviceCharges")
        ? updateFields.serviceCharges
        : currentRow?.serviceCharges
      const effectiveInfo = updateFields.hasOwnProperty("info")
        ? updateFields.info
        : currentRow?.info
      const effectiveBillDate = updateFields.hasOwnProperty("billDate")
        ? updateFields.billDate
        : currentRow?.billDate

      const { franchiseeShare, ourShare } = calculateShares(
        effectiveServiceCharges,
        effectiveInfo,
        effectiveBillDate
      )
      // Force these two fields regardless of what the client sent for them.
      updateFields.franchiseeShare = franchiseeShare
      updateFields.ourShare = ourShare
    } else {
      // Nothing that feeds the split changed in this request — don't touch
      // franchiseeShare/ourShare even if the client happened to send them,
      // since we have no new effective inputs to recompute from safely.
      delete updateFields.franchiseeShare
      delete updateFields.ourShare
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" })
    }

    console.log("Final update fields before DB:", updateFields)

    const fieldNames = Object.keys(updateFields)
    const fieldValues = Object.values(updateFields)
    const setClause = fieldNames.map((field) => `${field} = ?`).join(", ")
    const updateQuery = `UPDATE invoice SET ${setClause} WHERE id = ?`

    const [result] = await db.query(updateQuery, [...fieldValues, id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Invoice not found" })
    }

    const [updatedInvoice] = await db.query("SELECT * FROM invoice WHERE id = ?", [id])
    res.json({
      message: "Invoice updated successfully",
      updatedInvoice: updatedInvoice[0],
    })
  } catch (err) {
    console.error("Error updating invoice:", err)
    res.status(500).json({ error: err.message })
  }
}

export const deleteInvoice = async (req, res) => {
  const { id } = req.params;

  const frontendName = (req.body?.deletedBy || req.headers['x-deleted-by'] || "").trim();

  if (!frontendName) {
    return res.status(400).json({ error: "Deleter name is required." });
  }

  // AUTHORIZED DELETERS ONLY
  const AUTHORIZED_DELETERS = [
    "rashesh doshi",
    "bankim doshi",
    "purna suresh ghadi",
    "rasheshdoshi@tcmail.co.in",
    "hrutika.mohal@talentcorner.in",
    "Purnaghadi923@gmail.com",
    "rushali.rajgor@talentcorner.in",
    "bankim@talentcorner.in",
    "hrutika mohal",
    "rushali champak rajgor"
  ];

  const normalizedInput = frontendName.toLowerCase().trim();
  const isAuthorized = AUTHORIZED_DELETERS.some(auth => 
    normalizedInput === auth || normalizedInput.includes(auth) || auth.includes(normalizedInput)
  );

  if (!isAuthorized) {
    return res.status(403).json({ 
      error: `You are not authorized to delete invoices.` 
    });
  }

  let deletedBy = null;
  try {
    // Validate name exists in users3
    const [userRows] = await db.query(
      `SELECT name FROM crm_db.users3 WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
      [frontendName]
    );

    if (userRows.length > 0) {
      deletedBy = userRows[0].name;
    } else {
      const [partialRows] = await db.query(
        `SELECT name FROM crm_db.users3 
         WHERE LOWER(name) LIKE LOWER(?)
         LIMIT 1`,
        [`%${frontendName}%`]
      );
      if (partialRows.length > 0) {
        deletedBy = partialRows[0].name;
      } else {
        // Still allow if they passed the authorized check above — just use their name
        deletedBy = frontendName;
      }
    }
  } catch (err) {
    console.error("Error validating deleter name:", err);
    deletedBy = frontendName; // fallback
  }

  // ... rest of your existing delete logic unchanged (connection, backup, DELETE query)

  // Continue with the rest of your existing delete logic...
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // ... rest of your existing code unchanged

    // Step 1: Fetch full record
    const [rows] = await connection.query("SELECT * FROM invoice WHERE id = ?", [id]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Invoice not found" });
    }

    const r = rows[0];

    // Step 2: Insert into backup — columns matched exactly to invoice table
    await connection.query(
      `INSERT INTO invoice_backup_new (
        deleted_by,
        original_id,
        enquiry_id,
        candidateform_id,
        franchiseName,
        contactPersonName,
        payingGst,
        isProprietor,
        teamLeader,
        companyName,
        companyAddress,
        companyCity,
        pinCode,
        state,
        isFromMaharashtra,
        gstNo,
        industry,
        subIndustry,
        serviceCharge,
        creditPeriod,
        replacementPeriod,
        candidateName,
        postOfCandidate,
        annualSalaryOffered,
        dateOfJoining,
        nameOfBd,
        billDate,
        billNumber,
        serviceCharges,
        CGST,
        SGST,
        IGST,
        totalGST,
        totalBillAmt,
        dueDate,
        info,
        creditDate,
        creditNoteNo,
        dateReceived,
        amountReceived,
        tds,
        tdsFF,
        franchiseeShare,
        franchiseeGST,
        amountDue,
        paidOnDate,
        soaNo,
        gstPaidStatus,
        ourShare,
        monthOfBill,
        financialYear,
        financialYearReceived,
        remarks,
        areYouPayingGstClient,
        tallyUpdated,
        contactPerson,
        designation,
        contactNumber,
        contactEmail,
        companyFromMaharashtra,
        payment_mode,
        uid_transaction_id,
        is_payment_done,
        createdAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        deletedBy,              // deleted_by
        r.id,                   // original_id
        r.enquiry_id,           // enquiry_id
        r.candidateform_id,     // candidateform_id
        r.franchiseName,        // franchiseName
        r.contactPersonName,    // contactPersonName
        r.payingGst,            // payingGst
        r.isProprietor,         // isProprietor
        r.teamLeader,           // teamLeader
        r.companyName,          // companyName
        r.companyAddress,       // companyAddress
        r.companyCity,          // companyCity
        r.pinCode,              // pinCode
        r.state,                // state
        r.isFromMaharashtra,    // isFromMaharashtra
        r.gstNo,                // gstNo
        r.industry,             // industry
        r.subIndustry,          // subIndustry
        r.serviceCharge,        // serviceCharge
        r.creditPeriod,         // creditPeriod
        r.replacementPeriod,    // replacementPeriod
        r.candidateName,        // candidateName
        r.postOfCandidate,      // postOfCandidate
        r.annualSalaryOffered,  // annualSalaryOffered
        r.dateOfJoining,        // dateOfJoining
        r.nameOfBd,             // nameOfBd
        r.billDate,             // billDate
        r.billNumber,           // billNumber
        r.serviceCharges,       // serviceCharges
        r.CGST,                 // CGST
        r.SGST,                 // SGST
        r.IGST,                 // IGST
        r.totalGST,             // totalGST
        r.totalBillAmt,         // totalBillAmt
        r.dueDate,              // dueDate
        r.info,                 // info
        r.creditDate,           // creditDate
        r.creditNoteNo,         // creditNoteNo
        r.dateReceived,         // dateReceived
        r.amountReceived,       // amountReceived
        r.tds,                  // tds
        r.tdsFF,                // tdsFF
        r.franchiseeShare,      // franchiseeShare
        r.franchiseeGST,        // franchiseeGST
        r.amountDue,            // amountDue
        r.paidOnDate,           // paidOnDate
        r.soaNo,                // soaNo
        r.gstPaidStatus,        // gstPaidStatus
        r.ourShare,             // ourShare
        r.monthOfBill,          // monthOfBill
        r.financialYear,        // financialYear
        r.financialYearReceived,// financialYearReceived
        r.remarks,              // remarks
        r.areYouPayingGstClient,// areYouPayingGstClient
        r.tallyUpdated,         // tallyUpdated
        r.contactPerson,        // contactPerson
        r.designation,          // designation
        r.contactNumber,        // contactNumber
        r.contactEmail,         // contactEmail
        r.companyFromMaharashtra, // companyFromMaharashtra
        r.payment_mode,         // payment_mode
        r.uid_transaction_id,   // uid_transaction_id
        r.is_payment_done,      // is_payment_done
        r.createdAt             // createdAt
      ]
    );

    // Step 3: Delete original
    await connection.query("DELETE FROM invoice WHERE id = ?", [id]);

    await connection.commit();
    res.json({ message: "Invoice deleted and backed up successfully." });

  } catch (err) {
    await connection.rollback();
    console.error("Error deleting invoice:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const createInvoice = async (invoiceData) => {
  // --- START OF MODIFICATION: Added validation to prevent empty records ---
  // A valid invoice must have at least these essential fields.
  if (
    !invoiceData.franchiseName ||
    !invoiceData.companyName ||
    !invoiceData.candidateName ||
    !invoiceData.serviceCharges
  ) {
    // Log the attempt and throw an error to stop the process.
    console.warn(
      "Attempted to create an incomplete invoice. Aborting creation.",
      invoiceData
    )
    throw new Error(
      "Failed to create invoice: Missing required fields (e.g., franchiseName, companyName, candidateName, serviceCharges)."
    )
  }
  // --- END OF MODIFICATION ---

  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    // --- START OF MODIFICATION: Removed manual timestamp. DB will use DEFAULT CURRENT_TIMESTAMP for createdAt. ---
    // --- END OF MODIFICATION ---

    // Calculate GST based on Maharashtra status if serviceCharges and isFromMaharashtra are provided
    if (invoiceData.serviceCharges && invoiceData.isFromMaharashtra) {
      const gstCalculation = calculateGST(
        invoiceData.serviceCharges,
        invoiceData.isFromMaharashtra
      )

      invoiceData.CGST = gstCalculation.CGST
      invoiceData.SGST = gstCalculation.SGST
      invoiceData.IGST = gstCalculation.IGST
      invoiceData.totalGST = gstCalculation.totalGST
      invoiceData.totalBillAmt =
        Number.parseFloat(invoiceData.serviceCharges) + gstCalculation.totalGST
    }

    // Calculate franchiseeShare / ourShare via the single shared formula
    // (utils/invoiceHelpers.js#calculateShares) so create, auto-create, and
    // update all agree on the same rate-effective-date logic.
    if (invoiceData.serviceCharges) {
      const { franchiseeShare, ourShare } = calculateShares(
        invoiceData.serviceCharges,
        invoiceData.info,
        invoiceData.billDate
      )
      invoiceData.franchiseeShare = franchiseeShare
      invoiceData.ourShare = ourShare
    }

    // Insert the invoice data into the Invoice table
    // Note: The invoiceData object should contain all new fields from the schema as needed for creation.
    const [result] = await connection.query("INSERT INTO invoice SET ?", invoiceData)

    await connection.commit()
    return { id: result.insertId, ...invoiceData }
  } catch (error) {
    await connection.rollback()
    throw new Error("Failed to create invoice: " + error.message)
  } finally {
    connection.release()
  }
}
// --- PDF UPLOAD AND DOWNLOAD CONTROLLERS ---
export const uploadInvoicePDF = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const pdfBuffer = req.file.buffer; 
    await db.query("UPDATE invoice SET franchiseeInvoice = ? WHERE id = ?", [pdfBuffer, id]);
    res.json({ message: "PDF uploaded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const downloadInvoicePDF = async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query("SELECT franchiseeInvoice FROM invoice WHERE id = ?", [id]);
    if (results.length === 0 || !results[0].franchiseeInvoice) {
      return res.status(404).json({ error: "No PDF found" });
    }
    
    // Set type to PDF but DO NOT set "attachment" so it opens in browser
    res.setHeader("Content-Type", "application/pdf");
    res.send(results[0].franchiseeInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};