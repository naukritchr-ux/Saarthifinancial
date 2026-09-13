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

export const syncSaarthiLiveApi = async (req, res) => {
  try {
    clearPurgedFlag();
    console.log('🔄 Syncing live Sarthi 360 client & legal master data...');

    const fetchEndpointWithFallback = async (endpointName, ms = 12000) => {
      const cleanName = String(endpointName || '').replace(/^api\//, '').trim();
      const candidates = [
        `https://api.sarthi360.in/${cleanName}`,
        `https://api.sarthi360.in/api/${cleanName}`,
        `https://sarthi360.in/${cleanName}`,
        `https://sarthi360.in/api/${cleanName}`,
        `https://api.saarthi360.in/${cleanName}`,
        `https://api.saarthi360.in/api/${cleanName}`
      ];

      for (const url of candidates) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try {
          const r = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (r.ok) {
            const data = await r.json();
            const arr = Array.isArray(data) ? data : (data?.data || []);
            if (arr.length > 0) {
              console.log(`✅ Successfully fetched ${arr.length} records from ${url}`);
              return { ok: true, data: arr, url };
            }
          }
        } catch (err) {
          clearTimeout(timer);
          console.warn(`Candidate fetch error for ${url}:`, err.message);
        }
      }
      return { ok: false, data: [] };
    };

    const [cRes, lRes, iRes] = await Promise.all([
      fetchEndpointWithFallback('clients_info'),
      fetchEndpointWithFallback('legals_info'),
      fetchEndpointWithFallback('Invoice')
    ]);

    let clientsData = cRes.data || [];
    let legalsData = lRes.data || [];
    let invoicesData = iRes.data || [];

    if (invoicesData.length === 0) {
      const invAlt = await fetchEndpointWithFallback('invoice');
      invoicesData = invAlt.data || [];
    }

    console.log(`ℹ️ CRM Data Live: ${clientsData.length} clients, ${legalsData.length} legals, ${invoicesData.length} invoices`);

    const liveApiStatus = {
      clients_info: cRes.ok ? 'ok' : 'unreachable',
      legals_info: lRes.ok ? 'ok' : 'unreachable',
      invoices: invoicesData.length > 0 ? 'ok' : 'unreachable'
    };

    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const makeKey = (tan, fy) => `${(tan || '').toUpperCase().trim()}|${(fy || '').toUpperCase().trim()}`;

    // Map legals GST -> TAN and normalized company name -> TAN
    const legalGstToTan = new Map();
    const legalNameToTan = new Map();

    legalsData.forEach(l => {
      const tan = String(l.tanNo || '').trim().toUpperCase();
      const gst = String(l.gstNo || '').trim().toUpperCase();
      const norm = normalize(l.companyName || l.partyName);
      if (tan) {
        if (gst) legalGstToTan.set(gst, tan);
        if (norm) legalNameToTan.set(norm, tan);
      }
    });

    // Accumulate invoice TDS amounts from CRM by (TAN, Financial Year)
    const crmTdsByTanFy = new Map();
    const crmTdsByNormNameFy = new Map();
    const distinctFyByTan = new Map();
    const distinctFyByNorm = new Map();

    invoicesData.forEach(inv => {
      // tdsAmount is the primary field from Sarthi API; fall back to legacy aliases
      const tds = parseFloat(inv.tdsAmount || inv.tds_amount || inv.tds || inv.legal_amount || inv.amount || 0);
      const invFy = normalizeFY(inv.financialYear || inv.fy || inv.financial_year || inv.fin_year || inv.finYear) ||
        getFinancialYearFromDate(inv.legal_invoiceDate || inv.invoiceDate || inv.billDate || inv.date || inv.created_at) || null;

      const gst = String(inv.gstNo || inv.gstNum || '').trim().toUpperCase();
      const norm = normalize(inv.companyName || inv.partyName);
      const tan = legalGstToTan.get(gst) || legalNameToTan.get(norm) || (inv.tanNo ? String(inv.tanNo).trim().toUpperCase() : null);

      if (tan) {
        if (!distinctFyByTan.has(tan)) distinctFyByTan.set(tan, new Set());
        if (invFy) distinctFyByTan.get(tan).add(invFy);
        if (tds > 0) {
          const key = makeKey(tan, invFy);
          crmTdsByTanFy.set(key, (crmTdsByTanFy.get(key) || 0) + tds);
        }
      }
      if (norm) {
        if (!distinctFyByNorm.has(norm)) distinctFyByNorm.set(norm, new Set());
        if (invFy) distinctFyByNorm.get(norm).add(invFy);
        if (tds > 0) {
          const normKey = makeKey(norm, invFy);
          crmTdsByNormNameFy.set(normKey, (crmTdsByNormNameFy.get(normKey) || 0) + tds);
        }
      }
    });

    // Also accumulate TDS directly from legals_info rows (works even when Invoice API is unreachable)
    legalsData.forEach(l => {
      // Primary field is tdsAmount; fall back to legacy aliases
      const legalTds = parseFloat(l.tdsAmount || l.tds_amount || l.tds || l.legal_amount || 0);
      const legalFy = normalizeFY(l.financialYear || l.fy || l.financial_year) ||
        getFinancialYearFromDate(l.voucherDate || l.legal_invoiceDate || l.invoiceDate || l.contractDate) || null;
      const tan = String(l.tanNo || '').trim().toUpperCase();
      const norm = normalize(l.companyName || l.partyName);

      if (tan && legalFy) {
        if (!distinctFyByTan.has(tan)) distinctFyByTan.set(tan, new Set());
        distinctFyByTan.get(tan).add(legalFy);
        if (legalTds > 0) {
          const key = makeKey(tan, legalFy);
          // Don't overwrite invoice data; add on top
          crmTdsByTanFy.set(key, (crmTdsByTanFy.get(key) || 0) + legalTds);
        }
      }
      if (norm && legalFy) {
        if (!distinctFyByNorm.has(norm)) distinctFyByNorm.set(norm, new Set());
        distinctFyByNorm.get(norm).add(legalFy);
        if (legalTds > 0) {
          const normKey = makeKey(norm, legalFy);
          crmTdsByNormNameFy.set(normKey, (crmTdsByNormNameFy.get(normKey) || 0) + legalTds);
        }
      }
    });

    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/i;

    const extractPanFromGst = (gst) => {
      const clean = String(gst || '').trim().toUpperCase();
      if (gstRegex.test(clean)) {
        return clean.substring(2, 12);
      }
      return null;
    };

    const clientMasters = [];

    clientsData.forEach(item => {
      if (!item || (!item.companyName && !item.id)) return;
      const gst = String(item.gstNumber || item.gstNo || item.gstNum || '').trim().toUpperCase();
      const pan = extractPanFromGst(gst) || (panRegex.test(item.panNo || item.panNumber || item.pan || '') ? String(item.panNo || item.panNumber || item.pan).trim().toUpperCase() : null);
      const companyName = String(item.companyName || '').trim();
      const norm = normalize(companyName);
      const itemTan = String(item.tanNo || item.tanNumber || '').trim().toUpperCase() || legalGstToTan.get(gst) || legalNameToTan.get(norm) || null;

      const itemFys = (itemTan && distinctFyByTan.get(itemTan)) || (norm && distinctFyByNorm.get(norm)) || new Set([null]);
      const fyList = itemFys.size > 0 ? Array.from(itemFys) : [null];

      for (const fy of fyList) {
        const itemTds = (itemTan && crmTdsByTanFy.get(makeKey(itemTan, fy))) ||
          (norm && crmTdsByNormNameFy.get(makeKey(norm, fy))) ||
          parseFloat(item.tdsAmount || item.tds_amount || item.tds || 0) || 0;

        clientMasters.push({
          saarthi_client_id: item.id ? parseInt(item.id) : null,
          company_name: companyName,
          normalized_name: normalizeCompanyName(companyName),
          gst_no: gstRegex.test(gst) ? gst : null,
          pan_no: pan,
          tan_no: (itemTan ? itemTan.replace(/\s+/g, '') : null) || null,
          contact_person_name: String(item.contactPersonName || item.contactPerson || item.clientName || item.personName || item.contact_name || '').trim() || null,
          designation: String(item.contactDesignation || item.designation || item.contact_designation || item.role || '').trim() || null,
          contact_number: String(item.contactPhone || item.contactPhoneNumber || item.phoneNumber || item.mobile || item.mobileNo || item.phone || item.contact_no || '').trim() || null,
          email_id: String(item.contactEmail || item.contactEmailId || item.emailId || item.email || item.contact_email || '').trim() || null,
          teamleader: String(item.teamLeader || item.teamleader || item.tlName || item.manager || '').trim() || null,
          financial_year: fy,
          saarthi_tds: itemTds,
          saarthi_amount: parseFloat(item.amount || item.grossAmount || item.gross_amount || 0) || 0,
          status: String(item.status || 'active').toLowerCase()
        });
      }
    });

    legalsData.forEach(item => {
      if (!item || (!item.companyName && !item.partyName && !item.id)) return;
      const gst = String(item.gstNo || item.gstNumber || item.gstNum || '').trim().toUpperCase();
      const tan = String(item.tanNo || item.tanNumber || '').trim().toUpperCase();
      const pan = String(item.panNo || item.panNumber || '').trim().toUpperCase() || extractPanFromGst(gst);
      const companyName = String(item.companyName || item.partyName || '').trim();
      const norm = normalize(companyName);

      const itemFys = (tan && distinctFyByTan.get(tan)) || (norm && distinctFyByNorm.get(norm)) || new Set([null]);
      const fyList = itemFys.size > 0 ? Array.from(itemFys) : [null];

      for (const fy of fyList) {
        const itemTds = (tan && crmTdsByTanFy.get(makeKey(tan, fy))) ||
          (norm && crmTdsByNormNameFy.get(makeKey(norm, fy))) ||
          parseFloat(item.tdsAmount || item.tds_amount || item.tds || 0) || 0;

        clientMasters.push({
          saarthi_client_id: item.id ? parseInt(item.id) : null,
          company_name: companyName,
          normalized_name: normalizeCompanyName(companyName),
          gst_no: gstRegex.test(gst) ? gst : null,
          pan_no: panRegex.test(pan) ? pan : null,
          tan_no: (tan ? tan.replace(/\s+/g, '') : null) || null,
          contact_person_name: String(item.contactPersonName || item.contactPerson || item.clientName || item.personName || item.contact_name || '').trim() || null,
          designation: String(item.designation || item.contactDesignation || item.contact_designation || item.role || '').trim() || null,
          contact_number: String(item.contactPhoneNumber || item.phoneNumber || item.mobile || item.mobileNo || item.contactPhone || item.phone || item.contact_no || '').trim() || null,
          email_id: String(item.contactEmailId || item.emailId || item.email || item.contactEmail || item.contact_email || '').trim() || null,
          teamleader: String(item.teamLeader || item.teamleader || item.tlName || item.manager || '').trim() || null,
          financial_year: fy,
          saarthi_tds: itemTds,
          saarthi_amount: parseFloat(item.amount || item.grossAmount || item.gross_amount || 0) || 0,
          status: String(item.status || 'ACTIVE').toLowerCase()
        });
      }
    });

    // Filter out records that have neither a TAN nor a client ID nor PAN
    const usableMasters = clientMasters.filter(m => m.tan_no || m.saarthi_client_id || m.pan_no);
    const skippedCount = clientMasters.length - usableMasters.length;
    if (skippedCount > 0) {
      console.log(`⚠️  Skipped ${skippedCount} records with no TAN, PAN, or client ID (unreconcilable).`);
    }

    // 1. Fetch all existing records in ONE query for fast in-memory matching by (TAN/Client, Financial Year)
    const [existingAll] = await db.execute(
      'SELECT id, saarthi_client_id, UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(pan_no)) as pan_no, UPPER(TRIM(company_name)) as company_name, financial_year FROM tds_dues'
    );

    const clientTanFyMap = new Map();
    const clientIdFyMap = new Map();
    const clientNameFyMap = new Map();

    (existingAll || []).forEach(row => {
      const fy = row.financial_year ? row.financial_year.trim() : '';
      if (row.tan_no) clientTanFyMap.set(makeKey(row.tan_no, fy), row.id);
      if (row.saarthi_client_id) clientIdFyMap.set(`${row.saarthi_client_id}|${fy}`, row.id);
      if (row.company_name) clientNameFyMap.set(makeKey(row.company_name, fy), row.id);
    });

    const toUpdate = [];
    const toInsert = [];
    const seenNewKeys = new Set();

    for (const master of usableMasters) {
      const fy = master.financial_year || '';
      let matchedId = null;

      if (master.tan_no && clientTanFyMap.has(makeKey(master.tan_no, fy))) {
        matchedId = clientTanFyMap.get(makeKey(master.tan_no, fy));
      } else if (master.saarthi_client_id && clientIdFyMap.has(`${master.saarthi_client_id}|${fy}`)) {
        matchedId = clientIdFyMap.get(`${master.saarthi_client_id}|${fy}`);
      } else if (master.company_name && clientNameFyMap.has(makeKey(master.company_name, fy))) {
        matchedId = clientNameFyMap.get(makeKey(master.company_name, fy));
      }

      if (matchedId) {
        toUpdate.push({ id: matchedId, master });
      } else {
        const dedupeKey = master.tan_no ? makeKey(master.tan_no, fy) :
          master.saarthi_client_id ? `${master.saarthi_client_id}|${fy}` :
            master.company_name ? makeKey(master.company_name, fy) : null;
        if (!dedupeKey || !seenNewKeys.has(dedupeKey)) {
          if (dedupeKey) seenNewKeys.add(dedupeKey);
          toInsert.push(master);
        }
      }
    }

    let inserted = 0;
    let updated = 0;

    // 2. Perform updates in parallel chunks of 50
    const UPDATE_CHUNK_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK_SIZE) {
      const chunk = toUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
      await Promise.all(chunk.map(item =>
        db.execute(`
          UPDATE tds_dues 
          SET 
            saarthi_client_id = COALESCE(?, saarthi_client_id),
            tan_no = COALESCE(?, tan_no),
            pan_no = COALESCE(?, pan_no),
            gst_num = COALESCE(?, gst_num),
            contact_person_name = COALESCE(NULLIF(?, ''), contact_person_name),
            designation = COALESCE(NULLIF(?, ''), designation),
            contact_number = COALESCE(NULLIF(?, ''), contact_number),
            email_id = COALESCE(NULLIF(?, ''), email_id),
            teamleader = COALESCE(NULLIF(?, ''), teamleader),
            financial_year = COALESCE(?, financial_year),
            tds = CASE WHEN ? > 0 THEN ? ELSE COALESCE(tds, 0) END
          WHERE id = ?
        `, [
          item.master.saarthi_client_id,
          item.master.tan_no,
          item.master.pan_no,
          item.master.gst_no,
          item.master.contact_person_name,
          item.master.designation,
          item.master.contact_number,
          item.master.email_id,
          item.master.teamleader,
          item.master.financial_year || null,
          item.master.saarthi_tds || 0,
          item.master.saarthi_tds || 0,
          item.id
        ])
      ));
      updated += chunk.length;
    }

    // 3. Perform inserts in multi-row bulk chunks of 200
    const INSERT_CHUNK_SIZE = 200;
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const valueRows = [];
      const params = [];
      for (const m of chunk) {
        valueRows.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        params.push(
          m.saarthi_client_id || null,
          m.company_name || '',
          m.tan_no || null,
          m.pan_no || null,
          m.gst_no || null,
          m.contact_person_name || null,
          m.designation || null,
          m.contact_number || null,
          m.email_id || null,
          m.teamleader || null,
          m.financial_year || null,
          m.saarthi_tds || 0
        );
      }
      const sql = `
        INSERT INTO tds_dues 
        (saarthi_client_id, company_name, tan_no, pan_no, gst_num, contact_person_name, designation, contact_number, email_id, teamleader, financial_year, tds)
        VALUES ${valueRows.join(', ')}
      `;
      await db.execute(sql, params);
      inserted += chunk.length;
    }

    // ─── Directly update tds_reconciliation_results.books_tds from tds_dues.tds matching (tan, financial_year) ───
    try {
      await db.execute(`
        UPDATE tds_reconciliation_results tr
        INNER JOIN (
          SELECT UPPER(TRIM(tan_no)) as tan, financial_year, SUM(COALESCE(tds, 0)) as total_tds
          FROM tds_dues
          WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' AND tds > 0
          GROUP BY UPPER(TRIM(tan_no)), financial_year
        ) d ON UPPER(TRIM(tr.tan_no)) = d.tan AND COALESCE(tr.financial_year, '') = COALESCE(d.financial_year, '')
        SET tr.books_tds = d.total_tds
        WHERE d.total_tds > 0
      `);


      const [zeroRows] = await db.query(`
        SELECT tr.id, d.company_name, tr.financial_year 
        FROM tds_reconciliation_results tr 
        LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id 
        WHERE COALESCE(tr.books_tds, 0) = 0 AND d.company_name IS NOT NULL AND d.company_name != ''
      `);

      const nameUpdates = [];
      zeroRows.forEach(r => {
        const norm = normalize(r.company_name);
        const tds = crmTdsByNormNameFy.get(makeKey(norm, r.financial_year));
        if (tds && tds > 0) {
          nameUpdates.push([tds, r.id]);
        }
      });

      const BATCH = 50;
      for (let i = 0; i < nameUpdates.length; i += BATCH) {
        const chunk = nameUpdates.slice(i, i + BATCH);
        await Promise.all(chunk.map(([tds, id]) =>
          db.execute('UPDATE tds_reconciliation_results SET books_tds = ? WHERE id = ?', [tds, id]).catch(() => { })
        ));
      }

      // Recalculate status for rows with books_tds > 0
      await db.execute(`
        UPDATE tds_reconciliation_results
        SET 
          books_vs_26as_status = CASE 
            WHEN COALESCE(books_tds, 0) <= 0 OR COALESCE(as26_tds, 0) <= 0 THEN 'Not Received'
            WHEN ABS(COALESCE(as26_tds, 0) - COALESCE(books_tds, 0)) <= 1.0 THEN 'Matched'
            WHEN COALESCE(as26_tds, 0) > COALESCE(books_tds, 0) THEN 'Excess'
            ELSE 'Less Paid'
          END,
          books_vs_tally_status = CASE 
            WHEN COALESCE(books_tds, 0) <= 0 OR COALESCE(tally_tds, 0) <= 0 THEN 'Not Received'
            WHEN ABS(COALESCE(tally_tds, 0) - COALESCE(books_tds, 0)) <= 1.0 THEN 'Matched'
            WHEN COALESCE(tally_tds, 0) > COALESCE(books_tds, 0) THEN 'Excess'
            ELSE 'Less Paid'
          END
        WHERE books_tds > 0
      `);

      console.log('✅ Directly updated tds_reconciliation_results.books_tds from Saarthi CRM TDS');
    } catch (directErr) {
      console.warn('Direct books_tds update warning:', directErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────────

    reconcile(null, null).catch(rErr => {
      console.warn('Background reconcile warning:', rErr.message);
    });

    res.json({
      success: true,
      message: `Sarthi 360 sync complete. ${inserted} inserted, ${updated} updated.`,
      liveApiStatus,
      stats: {
        clientsFetched: clientMasters.length,
        clientsProcessed: usableMasters.length,
        skipped: skippedCount,
        inserted,
        updated
      }
    });

  } catch (error) {
    console.error('💥 Error in syncSaarthiLiveApi:', error);
    res.status(500).json({
      success: false,
      error: 'Sarthi 360 sync failed',
      details: error.message
    });
  }
};

export const syncSarthiLiveApi = syncSaarthiLiveApi;

/**
 * PATCH /api/tds-26as/report/:id/followup-done
 * Toggle the is_followup_done flag on a single reconciliation row.
 */