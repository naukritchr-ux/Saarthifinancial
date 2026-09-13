import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import db from '../../config/db.js';
import { reconcile, cleanNameTokens } from '../../services/tdsReconciliationService.js';
import { seedEmbeddedDataset, markPurgedFlag, clearPurgedFlag } from '../../seed_embedded_dataset.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeFY, getFinancialYearFromDate } from '../../utils/fyHelper.js';
import {
  TDS_TOLERANCE,
  PRIMARY_TDS_SQL,
  getPrimaryTdsVal,
  getDifferenceAmount,
  deriveFinancialStatus,
  getFinancialStatusWhereClause
} from '../../services/reconciliationRules.js';

export { normalizeFY, getFinancialYearFromDate };

export const getDashboardSummary = async (req, res) => {
  try {
    const { fy } = req.query;

    let whereClauses = [
      "(COALESCE(tr.books_tds, 0) > 0 OR COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)",
      "(tr.tan_no IS NOT NULL AND tr.tan_no NOT LIKE 'NO_TAN_%' AND tr.tan_no != 'Pending TAN' AND tr.tan_no != 'Not Available' AND tr.tan_no NOT LIKE '%UNKNOWN%' AND TRIM(tr.tan_no) != '')"
    ];
    const params = [];
    if (fy && fy !== 'All' && fy !== 'All Financial Years' && String(fy).trim() !== '') {
      const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
      whereClauses.push('(TRIM(tr.financial_year) LIKE ? OR (tr.financial_year IS NULL AND TRIM(d.financial_year) LIKE ?))');
      params.push(`%${cleanFy}%`, `%${cleanFy}%`);
    }

    const whereSQL = 'WHERE ' + whereClauses.join(' AND ');

    const query = `
      SELECT 
        tr.books_tds,
        tr.as26_tds,
        tr.tally_tds,
        tr.overall_status,
        tr.books_vs_26as_status,
        tr.books_vs_tally_status,
        tr.as26_vs_tally_status,
        tr.is_manually_edited,
        tr.tds_dues_id,
        d.id as crm_id
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
    `;

    let [rows] = await db.execute(query, params);

    let tallyTotal = 0;
    let as26Total = 0;
    let saarthiTotal = 0;

    let threeOfThree = 0;
    let twoOfThree = 0;
    let oneOfThree = 0;
    let noMatch = 0;

    let matchCount = 0;
    let lessCount = 0;
    let excessCount = 0;
    let missingCount = 0;
    let pendingReviewCount = 0;
    let resolvedCount = 0;

    rows.forEach(r => {
      const tally = parseFloat(r.tally_tds || 0);
      const as26 = parseFloat(r.as26_tds || 0);
      const saarthi = parseFloat(r.books_tds || 0);

      tallyTotal += tally;
      as26Total += as26;
      saarthiTotal += saarthi;

      const hasTally = tally > 0;
      const has26as = as26 > 0;
      const hasSarthi = saarthi > 0 || Boolean(r.tds_dues_id || r.crm_id);

      const sourcesPresent = (hasTally ? 1 : 0) + (has26as ? 1 : 0) + (hasSarthi ? 1 : 0);
      if (sourcesPresent === 3) threeOfThree++;
      else if (sourcesPresent === 2) twoOfThree++;
      else if (sourcesPresent === 1) oneOfThree++;
      else noMatch++;

      const primaryVal = getPrimaryTdsVal(tally, saarthi);

      if (r.is_manually_edited) {
        resolvedCount++;
        matchCount++;
      } else {
        const derived = deriveFinancialStatus({
          tally,
          as26,
          saarthi,
          isManuallyEdited: false,
          overallStatus: r.overall_status
        });
        if (derived === 'Match') matchCount++;
        else if (derived === 'Less Paid') lessCount++;
        else if (derived === 'Excess') excessCount++;
        else if (derived === 'Pending Review') pendingReviewCount++;
        else missingCount++;
      }
    });

    const primaryTotal = getPrimaryTdsVal(tallyTotal, saarthiTotal);

    res.json({
      success: true,
      totals: {
        tally: tallyTotal,
        as26: as26Total,
        saarthi: saarthiTotal,
        netGap: getDifferenceAmount(as26Total, primaryTotal)
      },
      recordCount: rows.length,
      sourceCoverage: {
        threeOfThree,
        twoOfThree,
        oneOfThree,
        noMatch
      },
      financialStatus: {
        match: matchCount,
        less: lessCount,
        excess: excessCount,
        missing: missingCount,
        pendingReview: pendingReviewCount,
        resolved: resolvedCount
      }
    });

  } catch (error) {
    console.error('💥 Error in getDashboardSummary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary', details: error.message });
  }
};

/**
 * Detect placeholder or dummy company names (e.g. 'Unknown Client', 'Client Entity', 'Entity <TAN>')
 */
export const isDummyPlaceholderName = (name) => {
  if (!name) return true;
  const str = String(name).trim();
  if (!str) return true;
  if (['Unknown Client', 'Unknown Company', 'Client Entity', 'Unassigned Entity'].includes(str)) return true;
  if (/^Entity\s+[A-Za-z0-9]+$/i.test(str)) return true;
  return false;
};

/**
 * Get Data Cleaning Queue items
 */
/**
 * Fast badge count — single SQL COUNT(*), no JS processing.
 * Used by AppContext on every page load; must be cheap.
 */
export const getCleaningQueueCount = async (req, res) => {
  try {
    const [[{ cnt }]] = await db.execute(`
      SELECT COUNT(*) as cnt
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
        AND (COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)
        AND (
          tr.tan_no IS NULL OR tr.tan_no = '' OR LENGTH(tr.tan_no) < 10
          OR tr.tan_no LIKE 'NO_TAN_%' OR tr.tan_no LIKE '%UNKNOWN%'
          OR tr.tan_no REGEXP '^[A-Za-z]{5}[0-9]{4}[A-Za-z]$'
          OR NOT (tr.tan_no REGEXP '^[A-Za-z]{4}[0-9]{5}[A-Za-z]$')
          OR d.company_name IS NULL OR d.company_name = 'Unknown Company' OR d.company_name = ''
          OR d.company_name LIKE 'Entity %'
          OR d.company_name IN (
            SELECT d_sub.company_name
            FROM tds_reconciliation_results tr_sub
            JOIN tds_dues d_sub ON tr_sub.tds_dues_id = d_sub.id
            WHERE d_sub.company_name IS NOT NULL AND d_sub.company_name != ''
            GROUP BY d_sub.company_name
            HAVING COUNT(DISTINCT tr_sub.tan_no) > 1
          )
          OR (
            tr.tan_no IN (
              SELECT tan_no FROM tds_26as_entries 
              WHERE tan_no IS NOT NULL AND tan_no != '' 
              GROUP BY tan_no, COALESCE(financial_year, '') 
              HAVING COUNT(*) > 1 AND COUNT(DISTINCT tds_deducted) > 1
            )
          )
          OR (
            tr.tan_no IN (
              SELECT tan_no FROM tds_tally_entries 
              WHERE tan_no IS NOT NULL AND tan_no != '' 
              GROUP BY tan_no, COALESCE(financial_year, '') 
              HAVING COUNT(*) > 1 AND COUNT(DISTINCT tds_amount) > 1
            )
          )
        )
        AND tr.tan_no NOT IN ('COMPANYNAME', 'TANNO', 'TAN_NO', 'PANNO', 'TAN')
        AND UPPER(COALESCE(d.company_name, '')) NOT IN ('UNKNOWN CLIENT', 'COMPANYNAME')
    `);
    return res.json({ success: true, count: Number(cnt) });
  } catch (error) {
    console.error('💥 Error in getCleaningQueueCount:', error);
    return res.status(500).json({ success: false, count: 0, error: error.message });
  }
};

export const getCleaningQueue = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(req.query.pageSize, 10) || 100));

    // Fetch multi-TAN companies so we can flag them
    const [multiTanRows] = await db.execute(`
      SELECT d.company_name, COUNT(DISTINCT tr.tan_no) as tan_count, GROUP_CONCAT(DISTINCT tr.tan_no) as tans
      FROM tds_reconciliation_results tr
      JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE d.company_name IS NOT NULL AND d.company_name != ''
      GROUP BY d.company_name
      HAVING tan_count > 1
    `);
    const multiTanMap = new Map();
    (multiTanRows || []).forEach(r => {
      multiTanMap.set(String(r.company_name).trim().toUpperCase(), r.tans.split(','));
    });

    // Fetch ambiguous duplicate entries (same TAN+FY with conflicting distinct amounts)
    const [dup26asRows] = await db.execute(`
      SELECT 
        UPPER(TRIM(tan_no)) as tan_no, 
        COALESCE(NULLIF(TRIM(financial_year), ''), 'Unspecified') as financial_year,
        COUNT(*) as row_count,
        COUNT(DISTINCT tds_deducted) as distinct_amounts_count,
        GROUP_CONCAT(DISTINCT tds_deducted) as amounts
      FROM tds_26as_entries
      WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''
      GROUP BY UPPER(TRIM(tan_no)), COALESCE(NULLIF(TRIM(financial_year), ''), 'Unspecified')
      HAVING COUNT(*) > 1 AND COUNT(DISTINCT tds_deducted) > 1
    `);

    const [dupTallyRows] = await db.execute(`
      SELECT 
        UPPER(TRIM(tan_no)) as tan_no, 
        COALESCE(NULLIF(TRIM(financial_year), ''), 'Unspecified') as financial_year,
        COUNT(*) as row_count,
        COUNT(DISTINCT tds_amount) as distinct_amounts_count,
        GROUP_CONCAT(DISTINCT tds_amount) as amounts
      FROM tds_tally_entries
      WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''
      GROUP BY UPPER(TRIM(tan_no)), COALESCE(NULLIF(TRIM(financial_year), ''), 'Unspecified')
      HAVING COUNT(*) > 1 AND COUNT(DISTINCT tds_amount) > 1
    `);

    const duplicateEntriesMap = new Map();
    (dup26asRows || []).forEach(r => {
      const amountsList = String(r.amounts || '').split(',').map(a => `₹${parseFloat(a).toLocaleString('en-IN')}`).join(', ');
      const key = `${r.tan_no}|${r.financial_year}`.toUpperCase();
      duplicateEntriesMap.set(key, {
        source: 'Form 26AS',
        tan: r.tan_no,
        fy: r.financial_year,
        amounts: amountsList,
        reason: `Multiple Form 26AS entries for this TAN+FY with different amounts (${amountsList})`
      });
      if (!duplicateEntriesMap.has(r.tan_no)) {
        duplicateEntriesMap.set(r.tan_no, duplicateEntriesMap.get(key));
      }
    });

    (dupTallyRows || []).forEach(r => {
      const amountsList = String(r.amounts || '').split(',').map(a => `₹${parseFloat(a).toLocaleString('en-IN')}`).join(', ');
      const key = `${r.tan_no}|${r.financial_year}`.toUpperCase();
      if (duplicateEntriesMap.has(key)) {
        const existing = duplicateEntriesMap.get(key);
        existing.source = 'Form 26AS & Tally';
        existing.reason = `Multiple entries with conflicting amounts in 26AS & Tally (${amountsList})`;
      } else {
        duplicateEntriesMap.set(key, {
          source: 'Tally Ledger',
          tan: r.tan_no,
          fy: r.financial_year,
          amounts: amountsList,
          reason: `Multiple Tally Ledger entries for this TAN+FY with different amounts (${amountsList})`
        });
      }
      if (!duplicateEntriesMap.has(r.tan_no)) {
        duplicateEntriesMap.set(r.tan_no, duplicateEntriesMap.get(key));
      }
    });

    const query = `
      SELECT 
        tr.id,
        tr.tan_no as tanNo,
        d.company_name as booksCompanyName,
        d.pan_no as booksPanNo,
        COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'Unspecified') as financialYear,
        tr.books_tds as booksTds,
        tr.as26_tds as as26Tds,
        tr.tally_tds as tallyTds,
        tr.overall_status as overallStatus
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
        AND (COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)
        AND (
          tr.tan_no IS NULL OR tr.tan_no = '' OR LENGTH(tr.tan_no) < 10 
          OR tr.tan_no LIKE 'NO_TAN_%' OR tr.tan_no LIKE '%UNKNOWN%'
          OR tr.tan_no REGEXP '^[A-Za-z]{5}[0-9]{4}[A-Za-z]$'
          OR NOT (tr.tan_no REGEXP '^[A-Za-z]{4}[0-9]{5}[A-Za-z]$')
          OR d.company_name IS NULL OR d.company_name = 'Unknown Company' OR d.company_name = ''
          OR d.company_name LIKE 'Entity %'
          OR d.company_name IN (
            SELECT d_sub.company_name
            FROM tds_reconciliation_results tr_sub
            JOIN tds_dues d_sub ON tr_sub.tds_dues_id = d_sub.id
            WHERE d_sub.company_name IS NOT NULL AND d_sub.company_name != ''
            GROUP BY d_sub.company_name
            HAVING COUNT(DISTINCT tr_sub.tan_no) > 1
          )
          OR (
            tr.tan_no IN (
              SELECT tan_no FROM tds_26as_entries 
              WHERE tan_no IS NOT NULL AND tan_no != '' 
              GROUP BY tan_no, COALESCE(financial_year, '') 
              HAVING COUNT(*) > 1 AND COUNT(DISTINCT tds_deducted) > 1
            )
          )
          OR (
            tr.tan_no IN (
              SELECT tan_no FROM tds_tally_entries 
              WHERE tan_no IS NOT NULL AND tan_no != '' 
              GROUP BY tan_no, COALESCE(financial_year, '') 
              HAVING COUNT(*) > 1 AND COUNT(DISTINCT tds_amount) > 1
            )
          )
        )
        AND tr.tan_no NOT IN ('COMPANYNAME', 'TANNO', 'TAN_NO', 'PANNO', 'TAN')
        AND UPPER(COALESCE(d.company_name, '')) NOT IN ('UNKNOWN CLIENT', 'COMPANYNAME')
      ORDER BY tr.id DESC
    `;

    const [rows] = await db.execute(query);
    if (!rows || rows.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const neededTans = new Set();
    const neededNames = new Set();
    for (const r of rows) {
      const tan = r.tanNo ? String(r.tanNo).trim().toUpperCase() : '';
      const isUsableTan = tan && tan.length >= 10 && !tan.startsWith('NO_TAN_') && !tan.includes('UNKNOWN');
      if (isUsableTan) neededTans.add(tan);
      const name = r.booksCompanyName ? String(r.booksCompanyName).trim().toUpperCase() : '';
      if (name) neededNames.add(name);
    }
    const tanList = Array.from(neededTans);
    const nameList = Array.from(neededNames);

    const LOOKUP_CHUNK = 500;
    const fetchScoped = async (table, nameCol) => {
      const results = [];
      for (let i = 0; i < tanList.length; i += LOOKUP_CHUNK) {
        const chunk = tanList.slice(i, i + LOOKUP_CHUNK);
        const placeholders = chunk.map(() => '?').join(', ');
        const [batch] = await db.execute(
          `SELECT ${nameCol}, UPPER(TRIM(tan_no)) as tan_no FROM ${table}
           WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' AND UPPER(TRIM(tan_no)) IN (${placeholders})`,
          chunk
        );
        results.push(...batch);
      }
      for (let i = 0; i < nameList.length; i += LOOKUP_CHUNK) {
        const chunk = nameList.slice(i, i + LOOKUP_CHUNK);
        const placeholders = chunk.map(() => '?').join(', ');
        const [batch] = await db.execute(
          `SELECT ${nameCol}, UPPER(TRIM(tan_no)) as tan_no FROM ${table}
           WHERE ${nameCol} IS NOT NULL AND TRIM(${nameCol}) != '' AND UPPER(TRIM(${nameCol})) IN (${placeholders})`,
          chunk
        );
        results.push(...batch);
      }
      return results;
    };

    const all26as = (tanList.length || nameList.length)
      ? await fetchScoped('tds_26as_entries', 'deductor_name')
      : [];
    const allTally = (tanList.length || nameList.length)
      ? await fetchScoped('tds_tally_entries', 'party_name')
      : [];

    const as26ByTan = new Map();
    const as26ByName = new Map();
    for (const e of all26as) {
      const tanKey = e.tan_no ? String(e.tan_no).trim().toUpperCase() : '';
      if (tanKey && !as26ByTan.has(tanKey)) as26ByTan.set(tanKey, e);
      const nameKey = e.deductor_name ? String(e.deductor_name).trim().toUpperCase() : '';
      if (nameKey && !as26ByName.has(nameKey)) as26ByName.set(nameKey, e);
    }

    const tallyByTan = new Map();
    const tallyByName = new Map();
    for (const e of allTally) {
      const tanKey = e.tan_no ? String(e.tan_no).trim().toUpperCase() : '';
      if (tanKey && !tallyByTan.has(tanKey)) tallyByTan.set(tanKey, e);
      const nameKey = e.party_name ? String(e.party_name).trim().toUpperCase() : '';
      if (nameKey && !tallyByName.has(nameKey)) tallyByName.set(nameKey, e);
    }

    const cleaningItems = rows.map((r) => {
      const tan = r.tanNo ? String(r.tanNo).trim().toUpperCase() : '';
      const rawBooksName = r.booksCompanyName || '';
      const isMissingBooksName = isDummyPlaceholderName(rawBooksName);
      const booksName = isMissingBooksName ? (rawBooksName || 'Unknown Client') : rawBooksName;
      const normBooksName = String(booksName).trim().toUpperCase();

      let as26Name = null;
      let as26Tan = null;
      const as26Match = (tan && !tan.startsWith('NO_TAN_') ? as26ByTan.get(tan) : null) || (!isMissingBooksName && normBooksName ? as26ByName.get(normBooksName) : null);
      if (as26Match) {
        as26Name = as26Match.deductor_name;
        as26Tan = as26Match.tan_no;
      }

      let tallyName = null;
      let tallyTan = null;
      const tallyMatch = (tan && !tan.startsWith('NO_TAN_') ? tallyByTan.get(tan) : null) || (!isMissingBooksName && normBooksName ? tallyByName.get(normBooksName) : null);
      if (tallyMatch) {
        tallyName = tallyMatch.party_name;
        tallyTan = tallyMatch.tan_no;
      }

      // Do not score confidence against dummy/placeholder names like 'Entity <TAN>' or 'Unknown Client'
      const namesToCompare = [
        tallyName && !isDummyPlaceholderName(tallyName) ? tallyName : null,
        as26Name && !isDummyPlaceholderName(as26Name) ? as26Name : null,
        !isMissingBooksName ? booksName : null
      ].filter(Boolean);

      let confidence = 100;
      if (namesToCompare.length >= 2) {
        let totalSim = 0;
        let pairCount = 0;
        for (let i = 0; i < namesToCompare.length; i++) {
          for (let j = i + 1; j < namesToCompare.length; j++) {
            totalSim += calculateStringSimilarity(namesToCompare[i], namesToCompare[j]);
            pairCount++;
          }
        }
        confidence = Math.round(totalSim / pairCount);
      }

      // If booksName is a dummy placeholder, prefer genuine names from 26AS or Tally as suggestion
      let saarthiSuggestion = !isMissingBooksName ? booksName : (as26Name || tallyName || booksName);
      if (as26Name && as26Name.length > saarthiSuggestion.length && as26Name !== 'Unknown Deductor') {
        saarthiSuggestion = as26Name;
      }
      if (tallyName && tallyName.length > saarthiSuggestion.length && tallyName !== 'Unknown Client') {
        saarthiSuggestion = tallyName;
      }

      const isMissingTan = !tan || tan.length < 10 || tan.startsWith('NO_TAN_') || tan.includes('UNKNOWN');
      const isPanAsTan = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(tan);
      const isInvalidTanFormat = !isPanAsTan && !/^[A-Za-z]{4}[0-9]{5}[A-Za-z]$/.test(tan);
      const companyTans = multiTanMap.get(normBooksName);
      const isMultiTan = companyTans && companyTans.length > 1;

      const fyKey = `${tan}|${r.financialYear || 'Unspecified'}`.toUpperCase();
      const dupInfo = duplicateEntriesMap.get(fyKey) || duplicateEntriesMap.get(tan);
      const isDuplicateEntry = Boolean(dupInfo);

      const resolvedTans = [isMissingTan ? null : tan, as26Tan, tallyTan].filter(Boolean);
      const uniqueTans = Array.from(new Set(resolvedTans));
      const isTanMismatch = uniqueTans.length > 1 || isPanAsTan || isMultiTan;

      let reason = 'Multi-source Data Discrepancy';
      let issueType = 'source_discrepancy';

      // Explicit triage priority:
      // 1. Conflicting TANs across datasets (hard mismatch between 26AS, Tally, or Sarthi)
      // 2. Multiple TAN registrations for the same legal company entity (e.g. branch offices)
      // 3. PAN entered into TAN field (common user/accountant transposition)
      // 4. Ambiguous duplicate entry with differing amounts for the same TAN+FY
      // 5. Missing or syntactically invalid TAN format
      // 6. Missing / dummy company entity name
      // 7. Name discrepancy / fuzzy token confidence < 90%
      if (uniqueTans.length > 1) {
        reason = 'Conflicting TANs across datasets';
        issueType = 'tan_mismatch';
      } else if (isMultiTan) {
        reason = `Multiple TANs for company (${companyTans.join(', ')})`;
        issueType = 'multi_tan';
      } else if (isPanAsTan) {
        reason = `PAN (${tan}) entered instead of TAN Number`;
        issueType = 'pan_as_tan';
      } else if (isDuplicateEntry) {
        reason = dupInfo.reason;
        issueType = 'duplicate_entry';
      } else if (isMissingTan || isInvalidTanFormat) {
        reason = 'Missing or Invalid TAN format';
        issueType = 'invalid_tan';
      } else if (isMissingBooksName) {
        reason = 'Missing Client Entity Name';
        issueType = 'missing_name';
      } else if (confidence < 90) {
        reason = 'Deductor Name Discrepancy';
        issueType = 'name_mismatch';
      }

      return {
        id: r.id,
        tanNo: isMissingTan ? 'Pending TAN' : tan,
        pan: r.booksPanNo || (isPanAsTan ? tan : null),
        companyName: tallyName || booksName,
        tallyCompanyName: tallyName || booksName,
        tallyTan: tallyTan || (isMissingTan ? '' : tan),
        as26CompanyName: as26Name || null,
        as26Tan: as26Tan || null,
        saarthiName: booksName,
        saarthiTan: isMissingTan ? '' : tan,
        financialYear: r.financialYear || 'Unspecified',
        saarthiSuggestion,
        confidence,
        isTanMismatch,
        issueType,
        issueReason: reason,
        sources: [
          r.booksTds > 0 ? 'Saarthi 360' : null,
          (as26Name || r.as26Tds > 0) ? 'Form 26AS' : null,
          (tallyName || r.tallyTds > 0) ? 'Tally Ledger' : null
        ].filter(Boolean),
        booksTds: r.booksTds,
        as26Tds: r.as26Tds,
        tallyTds: r.tallyTds
      };
    });

    const flaggedItems = cleaningItems.filter(item => {
      const isZeroData = (item.booksTds || 0) === 0 && (item.as26Tds || 0) === 0 && (item.tallyTds || 0) === 0;
      const isUnknownDummy = (item.companyName || item.saarthiName || '').toUpperCase().includes('UNKNOWN') || isDummyPlaceholderName(item.companyName || item.saarthiName);

      if (isZeroData && isUnknownDummy) return false;

      const invalidTan = !item.tanNo || item.tanNo === 'Pending TAN' || item.tanNo.length < 10 || item.tanNo.includes('UNKNOWN') || !/^[A-Za-z]{4}[0-9]{5}[A-Za-z]$/.test(item.tanNo);
      const isPanAsTan = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(item.tanNo);
      const missingName = isDummyPlaceholderName(item.saarthiName);
      const lowConfidence = item.confidence < 90;
      const tanMismatch = item.isTanMismatch;
      const isMultiTan = item.issueType === 'multi_tan';
      const isDuplicateEntry = item.issueType === 'duplicate_entry';
      return invalidTan || isPanAsTan || missingName || lowConfidence || tanMismatch || isMultiTan || isDuplicateEntry;
    });

    const totalCount = flaggedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startIndex = (page - 1) * pageSize;
    const pagedItems = flaggedItems.slice(startIndex, startIndex + pageSize);

    res.json({
      success: true,
      count: totalCount,
      page,
      pageSize,
      totalPages,
      data: pagedItems
    });

  } catch (error) {
    console.error('💥 Error in getCleaningQueue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cleaning queue', details: error.message });
  }
};

/**
 * Resolve a Data Import Cleaning Item
 */
export const resolveCleaningItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanNo, companyName, status, panNo, gstNum } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Cleaning Item ID is required' });
    }

    if (String(status || '').toLowerCase() === 'rejected') {
      // Mark as manually edited so it leaves the cleaning queue without wiping other FYs sharing that TAN
      await db.execute(
        'UPDATE tds_reconciliation_results SET is_manually_edited = 1 WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: 'Cleaning item rejected and removed from review queue successfully',
        id
      });
    }

    const cleanTan = String(tanNo || 'N/A').toUpperCase().trim();
    const cleanCompany = String(companyName || 'Cleaned Entity').trim();
    const cleanPan = panNo ? String(panNo).toUpperCase().trim() : null;
    const cleanGst = gstNum ? String(gstNum).toUpperCase().trim() : null;

    const [recRows] = await db.execute('SELECT * FROM tds_reconciliation_results WHERE id = ?', [id]);

    let booksVs26as = 'Not Received';
    let booksVsTally = 'Not Received';
    let as26VsTally = 'Not Received';
    let overallStatus = 'Not Received';

    if (recRows.length > 0) {
      const rec = recRows[0];
      const booksTds = parseFloat(rec.books_tds || 0);
      const as26Tds = parseFloat(rec.as26_tds || 0);
      const tallyTds = parseFloat(rec.tally_tds || 0);

      const has26as = rec.as26_batch_id !== null || as26Tds > 0;
      const hasTally = rec.tally_batch_id !== null || tallyTds > 0;
      const hasSaarthi = booksTds > 0;

      const evaluatePair = (valA, valB, hasA, hasB) => {
        if (!hasA || !hasB || valA <= 0 || valB <= 0) return 'Not Received';
        if (Math.abs(valA - valB) <= 1.0) return 'Matched';
        if (valA > valB) return 'Excess';
        return 'Less Paid';
      };

      booksVs26as = evaluatePair(as26Tds, booksTds, has26as, true);
      booksVsTally = evaluatePair(tallyTds, booksTds, hasTally, true);
      as26VsTally = evaluatePair(tallyTds, as26Tds, hasTally, has26as);

      const activeSourcesCount = [hasSaarthi, hasTally, has26as].filter(Boolean).length;

      if (tallyTds <= 0 && booksTds <= 0 && as26Tds > 0) {
        overallStatus = 'Excess';
        booksVs26as = 'Excess';
        as26VsTally = 'Excess';
      } else if (activeSourcesCount >= 2) {
        const vals = [];
        if (hasSaarthi) vals.push(booksTds);
        if (hasTally) vals.push(tallyTds);
        if (has26as) vals.push(as26Tds);

        let allAgree = true;
        for (let i = 0; i < vals.length; i++) {
          for (let j = i + 1; j < vals.length; j++) {
            if (Math.abs(vals[i] - vals[j]) > 1.0) {
              allAgree = false;
              break;
            }
          }
        }

        if (allAgree && activeSourcesCount === 3) {
          overallStatus = 'All Matched';
        } else if (allAgree) {
          overallStatus = 'Partial Mismatch';
        } else {
          overallStatus = 'Major Mismatch';
        }
      }
    }

    await db.execute(
      `UPDATE tds_reconciliation_results 
       SET tan_no = ?, is_manually_edited = 1, 
           books_vs_26as_status = ?, books_vs_tally_status = ?, as26_vs_tally_status = ?,
           overall_status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [cleanTan, booksVs26as, booksVsTally, as26VsTally, overallStatus, id]
    );

    if (recRows.length > 0 && recRows[0].tds_dues_id) {
      try {
        await db.execute(
          `UPDATE tds_dues 
           SET tan_no = ?, company_name = ?, 
               pan_no = COALESCE(?, pan_no), 
               gst_num = COALESCE(?, gst_num) 
           WHERE id = ?`,
          [cleanTan, cleanCompany, cleanPan, cleanGst, recRows[0].tds_dues_id]
        );
      } catch (e) {
        await db.execute(
          'UPDATE tds_dues SET tan_no = ?, company_name = ? WHERE id = ?',
          [cleanTan, cleanCompany, recRows[0].tds_dues_id]
        );
      }
    }

    // Fire-and-forget reconcile so corrected TAN gets its 26AS/Tally amounts recalculated immediately
    reconcile(null, null).catch(rErr => {
      console.warn('Background reconcile warning after cleaning item resolve:', rErr.message);
    });

    res.json({
      success: true,
      message: 'Cleaning item resolved successfully',
      id,
      tanNo: cleanTan,
      companyName: cleanCompany
    });

  } catch (error) {
    console.error('💥 Error in resolveCleaningItem:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve cleaning item', details: error.message });
  }
};

let followupColumnChecked = false;
async function ensureFollowupDoneColumn() {
  if (followupColumnChecked) return;
  try {
    await db.execute('ALTER TABLE tds_reconciliation_results ADD COLUMN is_followup_done BOOLEAN DEFAULT FALSE');
  } catch (e) {
    try { await db.execute('ALTER TABLE tds_reconciliation_results ADD COLUMN is_followup_done INTEGER DEFAULT 0'); } catch (err) { }
  }
  followupColumnChecked = true;
}

/**
 * Get Paginated & Filterable Reconciliation Report
 */
export const getReconciliationReport = async (req, res) => {
  try {
    await ensureFollowupDoneColumn();

    const {
      page = 1,
      limit = 20,
      search = '',
      overallStatus = '',
      coverageFilter = 'All',
      fy = '',
      financialYear = '',
      sortBy = 'updated_at',
      booksVs26asStatus = '',
      booksVsTallyStatus = '',
      as26VsTallyStatus = '',
      followupStatus = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(1000, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    const queryParams = [];

    // Filter by follow-up done / pending
    if (followupStatus === 'done' || followupStatus === '1' || followupStatus === 'true') {
      whereClauses.push('(tr.is_followup_done = 1 OR tr.is_followup_done = true)');
    } else if (followupStatus === 'pending' || followupStatus === '0' || followupStatus === 'false') {
      whereClauses.push('(tr.is_followup_done = 0 OR tr.is_followup_done IS NULL OR tr.is_followup_done = false)');
    }

    // Always exclude zero-data ghost rows where all 3 TDS amounts are zero/null
    whereClauses.push("NOT (COALESCE(tr.books_tds, 0) = 0 AND COALESCE(tr.as26_tds, 0) = 0 AND COALESCE(tr.tally_tds, 0) = 0)");
    // Exclude unassigned/unresolved dummy TAN rows (Pending TAN / NO_TAN_) from the reconciliation table
    whereClauses.push("(tr.tan_no IS NOT NULL AND tr.tan_no NOT LIKE 'NO_TAN_%' AND tr.tan_no != 'Pending TAN' AND tr.tan_no != 'Not Available' AND tr.tan_no NOT LIKE '%UNKNOWN%' AND TRIM(tr.tan_no) != '')");

    const activeFy = fy || financialYear;
    if (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years' && String(activeFy).trim() !== '') {
      const cleanFy = String(activeFy).replace(/^FY\s*/i, '').trim();
      whereClauses.push('(TRIM(tr.financial_year) LIKE ? OR (tr.financial_year IS NULL AND TRIM(d.financial_year) LIKE ?))');
      queryParams.push(`%${cleanFy}%`, `%${cleanFy}%`);
    }

    if (search && String(search).trim() !== '') {
      whereClauses.push("(tr.tan_no LIKE ? OR COALESCE(d.company_name, '') LIKE ?)");
      const wild = `%${String(search).trim()}%`;
      queryParams.push(wild, wild);
    }

    const primaryTdsSQL = PRIMARY_TDS_SQL;

    if (overallStatus && overallStatus !== 'All') {
      const statusCondition = getFinancialStatusWhereClause(overallStatus, primaryTdsSQL);
      if (statusCondition) {
        whereClauses.push(statusCondition);
        if (statusCondition === 'tr.overall_status = ?') {
          queryParams.push(overallStatus);
        }
      }
    }

    if (booksVs26asStatus && booksVs26asStatus !== 'All') {
      whereClauses.push('tr.books_vs_26as_status = ?');
      queryParams.push(booksVs26asStatus);
    }

    // 3-Way Source Coverage Filter
    const hasSaarthiSQL = '(COALESCE(tr.books_tds, 0) > 0 OR tr.tds_dues_id IS NOT NULL)';
    const hasTallySQL = '(COALESCE(tr.tally_tds, 0) > 0)';
    const has26asSQL = '(COALESCE(tr.as26_tds, 0) > 0)';

    if (coverageFilter === '3/3' || coverageFilter === '3 of 3' || coverageFilter === 'all_3' || coverageFilter === 'all3' || coverageFilter === 'All 3 (Saarthi + Tally + 26AS)' || coverageFilter === 'All 3 (Sarthi + Tally + 26AS)') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND ${has26asSQL})`);
    } else if (coverageFilter === 'saarthi_tally' || coverageFilter === 'sarthi_tally' || coverageFilter === 'tally_saarthi' || coverageFilter === 'tally_sarthi' || coverageFilter === 'Saarthi + Tally' || coverageFilter === 'Sarthi + Tally') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND NOT ${has26asSQL})`);
    } else if (coverageFilter === 'tally_26as' || coverageFilter === '26as_tally' || coverageFilter === 'Tally + 26AS') {
      whereClauses.push(`(${hasTallySQL} AND ${has26asSQL} AND NOT ${hasSaarthiSQL})`);
    } else if (coverageFilter === 'as26_saarthi' || coverageFilter === 'as26_sarthi' || coverageFilter === 'saarthi_26as' || coverageFilter === 'sarthi_26as' || coverageFilter === '26as_saarthi' || coverageFilter === '26as_sarthi' || coverageFilter === '26AS + Saarthi' || coverageFilter === '26AS + Sarthi') {
      whereClauses.push(`(${has26asSQL} AND ${hasSaarthiSQL} AND NOT ${hasTallySQL})`);
    } else if (coverageFilter === '2/3' || coverageFilter === '2 of 3') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 2)`);
    } else if (coverageFilter === '1/3' || coverageFilter === '1 of 3' || coverageFilter === 'Single Source Only') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 1)`);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    let orderSQL = 'ORDER BY tr.id DESC';
    if (sortBy === 'difference_desc' || sortBy === 'difference' || sortBy === 'Difference (High → Low)') {
      orderSQL = `ORDER BY ABS(${primaryTdsSQL} - COALESCE(tr.as26_tds, 0)) DESC`;
    }

    let statsQuery = `
      SELECT 
        COUNT(tr.id) as total,
        SUM(CASE 
          WHEN tr.is_manually_edited = 1 THEN 1
          WHEN (CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END) > 0 
               AND COALESCE(tr.as26_tds, 0) > 0 
               AND ABS((CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END) - COALESCE(tr.as26_tds, 0)) <= 1.0 THEN 1
          WHEN tr.overall_status IN ('All Matched', 'Match', 'Matched') THEN 1
          ELSE 0 END) as matched,
        SUM(CASE 
          WHEN (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
               AND (CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END) > 0 
               AND COALESCE(tr.as26_tds, 0) > 0 
               AND (CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END) > COALESCE(tr.as26_tds, 0) + 1.0 THEN 1
          ELSE 0 END) as less,
        SUM(CASE 
          WHEN (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
               AND COALESCE(tr.as26_tds, 0) > 0 
               AND ((CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END) = 0 
                    OR (CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END) < COALESCE(tr.as26_tds, 0) - 1.0) THEN 1
          ELSE 0 END) as excess,
        SUM(CASE 
          WHEN (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
               AND (COALESCE(tr.as26_tds, 0) = 0 AND (COALESCE(tr.tally_tds, 0) > 0 OR COALESCE(tr.books_tds, 0) > 0)) THEN 1
          ELSE 0 END) as notReceived
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
    `;
    let [statsRes] = await db.query(statsQuery, queryParams);
    const aggStats = statsRes[0] || {};
    let total = parseInt(aggStats.total) || 0;
    let stats = {
      total,
      matched: parseInt(aggStats.matched) || 0,
      less: parseInt(aggStats.less) || 0,
      excess: parseInt(aggStats.excess) || 0,
      notReceived: parseInt(aggStats.notReceived) || 0
    };

    const reportQuery = `
      SELECT 
        tr.id,
        tr.tds_dues_id as tdsDuesId,
        COALESCE(
          CASE WHEN tr.tan_no IS NOT NULL AND tr.tan_no NOT LIKE 'NO_TAN_%' AND tr.tan_no NOT LIKE '%UNKNOWN%' AND TRIM(tr.tan_no) != '' THEN TRIM(tr.tan_no) END,
          CASE WHEN d.tan_no IS NOT NULL AND d.tan_no NOT LIKE 'NO_TAN_%' AND TRIM(d.tan_no) != '' THEN TRIM(d.tan_no) END
        ) as tanNo,
        COALESCE(NULLIF(TRIM(d.company_name), ''), COALESCE(CASE WHEN tr.tan_no NOT LIKE 'NO_TAN_%' THEN tr.tan_no END, d.tan_no), 'Unassigned Entity') as companyName,
        'N/A' as billNumber,
        'N/A' as billDate,
        0 as totalBillAmount,
        COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'Unspecified') as financialYear,

        COALESCE(tr.books_tds, 0) as booksTds,
        COALESCE(tr.as26_tds, 0) as as26Tds,
        COALESCE(tr.tally_tds, 0) as tallyTds,
        tr.books_vs_26as_status as booksVs26asStatus,
        tr.books_vs_tally_status as booksVsTallyStatus,
        tr.as26_vs_tally_status as as26VsTallyStatus,
        tr.overall_status as overallStatus,
        tr.as26_batch_id as as26BatchId,
        tr.tally_batch_id as tallyBatchId,
        tr.is_manually_edited as isManuallyEdited,
        tr.is_followup_done as isFollowupDone,
        tr.updated_at as updatedAt,

        COALESCE(NULLIF(TRIM(d.contact_person_name), ''), '') as contactPersonName,
        COALESCE(NULLIF(TRIM(d.designation), ''), '') as designation,
        COALESCE(NULLIF(TRIM(d.contact_number), ''), '') as contactNumber,
        COALESCE(NULLIF(TRIM(d.email_id), ''), '') as emailId,
        COALESCE(NULLIF(TRIM(d.teamleader), ''), '') as teamleader,

        d.company_name as tallyPartyName,
        '' as gstNum,
        '' as panNo,
        0 as tallyGrossTotal,

        d.company_name as as26DeductorName,
        0 as as26InvoiceAmount

      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
      ${orderSQL}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    let rawRows = [];
    try {
      const [res] = await db.query(reportQuery, queryParams);
      rawRows = res;
    } catch (qErr) {
      console.warn('⚠️ Primary report query failed, retrying with fallback:', qErr.message);
      const fallbackQuery = reportQuery.replace('tr.is_followup_done as isFollowupDone,', '0 as isFollowupDone,');
      const [res] = await db.query(fallbackQuery, queryParams);
      rawRows = res;
    }

    const rows = rawRows.map(r => {
      const tally = parseFloat(r.tallyTds || 0);
      const as26 = parseFloat(r.as26Tds || 0);
      const saarthi = parseFloat(r.booksTds || 0);

      const has26as = Boolean(as26 > 0);
      const hasTally = Boolean(tally > 0);
      const hasSaarthi = Boolean(saarthi > 0 || r.tdsDuesId || r.contactPersonName || (r.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(String(r.companyName).trim())));

      const sources = [];
      if (hasTally) sources.push('Tally');
      if (has26as) sources.push('26AS');
      if (hasSaarthi) sources.push('Sarthi');

      const countStr = `${sources.length}/3`;
      let coverageLabel = `${countStr} · ${sources.join(' + ') || 'No match'}`;

      const primaryVal = getPrimaryTdsVal(tally, saarthi);
      const diffCalc = getDifferenceAmount(as26, primaryVal);

      // Derive financialStatus based on centralized rules
      const financialStatus = deriveFinancialStatus({
        tally,
        as26,
        saarthi,
        isManuallyEdited: r.isManuallyEdited,
        overallStatus: r.overallStatus
      });

      const displayFy = (r.financialYear && r.financialYear.trim()) ? r.financialYear.trim() : (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years' ? activeFy : 'Unspecified');

      const personName = (r.contactPersonName && r.contactPersonName.trim() !== '') ? r.contactPersonName.trim() : '';
      const desig = (r.designation && r.designation.trim() !== '') ? r.designation.trim() : '';
      const phone = (r.contactNumber && r.contactNumber.trim() !== '') ? r.contactNumber.trim() : '';
      const email = (r.emailId && r.emailId.trim() !== '') ? r.emailId.trim() : '';

      const isMissingTan = !r.tanNo || String(r.tanNo).startsWith('NO_TAN_') || String(r.tanNo).includes('UNKNOWN');
      const cleanTan = isMissingTan ? null : r.tanNo;

      return {
        ...r,
        tanNo: cleanTan,
        rawTanNo: r.tanNo,
        isTanMissing: isMissingTan,
        contactPersonName: personName,
        designation: desig,
        contactNumber: phone,
        emailId: email,
        financialYear: displayFy,
        saarthiTds: saarthi,
        difference: diffCalc,
        sourceCoverage: {
          count: countStr,
          label: coverageLabel,
          sourcesCount: sources.length,
          sources
        },
        financialStatus
      };
    });

    res.json({
      success: true,
      data: rows,
      total,
      stats,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('💥 Error in getReconciliationReport:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation report', details: error.message });
  }
};


/**
 * Manually Override Pairwise or Overall Status
 */
export const overrideReconciliationStatus = async (req, res) => {
  try {
    const { reconciliationId, overrideField, newValue, note } = req.body;

    if (!reconciliationId || !overrideField || !newValue || !note) {
      return res.status(400).json({ success: false, error: 'Missing parameters. Required: reconciliationId, overrideField, newValue, note' });
    }

    const allowedFields = ['books_vs_26as_status', 'books_vs_tally_status', 'as26_vs_tally_status', 'overall_status'];
    if (!allowedFields.includes(overrideField)) {
      return res.status(400).json({ success: false, error: 'Invalid override field' });
    }

    const targetId = isNaN(parseInt(reconciliationId)) ? reconciliationId : parseInt(reconciliationId);

    const validPairStatuses = ['Match', 'Less Paid', 'Excess', 'Not Received', 'Matched', 'Less'];
    const validOverallStatuses = ['Match', 'Less Paid', 'Excess', 'All Matched', 'Partial Mismatch', 'Major Mismatch', 'Matched', 'Less'];

    if (overrideField === 'overall_status') {
      if (!validOverallStatuses.includes(newValue)) {
        return res.status(400).json({ success: false, error: `Invalid overall status value: ${newValue}` });
      }
    } else {
      if (!validPairStatuses.includes(newValue)) {
        return res.status(400).json({ success: false, error: `Invalid status value: ${newValue}` });
      }
    }

    const updateQuery = `
      UPDATE tds_reconciliation_results 
      SET ${overrideField} = ?, is_manually_edited = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [result] = await db.execute(updateQuery, [newValue, targetId]);

    if (!result || result.affectedRows === 0) {
      const [duesCheck] = await db.execute('SELECT id, tan_no, tds FROM tds_dues WHERE id = ?', [targetId]);
      if (duesCheck && duesCheck.length > 0) {
        const dRow = duesCheck[0];
        await db.execute(
          `INSERT INTO tds_reconciliation_results 
           (tds_dues_id, tan_no, books_tds, ${overrideField}, overall_status, is_manually_edited) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [dRow.id, dRow.tan_no || 'N/A', dRow.tds || 0, newValue, newValue]
        );
      }
    }

    try {
      const auditQuery = `
        INSERT INTO tds_reconciliation_audit_logs (reconciliation_id, action, details, changed_by)
        VALUES (?, ?, ?, ?)
      `;
      const detailsText = `Field: ${overrideField} changed to "${newValue}". Reason/Note: ${note}`;
      await db.execute(auditQuery, [
        targetId,
        'status_override',
        detailsText,
        req.user?.email || 'System Override'
      ]);
    } catch (auditErr) {
      console.warn('⚠️ Audit log write warning:', auditErr.message);
    }

    res.json({
      success: true,
      message: 'Status overridden and logged successfully',
      reconciliationId: targetId,
      field: overrideField,
      newValue
    });

  } catch (error) {
    console.error('💥 Error in overrideReconciliationStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to apply status override', details: error.message });
  }
};

/**
 * Get Historical Upload Batches
 */
export const exportReconciliationCSV = async (req, res) => {
  try {
    const {
      search = '',
      overallStatus = '',
      coverageFilter = 'All',
      fy = '',
      financialYear = '',
      booksVs26asStatus = '',
      booksVsTallyStatus = '',
      as26VsTallyStatus = ''
    } = req.query;

    let whereClauses = [];
    const queryParams = [];

    // Always exclude zero-data ghost rows where all 3 TDS amounts are zero/null
    whereClauses.push("NOT (COALESCE(tr.books_tds, 0) = 0 AND COALESCE(tr.as26_tds, 0) = 0 AND COALESCE(tr.tally_tds, 0) = 0)");
    // Exclude unassigned/unresolved dummy TAN rows (Pending TAN / NO_TAN_) from export
    whereClauses.push("(tr.tan_no IS NOT NULL AND tr.tan_no NOT LIKE 'NO_TAN_%' AND tr.tan_no != 'Pending TAN' AND tr.tan_no != 'Not Available' AND tr.tan_no NOT LIKE '%UNKNOWN%' AND TRIM(tr.tan_no) != '')");

    const activeFy = fy || financialYear;
    if (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years') {
      const cleanFy = String(activeFy).replace(/^FY\s*/i, '').trim();
      whereClauses.push("COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), '')) LIKE ?");
      queryParams.push(`%${cleanFy}%`);
    }

    if (search && String(search).trim() !== '') {
      whereClauses.push("(tr.tan_no LIKE ? OR COALESCE(d.company_name, '') LIKE ?)");
      const wild = `%${String(search).trim()}%`;
      queryParams.push(wild, wild);
    }

    const primaryTdsSQL = PRIMARY_TDS_SQL;

    if (overallStatus && overallStatus !== 'All') {
      const statusCondition = getFinancialStatusWhereClause(overallStatus, primaryTdsSQL);
      if (statusCondition) {
        whereClauses.push(statusCondition);
        if (statusCondition === 'tr.overall_status = ?') {
          queryParams.push(overallStatus);
        }
      }
    }

    if (booksVs26asStatus && booksVs26asStatus !== 'All') {
      whereClauses.push('tr.books_vs_26as_status = ?');
      queryParams.push(booksVs26asStatus);
    }

    // 3-Way Source Coverage Filter
    const hasSaarthiSQL = '(COALESCE(tr.books_tds, 0) > 0)';
    const hasTallySQL = '(COALESCE(tr.tally_tds, 0) > 0)';
    const has26asSQL = '(COALESCE(tr.as26_tds, 0) > 0)';

    if (coverageFilter === '3/3' || coverageFilter === '3 of 3' || coverageFilter === 'all_3' || coverageFilter === 'all3' || coverageFilter === 'All 3 (Saarthi + Tally + 26AS)' || coverageFilter === 'All 3 (Sarthi + Tally + 26AS)') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND ${has26asSQL})`);
    } else if (coverageFilter === 'saarthi_tally' || coverageFilter === 'sarthi_tally' || coverageFilter === 'tally_saarthi' || coverageFilter === 'tally_sarthi' || coverageFilter === 'Saarthi + Tally' || coverageFilter === 'Sarthi + Tally') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND NOT ${has26asSQL})`);
    } else if (coverageFilter === 'tally_26as' || coverageFilter === '26as_tally' || coverageFilter === 'Tally + 26AS') {
      whereClauses.push(`(${hasTallySQL} AND ${has26asSQL} AND NOT ${hasSaarthiSQL})`);
    } else if (coverageFilter === 'as26_saarthi' || coverageFilter === 'as26_sarthi' || coverageFilter === 'saarthi_26as' || coverageFilter === 'sarthi_26as' || coverageFilter === '26as_saarthi' || coverageFilter === '26as_sarthi' || coverageFilter === '26AS + Saarthi' || coverageFilter === '26AS + Sarthi') {
      whereClauses.push(`(${has26asSQL} AND ${hasSaarthiSQL} AND NOT ${hasTallySQL})`);
    } else if (coverageFilter === '2/3' || coverageFilter === '2 of 3') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 2)`);
    } else if (coverageFilter === '1/3' || coverageFilter === '1 of 3' || coverageFilter === 'Single Source Only') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 1)`);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Unassigned Entity') as companyName,
        tr.tan_no as tanNo,
        COALESCE(tr.books_tds, 0) as booksTds,
        COALESCE(tr.as26_tds, 0) as as26Tds,
        COALESCE(tr.tally_tds, 0) as tallyTds,
        tr.books_vs_26as_status as booksVs26asStatus,
        tr.books_vs_tally_status as booksVsTallyStatus,
        tr.as26_vs_tally_status as as26VsTallyStatus,
        tr.overall_status as overallStatus,
        tr.is_manually_edited as isManuallyEdited
      FROM tds_reconciliation_results tr
      LEFT JOIN (
        SELECT 
          MAX(id) as id,
          UPPER(TRIM(tan_no)) as tan_key,
          MAX(company_name) as company_name,
          MAX(financial_year) as financial_year
        FROM tds_dues
        WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''
        GROUP BY UPPER(TRIM(tan_no))
      ) d ON (tr.tds_dues_id = d.id OR UPPER(TRIM(tr.tan_no)) = d.tan_key)
      ${whereSQL}
      ORDER BY tr.updated_at DESC
    `;

    const [rows] = await db.execute(query, queryParams);

    const headers = [
      'Company Name',
      'TAN No',
      'Books TDS (A)',
      '26AS TDS (B)',
      'Tally TDS (C)',
      'Books vs 26AS',
      'Books vs Tally',
      '26AS vs Tally',
      'Overall Status'
    ];

    let csvContent = headers.join(',') + '\n';
    rows.forEach(r => {
      const isMissingTan = !r.tanNo || String(r.tanNo).startsWith('NO_TAN_') || String(r.tanNo).includes('UNKNOWN');
      const cleanTan = isMissingTan ? 'Pending TAN' : r.tanNo;

      const tally = parseFloat(r.tallyTds || 0);
      const as26 = parseFloat(r.as26Tds || 0);
      const saarthi = parseFloat(r.booksTds || 0);
      const primaryVal = getPrimaryTdsVal(tally, saarthi);
      const calculatedStatus = deriveFinancialStatus({
        tally,
        as26,
        saarthi,
        isManuallyEdited: r.isManuallyEdited,
        overallStatus: r.overallStatus
      });

      const line = [
        `"${String(r.companyName || 'Unknown').replace(/"/g, '""')}"`,
        `"${cleanTan}"`,
        r.booksTds || 0,
        r.as26Tds || 0,
        r.tallyTds || 0,
        `"${r.booksVs26asStatus || ''}"`,
        `"${r.booksVsTallyStatus || ''}"`,
        `"${r.as26VsTallyStatus || ''}"`,
        `"${calculatedStatus}"`
      ];
      csvContent += line.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tds_reconciliation_${overallStatus || 'report'}.csv"`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('💥 Error in exportReconciliationCSV:', error);
    res.status(500).json({ success: false, error: 'Failed to generate CSV export file', details: error.message });
  }
};

/**
 * Purge / Clear uploaded data
 */
export const toggleFollowupDone = async (req, res) => {
  try {
    await ensureFollowupDoneColumn();
    const { id } = req.params;
    const rowId = parseInt(id, 10);
    if (!rowId || isNaN(rowId)) {
      return res.status(400).json({ success: false, error: 'Invalid reconciliation record ID' });
    }

    // Read current value
    const [existing] = await db.query(
      'SELECT is_followup_done FROM tds_reconciliation_results WHERE id = ? LIMIT 1',
      [rowId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const currentVal = existing[0].is_followup_done;
    const newVal = currentVal ? 0 : 1;

    await db.query(
      'UPDATE tds_reconciliation_results SET is_followup_done = ? WHERE id = ?',
      [newVal, rowId]
    );

    res.json({ success: true, id: rowId, isFollowupDone: Boolean(newVal) });
  } catch (error) {
    console.error('💥 Error in toggleFollowupDone:', error);
    res.status(500).json({ success: false, error: 'Failed to update follow-up done flag', details: error.message });
  }
};