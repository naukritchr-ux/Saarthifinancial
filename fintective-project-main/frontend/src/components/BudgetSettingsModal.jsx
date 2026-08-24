import React, { useState, useContext, useEffect } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { X, Settings, DollarSign, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

const BudgetSettingsModal = ({ isOpen, onClose }) => {
  const { budgets, updateBudget, userRole } = useContext(FinanceContext);
  
  // Local state to store budget values while editing
  const [localBudgets, setLocalBudgets] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (budgets) {
      setLocalBudgets({ ...budgets });
    }
    setSaveSuccess(false);
  }, [budgets, isOpen]);

  if (!isOpen) return null;

  const isAdmin = userRole === 'admin';

  const handleChange = (category, value) => {
    setLocalBudgets(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Save all updated budgets
      for (const [category, amount] of Object.entries(localBudgets)) {
        await updateBudget(category, amount);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving budgets:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div className="modal-container budget-settings-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', backgroundColor: '#0b132b', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' }}>
          <div className="modal-header-title">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', margin: 0 }}>
              <Settings size={20} className="menu-icon" style={{ stroke: 'var(--accent-teal)' }} />
              <span>Budget Allocation Settings</span>
            </h3>
            <span className="modal-subtitle" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>
              Set monthly overhead expenditure limits for warning triggers
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {!isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '6px', color: '#ef4444', fontSize: '0.85rem' }}>
                <AlertTriangle size={18} />
                <span><strong>Access Restricted:</strong> Only administrators can edit the budget allocation thresholds. Log in as Admin to configure.</span>
              </div>
            ) : null}

            {Object.keys(localBudgets).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Loading budget configurations...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(localBudgets).map(([category, amount]) => (
                  <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#cbd5e1' }}>{category}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>₹</span>
                      <input
                        type="number"
                        value={amount === 0 ? '' : amount}
                        onChange={(e) => handleChange(category, e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="any"
                        disabled={!isAdmin || isSaving}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          padding: '10px 12px 10px 24px',
                          color: '#f8fafc',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {saveSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 12px', borderRadius: '6px', marginTop: '8px' }}>
                <CheckCircle2 color="#10b981" size={18} />
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <strong style={{ color: '#10b981' }}>Success!</strong> Budgets have been successfully saved to the database.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Close
            </button>
            {isAdmin && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            )}
          </div>
        </form>
        
      </div>
    </div>
  );
};

export default BudgetSettingsModal;
