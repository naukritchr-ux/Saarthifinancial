import React, { useState } from 'react';
import { GLOSSARY } from '../utils/glossary';
import { Search, X, HelpCircle, BookOpen } from 'lucide-react';

/**
 * Glossary Modal / Slide-over
 * Opens cleanly on-demand without cluttering the 6-tab sidebar.
 */
export default function GlossaryModal({ isOpen, onClose }) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const entries = Object.entries(GLOSSARY).filter(([key, item]) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.term.toLowerCase().includes(q) ||
      item.plainName.toLowerCase().includes(q) ||
      item.meaning.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        height: '100%',
        background: 'var(--card-bg, #1e293b)',
        borderLeft: '1px solid var(--border-color, #334155)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #334155)',
          background: 'var(--bg-input, #0f172a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="#0F6E56" />
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main, #f8fafc)', margin: 0 }}>
              Plain-Language Financial Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color, #334155)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search terms, formulas, definitions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input, #0f172a)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '7px 10px 7px 32px',
                fontSize: '12px',
                outline: 'none'
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable Terms List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {entries.map(([key, item]) => (
              <div
                key={key}
                style={{
                  background: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '8px',
                  padding: '12px 14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
                    {item.plainName}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>
                    Formerly: {item.term}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-main, #e2e8f0)', margin: '0 0 6px 0', lineHeight: 1.45 }}>
                  {item.meaning}
                </p>
                {item.evaluation && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginBottom: '3px' }}>
                    <span style={{ color: '#10b981', fontWeight: 500 }}>Target: </span>{item.evaluation}
                  </div>
                )}
                {item.action && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 500 }}>Action: </span>{item.action}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
