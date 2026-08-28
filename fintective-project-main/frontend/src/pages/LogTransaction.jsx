import React, { useState, useContext, useEffect } from 'react';
import { FinanceContext } from '../context/FinanceContext';

const LogTransaction = ({ type = 'income', setActivePage }) => {
  const { addTransaction, franchisees, bdAgents, transactions, activeModule } = useContext(FinanceContext);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [date, setDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [referenceId, setReferenceId] = useState('');
  const [franchiseeId, setFranchiseeId] = useState('');
  const [bdAgentId, setBdAgentId] = useState('');
  const [description, setDescription] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const incomeCategories = activeModule === 'job_portal'
    ? ['Job portal', 'Other']
    : ['Recruitment', 'Franchisee fee', 'Other'];

  const expenseCategories = activeModule === 'job_portal'
    ? ['Portal subscriptions', 'Marketing', 'Salaries', 'Other']
    : ['Salaries', 'BD commissions', 'Marketing', 'Office & infra', 'Other'];

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  // Set default date to today's local date in YYYY-MM-DD format
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
    setValidationErrors({});
  }, [type]);

  // Set defaults on type change or activeModule change
  useEffect(() => {
    if (type === 'income') {
      setCategory(activeModule === 'job_portal' ? 'Job portal' : 'Recruitment');
    } else {
      setCategory(activeModule === 'job_portal' ? 'Portal subscriptions' : 'Salaries');
    }
    setPaymentMode(type === 'income' ? 'Net Banking' : 'UPI');
    setSubCategory('');
    setCompanyName('');
    setReferenceId('');
    setFranchiseeId('');
    setBdAgentId('');
    setTitle('');
    setAmount('');
    setDescription('');
    setValidationErrors({});
  }, [type, activeModule]);

  // Real-time duplicate entry validation
  const isDuplicate = transactions.some(t => {
    return t.date === date && 
           t.category === category && 
           parseFloat(t.amount) === parseFloat(amount) &&
           t.type === type;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Inline validation checks
    const errors = {};
    if (!title.trim()) {
      errors.title = 'Transaction title is required.';
    }
    if (!amount || parseFloat(amount) <= 0) {
      errors.amount = 'Please enter a valid amount greater than 0.';
    }
    if (!date) {
      errors.date = 'Date is required.';
    }

    // Required link logic based on category
    if (type === 'income') {
      if (category === 'Franchisee fee' && !franchiseeId) {
        errors.franchiseeId = 'Please select a Franchisee Hub to link this franchisee fee entry to.';
      }
      if (category === 'Recruitment' && !bdAgentId) {
        errors.bdAgentId = 'Please select a BD Agent to link this recruitment fee entry to.';
      }
    } else if (type === 'expense') {
      if (category === 'BD commissions' && !bdAgentId) {
        errors.bdAgentId = 'Please select a BD Agent to link this commission payout to.';
      }
      if (category === 'Marketing' && !bdAgentId && !franchiseeId) {
        errors.attribution = 'Please link this marketing expense to either a BD Agent or a Franchisee Hub.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    const transactionData = {
      title,
      amount: parseFloat(amount),
      companyName: companyName.trim() || 'N/A',
      type,
      category,
      subCategory: subCategory.trim() || 'General',
      date,
      paymentMode,
      referenceId: referenceId.trim() || `TXN-${Date.now().toString().slice(-8).toUpperCase()}`,
      description,
      ...(franchiseeId && { franchiseeId }),
      ...(bdAgentId && { bdAgentId })
    };

    addTransaction(transactionData);
    alert(`Successfully logged ${type} entry: "${title}" (Amount: ₹${parseFloat(amount).toLocaleString()})`);
    setActivePage('dashboard');
  };

  return (
    <div className="log-transaction-page animate-fade-in">
      <div className="form-card">
        <h2 className="form-card-title">
          {type === 'income' ? 'Log Income Entry' : 'Log Expense Entry'}
        </h2>
        
        <form onSubmit={handleSubmit} className="transaction-form">
          <div className="form-group">
            <label htmlFor="tx-title">Transaction Item Title *</label>
            <input
              type="text"
              id="tx-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationErrors.title) setValidationErrors(prev => ({ ...prev, title: '' }));
              }}
              placeholder={type === 'income' ? 'e.g., Wipro Dev placements invoice' : 'e.g., Office Tea & Refreshments'}
              className={validationErrors.title ? 'input-error' : ''}
            />
            {validationErrors.title && (
              <span className="error-text" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {validationErrors.title}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="tx-amount">Exact Amount (in ₹) *</label>
              <input
                type="number"
                id="tx-amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (validationErrors.amount) setValidationErrors(prev => ({ ...prev, amount: '' }));
                }}
                placeholder="e.g., 423.50"
                className={validationErrors.amount ? 'input-error' : ''}
                min="0.01"
                step="any"
              />
              {validationErrors.amount && (
                <span className="error-text" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {validationErrors.amount}
                </span>
              )}
            </div>

            <div className="form-group flex-1">
              <label htmlFor="tx-date">Date *</label>
              <input
                type="date"
                id="tx-date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (validationErrors.date) setValidationErrors(prev => ({ ...prev, date: '' }));
                }}
                className={validationErrors.date ? 'input-error' : ''}
              />
              {validationErrors.date && (
                <span className="error-text" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {validationErrors.date}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="tx-category">Primary Category</label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setValidationErrors({});
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="tx-subcategory">Sub-Category (Specific tag)</label>
              <input
                type="text"
                id="tx-subcategory"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="e.g., Tea & Coffee, Google Search Ads"
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="tx-company">Company / Vendor Name</label>
              <input
                type="text"
                id="tx-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={type === 'income' ? 'e.g., Acme Tech Pvt Ltd' : 'e.g., AWS Services, Vendor Corp'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="tx-payment">Payment Method</label>
              <select
                id="tx-payment"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="UPI">UPI (GPay/PhonePe)</option>
                <option value="Net Banking">Net Banking (NEFT/RTGS)</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="tx-ref">Reference ID / Invoice #</label>
              <input
                type="text"
                id="tx-ref"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g., UPI-2938172 (will auto-generate if empty)"
              />
            </div>
          </div>

          {/* Render both links side-by-side for maximum flexbility in linking direct costs */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="tx-franchisee">
                Link to Franchisee Hub {
                  (type === 'income' && category === 'Franchisee fee') || 
                  (type === 'expense' && category === 'Marketing' && !bdAgentId) ? '*' : '(Optional)'
                }
              </label>
              <select
                id="tx-franchisee"
                value={franchiseeId}
                onChange={(e) => {
                  setFranchiseeId(e.target.value);
                  setValidationErrors(prev => ({ ...prev, franchiseeId: '', attribution: '' }));
                }}
                className={validationErrors.franchiseeId || validationErrors.attribution ? 'input-error' : ''}
              >
                <option value="">-- None --</option>
                {franchisees.map(fran => (
                  <option key={fran.id} value={fran.id}>{fran.name} ({fran.city})</option>
                ))}
              </select>
              {validationErrors.franchiseeId && (
                <span className="error-text" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {validationErrors.franchiseeId}
                </span>
              )}
            </div>

            <div className="form-group flex-1">
              <label htmlFor="tx-bd">
                Link to BD Agent Payout {
                  (type === 'expense' && category === 'BD commissions') || 
                  (type === 'income' && category === 'Recruitment') || 
                  (type === 'expense' && category === 'Marketing' && !franchiseeId) ? '*' : '(Optional)'
                }
              </label>
              <select
                id="tx-bd"
                value={bdAgentId}
                onChange={(e) => {
                  setBdAgentId(e.target.value);
                  setValidationErrors(prev => ({ ...prev, bdAgentId: '', attribution: '' }));
                }}
                className={validationErrors.bdAgentId || validationErrors.attribution ? 'input-error' : ''}
              >
                <option value="">-- None --</option>
                {bdAgents.map(bd => (
                  <option key={bd.id} value={bd.id}>{bd.name}</option>
                ))}
              </select>
              {validationErrors.bdAgentId && (
                <span className="error-text" style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  {validationErrors.bdAgentId}
                </span>
              )}
            </div>
          </div>

          {validationErrors.attribution && (
            <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '-10px', marginBottom: '15px', paddingLeft: '5px' }}>
              ⚠️ {validationErrors.attribution}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="tx-description">Transaction Comments / Audit Notes</label>
            <textarea
              id="tx-description"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Paid tea vendor for June month refreshments..."
            ></textarea>
          </div>

          {isDuplicate && (
            <div className="duplicate-alert" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontSize: '0.85rem' }}>
              <span>⚠️ <strong>Audit Alert:</strong> A transaction with matching date, category, and amount already exists. Check to make sure this is not a duplicate before submitting.</span>
            </div>
          )}

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setActivePage('dashboard')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={`btn ${type === 'income' ? 'btn-primary' : 'btn-danger'}`}
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogTransaction;
