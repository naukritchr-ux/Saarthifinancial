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

export const getUploadHistory = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        file_name as fileName,
        file_path as filePath,
        uploaded_by as uploadedBy,
        status,
        metadata,
        upload_time as uploadTime
      FROM upload_history
      ORDER BY upload_time DESC
    `;
    const [rows] = await db.execute(query);

    const parsedRows = rows.map(r => {
      let meta = {};
      try {
        meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      } catch (e) {
        meta = { raw: r.metadata };
      }
      return { ...r, metadata: meta };
    });

    res.json({ success: true, data: parsedRows });

  } catch (error) {
    console.error('💥 Error in getUploadHistory:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve upload batch logs', details: error.message });
  }
};

/**
 * Export Reconciliation Report as CSV File
 */
export const purgeUploadData = async (req, res) => {
  let conn = null;
  try {
    const { target, confirm } = req.body || {};

    if (!target || (confirm !== 'PURGE' && confirm !== true && confirm !== 'true')) {
      return res.status(400).json({
        success: false,
        error: 'Refusing to purge data: explicit "target" (26as, tally, or all) and { confirm: "PURGE" } are required in request body.'
      });
    }

    console.log(`🧹 [AUDIT LOG] Purging upload dataset target: "${target}" by IP: ${req.ip || 'unknown'} at ${new Date().toISOString()}`);

    if (typeof db.getConnection === 'function') {
      try {
        conn = await db.getConnection();
      } catch (e) {
        conn = null;
      }
    }
    const runner = conn || db;

    if (process.env.DB_TYPE === 'mysql') {
      try { await runner.execute('SET FOREIGN_KEY_CHECKS = 0'); } catch (e) { }
    }

    try {
      if (target === '26as') {
        await runner.execute('DELETE FROM tds_26as_entries');
        await runner.execute(
          `DELETE FROM upload_history 
           WHERE metadata LIKE '%26as%' OR metadata LIKE '%26AS%' 
              OR file_name LIKE '%26as%' OR file_name LIKE '%26AS%' OR file_name LIKE '%Form26AS%'`
        );
        await runner.execute(
          `UPDATE tds_reconciliation_results 
           SET as26_tds = 0, as26_batch_id = NULL, books_vs_26as_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
           WHERE (is_manually_edited IS NULL OR is_manually_edited = 0)`
        );
        await runner.execute(
          `DELETE FROM tds_reconciliation_results 
           WHERE (as26_tds IS NULL OR as26_tds = 0) 
             AND (tally_tds IS NULL OR tally_tds = 0) 
             AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
        );
        await reconcile(null, null);
      } else if (target === 'tally') {
        await runner.execute('DELETE FROM tds_tally_entries');
        await runner.execute(
          `DELETE FROM upload_history 
           WHERE metadata LIKE '%tally%' OR metadata LIKE '%TALLY%' 
              OR file_name LIKE '%tally%' OR file_name LIKE '%Tally%'`
        );
        await runner.execute(
          `UPDATE tds_reconciliation_results 
           SET tally_tds = 0, tally_batch_id = NULL, books_vs_tally_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
           WHERE (is_manually_edited IS NULL OR is_manually_edited = 0)`
        );
        await runner.execute(
          `DELETE FROM tds_reconciliation_results 
           WHERE (as26_tds IS NULL OR as26_tds = 0) 
             AND (tally_tds IS NULL OR tally_tds = 0) 
             AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
        );
        await reconcile(null, null);
      } else if (target === 'all') {
        await runner.execute('DELETE FROM tds_26as_entries');
        await runner.execute('DELETE FROM tds_tally_entries');
        await runner.execute('DELETE FROM upload_history');
        await runner.execute('DELETE FROM tds_reconciliation_results');
        await runner.execute('DELETE FROM tds_dues');
        // NOTE: Follow-up logs (tds_followups) are preserved and never deleted during dataset purge
      } else {
        return res.status(400).json({
          success: false,
          error: `Invalid purge target: "${target}". Valid targets are '26as', 'tally', or 'all'.`
        });
      }
    } finally {
      if (process.env.DB_TYPE === 'mysql') {
        try { await runner.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) { }
      }
      if (conn && typeof conn.release === 'function') {
        conn.release();
      }
    }

    markPurgedFlag();
    res.json({ success: true, message: `Successfully cleaned ${target} dataset records` });
  } catch (err) {
    console.error('Error in purgeUploadData:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Delete a specific upload history batch and its associated dataset entries
 */
export const deleteUploadBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const reqBatchId = req.body?.batchId;

    if (!id && !reqBatchId) {
      return res.status(400).json({ success: false, error: 'Batch ID is required' });
    }

    const isNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(String(id));
    let rows = [];

    if (isNumeric) {
      const [r] = await db.execute('SELECT * FROM upload_history WHERE id = ?', [parseInt(id)]);
      rows = r || [];
    } else {
      const [r] = await db.execute('SELECT * FROM upload_history WHERE metadata LIKE ?', [`%${id}%`]);
      rows = r || [];
    }

    let batchId = reqBatchId || (!isNumeric && typeof id === 'string' && id.startsWith('batch_') ? id : null);
    let historyId = isNumeric ? parseInt(id) : null;

    if (rows.length > 0) {
      const batchRecord = rows[0];
      historyId = batchRecord.id;
      let meta = {};
      try {
        meta = typeof batchRecord.metadata === 'string' ? JSON.parse(batchRecord.metadata) : (batchRecord.metadata || {});
      } catch (e) { }
      batchId = meta.upload_batch_id || batchId;
    }

    let batchWarning = null;
    if (!batchId) {
      // Do NOT fall back to numeric upload_history.id as batch UUID
      batchWarning = `No resolvable upload_batch_id UUID found for upload history record ${id}. Cascade deletion of raw entries and reconciliation results was skipped.`;
      console.warn(`⚠️ [deleteUploadBatch] ${batchWarning}`);
    } else {
      await db.execute('DELETE FROM tds_26as_entries WHERE upload_batch_id = ?', [batchId]);
      await db.execute('DELETE FROM tds_tally_entries WHERE upload_batch_id = ?', [batchId]);

      // Zero out matching 26AS side
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET as26_tds = 0, as26_batch_id = NULL, books_vs_26as_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
         WHERE as26_batch_id = ? AND (is_manually_edited IS NULL OR is_manually_edited = 0)`,
        [batchId]
      );

      // Zero out matching Tally side
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET tally_tds = 0, tally_batch_id = NULL, books_vs_tally_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
         WHERE tally_batch_id = ? AND (is_manually_edited IS NULL OR is_manually_edited = 0)`,
        [batchId]
      );
    }

    if (historyId) {
      await db.execute('DELETE FROM upload_history WHERE id = ?', [historyId]);
    } else if (id) {
      await db.execute('DELETE FROM upload_history WHERE metadata LIKE ?', [`%${id}%`]);
    }

    try {
      await reconcile(null, null);
    } catch (recErr) {
      console.warn('Reconcile after delete warning:', recErr.message);
    }

    try {
      await db.execute(
        `DELETE FROM tds_reconciliation_results 
         WHERE (as26_tds IS NULL OR as26_tds = 0) 
           AND (tally_tds IS NULL OR tally_tds = 0) 
           AND (books_tds IS NULL OR books_tds = 0)
           AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
    } catch (e) { }

    res.json({ 
      success: true, 
      message: 'Upload file batch deleted successfully', 
      warning: batchWarning || undefined,
      id,
      batchId: batchId || null
    });
  } catch (error) {
    console.error('💥 Error in deleteUploadBatch:', error);
    res.status(500).json({ success: false, error: 'Failed to delete upload batch', details: error.message });
  }
};

/**
 * Sync Live Sarthi 360 API Data (api/clients_info + legals_info)
 */