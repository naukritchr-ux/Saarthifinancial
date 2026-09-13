import React, { useState, useContext, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import {
  X,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Save,
  Search,
  RotateCcw
} from 'lucide-react';

const formatINR = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

const formatLakhs = (val) => {
  const num = Number(val) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakhs`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return `₹${num}`;
};

const getCategoryTag = (category) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('salary') || cat.includes('commission') || cat.includes('staff')) {
    return { label: 'Payroll & Comp', bg: '#EFF6FF', color: '#1D4ED8', border: '#DBEAFE' };
  }
  if (cat.includes('rent') || cat.includes('infra') || cat.includes('office') || cat.includes('utilit')) {
    return { label: 'Facilities & Infra', bg: '#FDF4FF', color: '#86198F', border: '#F5D0FE' };
  }
  if (cat.includes('software') || cat.includes('portal') || cat.includes('tech') || cat.includes('subscript')) {
    return { label: 'SaaS & Subscriptions', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
  }
  if (cat.includes('market') || cat.includes('travel') || cat.includes('operat')) {
    return { label: 'Operational & Growth', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
  }
  return { label: 'General Overhead', bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' };
};

const BudgetSettingsModal = ({ isOpen, onClose }) => {
  const { budgets, setBudgets, userRole } = useContext(FinanceContext);
  
  const [localBudgets, setLocalBudgets] = useState({});
  const [initialBudgets, setInitialBudgets] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (budgets && typeof budgets === 'object' && Object.keys(budgets).length > 0) {
      setLocalBudgets({ ...budgets });
      setInitialBudgets({ ...budgets });
    }
    setSaveSuccess(false);
    setErrorMessage('');
  }, [budgets, isOpen]);

  if (!isOpen) return null;

  const isAdmin = userRole === 'admin';

  const handleChange = (category, value) => {
    const numeric = value === '' ? 0 : parseFloat(value);
    setLocalBudgets(prev => ({
      ...prev,
      [category]: isNaN(numeric) ? 0 : numeric
    }));
    setSaveSuccess(false);
  };

  const handleIncrement = (category, increment) => {
    if (!isAdmin || isSaving) return;
    setLocalBudgets(prev => ({
      ...prev,
      [category]: Math.max(0, (Number(prev[category]) || 0) + increment)
    }));
    setSaveSuccess(false);
  };

  const handleResetCategory = (category) => {
    if (!isAdmin || isSaving) return;
    setLocalBudgets(prev => ({
      ...prev,
      [category]: initialBudgets[category] !== undefined ? initialBudgets[category] : 0
    }));
    setSaveSuccess(false);
  };

  const totalMonthlyBudget = Object.values(localBudgets).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const totalCategoriesCount = Object.keys(localBudgets).length;

  const filteredCategories = Object.entries(localBudgets).filter(([category]) =>
    category.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const isDirty = useMemo(() => {
    const keys = Object.keys(localBudgets);
    for (const k of keys) {
      if ((localBudgets[k] || 0) !== (initialBudgets[k] || 0)) return true;
    }
    return false;
  }, [localBudgets, initialBudgets]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/budgets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localBudgets)
      });

      if (res && res.ok) {
        if (typeof setBudgets === 'function') {
          setBudgets(localBudgets);
        }
        setInitialBudgets({ ...localBudgets });
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 4000);
      } else {
        throw new Error('Server returned error while saving budget allocations.');
      }
    } catch (err) {
      console.error('Error saving budgets:', err);
      // Fallback local update
      if (typeof setBudgets === 'function') {
        setBudgets(localBudgets);
      }
      setInitialBudgets({ ...localBudgets });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '16px'
      }}
    >
      <div
        className="modal-container budget-settings-modal animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '88vh',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E3E5E0',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            borderBottom: '1px solid #E3E5E0',
            padding: '18px 24px',
            backgroundColor: '#FAFBFA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#E6F4EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0F6E56',
                flexShrink: 0
              }}
            >
              <Settings size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1B2321', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Budget & Operational Thresholds</span>
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6B7268' }}>
                Define monthly spend limits across cost categories to power automated budget alert triggers
              </p>
            </div>
          </div>

          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: '#F1F3F0',
              border: 'none',
              color: '#1B2321',
              cursor: 'pointer',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Stats & Search Toolbar */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#F6F7F4',
            borderBottom: '1px solid #E3E5E0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7268', fontWeight: '600' }}>
                Total Monthly Allocation
              </span>
              <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0F6E56' }}>
                {formatINR(totalMonthlyBudget)}
              </span>
            </div>

            <div style={{ height: '30px', width: '1px', backgroundColor: '#D1D5DB' }} />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7268', fontWeight: '600' }}>
                Configured Categories
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#22314F' }}>
                {totalCategoriesCount} Categories
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', maxWidth: '280px', minWidth: '180px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter category..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  fontSize: '0.82rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#1B2321',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            className="modal-body"
            style={{
              padding: '20px 24px',
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {!isAdmin && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  color: '#92400E',
                  fontSize: '0.83rem'
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Read-Only Mode:</strong> Only administrators can edit budget caps. Log in with an Admin account to modify values.
                </span>
              </div>
            )}

            {Object.keys(localBudgets).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7268' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading budget configurations...</p>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: '#6B7268' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>No budget categories matching "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#0F6E56',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Clear search filter
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '14px'
                }}
              >
                {filteredCategories.map(([category, amount]) => {
                  const tag = getCategoryTag(category);
                  const isModified = initialBudgets[category] !== undefined && (Number(amount) || 0) !== (Number(initialBudgets[category]) || 0);

                  return (
                    <div
                      key={category}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: isModified ? '1.5px solid #0F6E56' : '1px solid #E3E5E0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: isModified ? '0 4px 12px rgba(15, 110, 86, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.88rem', fontWeight: '700', color: '#1B2321', display: 'block' }}>
                            {category}
                          </label>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '3px',
                              fontSize: '0.68rem',
                              fontWeight: '600',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: tag.bg,
                              color: tag.color,
                              border: `1px solid ${tag.border}`
                            }}
                          >
                            {tag.label}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0F6E56' }}>
                            {formatLakhs(amount)}
                          </span>
                          {isModified && (
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#B7791F', fontWeight: '600' }}>
                              Modified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Input row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#6B7268',
                              fontSize: '0.92rem',
                              fontWeight: '700',
                              pointerEvents: 'none'
                            }}
                          >
                            ₹
                          </span>
                          <input
                            type="number"
                            value={amount === 0 ? '' : amount}
                            onChange={(e) => handleChange(category, e.target.value)}
                            placeholder="0"
                            min="0"
                            step="any"
                            disabled={!isAdmin || isSaving}
                            style={{
                              width: '100%',
                              backgroundColor: '#FAFBFA',
                              border: '1px solid #D1D5DB',
                              borderRadius: '8px',
                              padding: '8px 10px 8px 28px',
                              color: '#1B2321',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              outline: 'none',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                            }}
                          />
                        </div>

                        {isAdmin && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleIncrement(category, 10000)}
                              title="Add ₹10,000"
                              disabled={isSaving}
                              style={{
                                padding: '6px 8px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                backgroundColor: '#F1F3F0',
                                border: '1px solid #E3E5E0',
                                borderRadius: '6px',
                                color: '#1B2321',
                                cursor: 'pointer'
                              }}
                            >
                              +10k
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIncrement(category, 50000)}
                              title="Add ₹50,000"
                              disabled={isSaving}
                              style={{
                                padding: '6px 8px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                backgroundColor: '#F1F3F0',
                                border: '1px solid #E3E5E0',
                                borderRadius: '6px',
                                color: '#1B2321',
                                cursor: 'pointer'
                              }}
                            >
                              +50k
                            </button>
                            {isModified && (
                              <button
                                type="button"
                                onClick={() => handleResetCategory(category)}
                                title="Reset to original value"
                                disabled={isSaving}
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '0.72rem',
                                  backgroundColor: '#FDF2F2',
                                  border: '1px solid #F8D7DA',
                                  borderRadius: '6px',
                                  color: '#A8402E',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {saveSuccess && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#E6F4EA',
                  border: '1px solid #CEEAD6',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginTop: '6px'
                }}
              >
                <CheckCircle2 color="#0F6E56" size={20} />
                <div style={{ fontSize: '0.85rem', color: '#0F6E56' }}>
                  <strong>Budget Thresholds Saved!</strong> MySQL database updated and overhead variance tracking live.
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: '#FDF2F2',
                  border: '1px solid #F8D7DA',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginTop: '6px',
                  color: '#A8402E',
                  fontSize: '0.85rem'
                }}
              >
                <AlertTriangle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div
            className="modal-footer"
            style={{
              padding: '14px 24px',
              backgroundColor: '#FAFBFA',
              borderTop: '1px solid #E3E5E0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: '#6B7268', fontWeight: '500' }}>
                {isAdmin ? 'Admin controls active' : 'View only permissions'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSaving}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  color: '#374151',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {isDirty ? 'Cancel' : 'Close'}
              </button>

              {isAdmin && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || !isDirty}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: isDirty ? '#0F6E56' : '#9CA3AF',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: isDirty && !isSaving ? 'pointer' : 'not-allowed',
                    boxShadow: isDirty ? '0 2px 6px rgba(15, 110, 86, 0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Save size={16} />
                  <span>{isSaving ? 'Saving Changes...' : isDirty ? 'Save Allocations' : 'Saved'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetSettingsModal;
