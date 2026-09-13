import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  itemName = 'records',
  pageSizeOptions = null,
  onPageSizeChange = null,
  className = '',
  style = {}
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) {
    return (
      <div 
        className={`pagination-container ${className}`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted, #64748b)',
          background: 'transparent',
          ...style
        }}
      >
        <span>No {itemName} to display</span>
      </div>
    );
  }

  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div 
      className={`pagination-bar ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        gap: '12px',
        borderTop: '1px solid var(--border-color, #e2e8f0)',
        fontSize: '0.8125rem',
        color: 'var(--text-muted, #64748b)',
        background: 'transparent',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>
          Showing <strong style={{ color: 'var(--text-main, #0f172a)' }}>{startIdx}</strong> to{' '}
          <strong style={{ color: 'var(--text-main, #0f172a)' }}>{endIdx}</strong> of{' '}
          <strong style={{ color: 'var(--text-main, #0f172a)' }}>{totalItems}</strong> {itemName}
        </span>

        {pageSizeOptions && onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                if (onPageChange) onPageChange(1);
              }}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => onPageChange && onPageChange(1)}
            disabled={safePage === 1}
            title="First Page"
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              color: safePage === 1 ? '#94a3b8' : 'var(--text-main, #0f172a)',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: safePage === 1 ? 0.5 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            type="button"
            onClick={() => onPageChange && onPageChange(safePage - 1)}
            disabled={safePage === 1}
            title="Previous Page"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              color: safePage === 1 ? '#94a3b8' : 'var(--text-main, #0f172a)',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              opacity: safePage === 1 ? 0.5 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronLeft size={14} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Prev</span>
          </button>

          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '6px 6px',
                    color: 'var(--text-muted, #94a3b8)',
                    userSelect: 'none',
                    fontSize: '0.8125rem'
                  }}
                >
                  ...
                </span>
              );
            }

            const isActive = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange && onPageChange(p)}
                style={{
                  minWidth: '32px',
                  height: '32px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #0f6e56' : '1px solid var(--border-color, #e2e8f0)',
                  background: isActive ? '#0f6e56' : 'var(--bg-card, #ffffff)',
                  color: isActive ? '#ffffff' : 'var(--text-main, #0f172a)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isActive ? '0 2px 4px rgba(15, 110, 86, 0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange && onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            title="Next Page"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              color: safePage === totalPages ? '#94a3b8' : 'var(--text-main, #0f172a)',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              opacity: safePage === totalPages ? 0.5 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Next</span>
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => onPageChange && onPageChange(totalPages)}
            disabled={safePage === totalPages}
            title="Last Page"
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              color: safePage === totalPages ? '#94a3b8' : 'var(--text-main, #0f172a)',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: safePage === totalPages ? 0.5 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
