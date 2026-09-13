/**
 * controllers/tds26asController.js — Legacy barrel export.
 *
 * All handlers have been modularized into domain-specific modules:
 *   - controllers/tds26as/imports.js  (26AS, Tally uploads, CSV parsing, dataset seeding)
 *   - controllers/tds26as/reports.js  (Dashboard, reports, cleaning queue, overrides, export CSV)
 *   - controllers/tds26as/batches.js  (Upload history batches, dataset purge)
 *   - controllers/tds26as/sync.js     (Live Saarthi CRM sync)
 */
export * from './tds26as/index.js';