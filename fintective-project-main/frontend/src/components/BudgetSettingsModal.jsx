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
      <div className="modal-container budget-settings-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', backgroundColor: '#FFFFFF', border: '1px solid #E3E5E0', color: '#1B2321', borderRadius: '14px', boxShadow: '0 20px 45px -10px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid #E3E5E0', padding: '18px 24px', backgroundColor: '#FAFBFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-header-title">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B2321', margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>
              <Settings size={19} style={{ stroke: '#0F6E56' }} />
              <span>Budget Allocation Settings</span>
            </h3>
            <span className="modal-subtitle" style={{ color: '#6B7268', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>
              Set monthly overhead expenditure limits for warning triggers
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ background: '#F1F3F0', border: 'none', color: '#1B2321', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {!isAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FDF2F2', border: '1px solid #F8D7DA', padding: '12px', borderRadius: '8px', color: '#A8402E', fontSize: '0.85rem' }}>
                <AlertTriangle size={18} />
                <span><strong>Access Restricted:</strong> Only administrators can edit the budget allocation thresholds. Log in as Admin to configure.</span>
              </div>
            ) : null}

            {Object.keys(localBudgets).length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6B7268', padding: '20px' }}>Loading budget configurations...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(localBudgets).map(([category, amount]) => (
                  <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#374151' }}>{category}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', color: '#6B7268', fontSize: '0.9rem', fontWeight: '600' }}>₹</span>
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
                          background: '#FFFFFF',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          padding: '9px 12px 9px 26px',
                          color: '#1B2321',
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {saveSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#E6F4EA', border: '1px solid #CEEAD6', padding: '10px 12px', borderRadius: '8px', marginTop: '8px' }}>
                <CheckCircle2 color="#0F6E56" size={18} />
                <div style={{ fontSize: '0.85rem', color: '#0F6E56' }}>
                  <strong>Success!</strong> Budgets have been successfully saved to the database.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ padding: '14px 24px', background: '#F8F9FA', borderTop: '1px solid #E3E5E0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving} style={{ backgroundColor: '#FFFFFF', border: '1px solid #D1D5DB', color: '#374151', padding: '8px 16px', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
              Close
            </button>
            {isAdmin && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0F6E56', color: '#FFFFFF', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
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
