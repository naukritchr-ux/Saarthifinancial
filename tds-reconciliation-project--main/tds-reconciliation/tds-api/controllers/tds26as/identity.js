/**
 * controllers/tds26as/identity.js
 *
 * Permanently correct a company's TAN and/or PAN everywhere it is stored:
 *   - tds_dues                   (Saarthi 360 / CRM data)
 *   - tds_tally_entries          (Tally data)
 *   - tds_26as_entries           (Form 26AS data)
 *   - tds_reconciliation_results (the reconciled rows shown on screen)
 *   - tds_followups              (follow-up history, TAN only)
 *
 * Scope: every record that currently carries the row's OLD TAN (all financial years),
 * because a TAN/PAN identifies the company, not a single year.
 *
 * Route: PUT /api/tds-26as/identity/:id     body: { tanNo?, panNo? }
 */
import db from '../../config/db.js';

const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, '').toUpperCase();
  return s === '' ? null : s;
};

let panColumnChecked = false;
/**
 * Make sure every source table has a pan_no column (Form 26AS rows originally had none).
 * Safe to call repeatedly on SQLite and MySQL; "duplicate column" errors are ignored.
 */
export async function ensurePanColumns() {
  if (panColumnChecked) return;
  for (const table of ['tds_26as_entries', 'tds_tally_entries', 'tds_dues']) {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN pan_no VARCHAR(20)`);
    } catch (e) {
      // column already exists -> fine
    }
  }
  panColumnChecked = true;
}

export const updateRecordIdentity = async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const newTan = clean(req.body?.tanNo);
    const newPan = clean(req.body?.panNo);

    if (!newTan && !newPan) {
      return res.status(400).json({ success: false, error: 'Provide a TAN and/or PAN to save.' });
    }
    if (newTan && !TAN_RE.test(newTan)) {
      return res.status(400).json({ success: false, error: 'Invalid TAN format. Expected 4 letters + 5 digits + 1 letter (e.g. MUMA12345B).' });
    }
    if (newPan && !PAN_RE.test(newPan)) {
      return res.status(400).json({ success: false, error: 'Invalid PAN format. Expected 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).' });
    }

    const [found] = await db.execute(
      'SELECT id, tan_no, financial_year FROM tds_reconciliation_results WHERE id = ?',
      [targetId]
    );
    if (!found || found.length === 0) {
      return res.status(404).json({ success: false, error: 'Reconciliation record not found' });
    }

    const oldTan = String(found[0].tan_no || '').trim().toUpperCase();
    const tanChanged = Boolean(newTan) && newTan !== oldTan;
    const effectiveTan = tanChanged ? newTan : oldTan;

    // ── Collision check: (tan_no, financial_year) is UNIQUE in dues + results ──────────
    if (tanChanged) {
      const conflictFys = new Set();
      for (const table of ['tds_dues', 'tds_reconciliation_results']) {
        const [rows] = await db.execute(
          `SELECT DISTINCT n.financial_year AS fy
             FROM ${table} n
             JOIN ${table} o
               ON COALESCE(n.financial_year, '') = COALESCE(o.financial_year, '')
            WHERE UPPER(TRIM(n.tan_no)) = ? AND UPPER(TRIM(o.tan_no)) = ?`,
          [newTan, oldTan]
        );
        (rows || []).forEach(r => conflictFys.add(r.fy || '(no FY)'));
      }
      if (conflictFys.size > 0) {
        return res.status(409).json({
          success: false,
          error: `TAN ${newTan} already has records for the same financial year(s): ${[...conflictFys].join(', ')}. ` +
                 `Saving would create duplicates, so nothing was changed. Fix or merge those records first.`
        });
      }
    }

    const updated = { dues: 0, tally: 0, as26: 0, results: 0, followups: 0 };
    const affected = (r) => (Array.isArray(r) ? r[0]?.affectedRows : r?.affectedRows) || 0;

    // ── 1) TAN rename across every table (all FYs for the old TAN) ──────────────────────
    if (tanChanged) {
      const rename = [
        ['tds_dues', 'dues'],
        ['tds_tally_entries', 'tally'],
        ['tds_26as_entries', 'as26'],
        ['tds_reconciliation_results', 'results']
      ];
      for (const [table, key] of rename) {
        const r = await db.execute(
          `UPDATE ${table} SET tan_no = ? WHERE UPPER(TRIM(tan_no)) = ?`,
          [newTan, oldTan]
        );
        updated[key] = affected(r);
      }
      try {
        const r = await db.execute(
          'UPDATE tds_followups SET tan_no = ? WHERE UPPER(TRIM(tan_no)) = ?',
          [newTan, oldTan]
        );
        updated.followups = affected(r);
      } catch (e) {
        console.warn('Follow-up TAN update skipped:', e.message);
      }
    }

    // ── 2) PAN written to all three source tables for this TAN ──────────────────────────
    if (newPan) {
      await ensurePanColumns();
      const panTargets = [
        ['tds_dues', 'dues'],
        ['tds_tally_entries', 'tally'],
        ['tds_26as_entries', 'as26']
      ];
      for (const [table, key] of panTargets) {
        const r = await db.execute(
          `UPDATE ${table} SET pan_no = ? WHERE UPPER(TRIM(tan_no)) = ?`,
          [newPan, effectiveTan]
        );
        updated[key] = Math.max(updated[key], affected(r));
      }
    }

    // ── 3) Audit trail ──────────────────────────────────────────────────────────────────
    try {
      const parts = [];
      if (tanChanged) parts.push(`TAN ${oldTan} -> ${newTan}`);
      if (newPan) parts.push(`PAN set to ${newPan}`);
      await db.execute(
        `INSERT INTO tds_reconciliation_audit_logs (reconciliation_id, action, details, changed_by)
         VALUES (?, 'identity_update', ?, 'User')`,
        [targetId, `${parts.join('; ')} (dues ${updated.dues}, tally ${updated.tally}, 26AS ${updated.as26}, results ${updated.results})`]
      );
    } catch (aErr) {
      console.warn('Audit log write error:', aErr.message);
    }

    res.json({
      success: true,
      message: 'TAN/PAN saved to Saarthi 360, Tally and Form 26AS data.',
      data: { id: targetId, tanNo: effectiveTan, panNo: newPan, updated }
    });
  } catch (err) {
    console.error('💥 Error in updateRecordIdentity:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to save TAN/PAN. It is safe to retry — the update is repeatable.',
      details: err.message
    });
  }
};
