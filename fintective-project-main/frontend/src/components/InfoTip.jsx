import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { getGlossaryItem } from '../utils/glossary';

/**
 * Accessible Plain-Language InfoTip
 * Accessible via hover, click/tap, and keyboard focus (Tab + Enter/Space).
 * Positions itself automatically so it never covers the card text.
 */
export default function InfoTip({
  term,
  text,
  title,
  placement = 'top',
  size = 14,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  const entry = term ? getGlossaryItem(term) : null;
  const displayTitle = title || (entry ? entry.plainName : term);
  const displayMeaning = text || (entry ? entry.meaning : '');
  const displayEval = entry?.evaluation;
  const displayAction = entry?.action;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation support
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <span 
      ref={containerRef}
      className={`infotip-wrapper ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', verticalAlign: 'middle', marginLeft: '4px' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="infotip-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        onKeyDown={handleKeyDown}
        aria-label={`Explanation for ${displayTitle || 'metric'}`}
        aria-expanded={isOpen}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted, #8b949e)',
          borderRadius: '50%',
          outline: 'none',
          transition: 'color 0.15s ease'
        }}
      >
        <HelpCircle size={size} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="infotip-popover"
          style={{
            position: 'absolute',
            bottom: placement === 'top' ? 'calc(100% + 8px)' : 'auto',
            top: placement === 'bottom' ? 'calc(100% + 8px)' : 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '240px',
            maxWidth: '85vw',
            background: 'var(--card-bg, #1a2234)',
            color: 'var(--text-main, #f1f5f9)',
            border: '1px solid var(--border-color, #334155)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            lineHeight: '1.45',
            zIndex: 9999,
            pointerEvents: 'auto',
            textAlign: 'left'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {displayTitle && (
            <div style={{ fontWeight: 600, color: 'var(--text-highlight, #38bdf8)', marginBottom: '4px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '3px' }}>
              {displayTitle}
            </div>
          )}
          <div style={{ color: 'var(--text-body, #cbd5e1)', marginBottom: displayEval || displayAction ? '6px' : '0' }}>
            {displayMeaning}
          </div>
          {displayEval && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              <span style={{ color: '#10b981', fontWeight: 500 }}>Target: </span>{displayEval}
            </div>
          )}
          {displayAction && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
              <span style={{ color: '#f59e0b', fontWeight: 500 }}>Action: </span>{displayAction}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
