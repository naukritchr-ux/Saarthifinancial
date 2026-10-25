"""Synthetic dated source records for financial reconciliation tests."""

def sample_ledger():
    return {
        'loaded_as_of': '2027-12-31',
        'invoices': [{'date': '2026-09-10', 'invoices_count': 1, 'revenue_invoices_count': 1,
                      'company_income': 25000, 'revenue': 100000, 'billed_incl_gst': 118000,
                      'franchisee_share': 75000}],
        'receipts': [{'date': '2026-09-20', 'receipt_invoice_count': 1,
                      'invoice_receipts_gross': 118000, 'company_collections_estimate': 25000}],
        'expenses': [{'id': 1, 'date': '2026-09-10', 'amount': 5000, 'expenses': 'Rent'},
                     {'id': 2, 'date': '2026-09-15', 'amount': 2000, 'expenses': 'EPF@3.67%'}],
        'payroll': [{'id': 'sal-1', 'date': '2026-09-28', 'net_payable': 18000,
                     'ctc_amount': 24000, 'reference_id': 'BANK-SAL-001'}],
        'payouts': [{'date': '2026-09-21', 'amount': 88500}], 'manual': [],
    }

