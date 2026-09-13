import re

with open('frontend/src/pages/RunwayRoiTracker.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make all replacements precisely

# 1. Chart
code = code.replace("<span style={{ color: '#c084fc' }}>══ Inflow (Simulated)</span>", "<span style={{ color: 'var(--color-purple)' }}>══ Inflow (Simulated)</span>")
code = code.replace("<span style={{ color: '#f472b6' }}>══ Outflow (Simulated)</span>", "<span style={{ color: 'var(--color-sim-pink)' }}>══ Outflow (Simulated)</span>")
code = code.replace('stopColor="#c084fc"', 'stopColor="var(--color-purple)"')
code = code.replace('stopColor="#f472b6"', 'stopColor="var(--color-sim-pink)"')
code = code.replace('stroke="rgba(255, 255, 255, 0.04)"', 'stroke="rgba(0, 0, 0, 0.06)"')
code = code.replace('stroke="rgba(255, 255, 255, 0.15)"', 'stroke="var(--border-color)"')
code = code.replace('fill="#64748b"', 'fill="var(--text-muted)"')
code = code.replace('stroke="#c084fc"', 'stroke="var(--color-purple)"')
code = code.replace('stroke="#f472b6"', 'stroke="var(--color-sim-pink)"')
code = code.replace('fill="#0b132b"', 'fill="#ffffff"')

# 2. Table card container
code = code.replace("style={{ border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(30, 41, 59, 0.15)', backdropFilter: 'blur(16px)' }}", "style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}")

# 3. Invoices Inputs
old_search_input = """                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',"""
new_search_input = """                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',"""
code = code.replace(old_search_input, new_search_input)

old_select_input = """                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',"""
new_select_input = """                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',"""
code = code.replace(old_select_input, new_select_input)

# 4. Invoices Table
code = code.replace('<td className="font-bold" style={{ color: \'#38bdf8\' }}>{inv.billNumber}</td>', '<td className="font-bold" style={{ color: \'var(--color-link)\' }}>{inv.billNumber}</td>')
code = code.replace('<td style={{ color: \'#94a3b8\' }}>{inv.billDate}</td>', '<td style={{ color: \'var(--text-muted)\' }}>{inv.billDate}</td>')
code = code.replace("style={{ cursor: 'pointer', color: '#38bdf8', textDecoration: 'underline' }}", "style={{ cursor: 'pointer', color: 'var(--color-link)', textDecoration: 'underline' }}")
code = code.replace('<td className="font-bold text-right" style={{ color: \'#38bdf8\' }}>{formatCurrency(inv.ourShare)}</td>', '<td className="font-bold text-right" style={{ color: \'var(--color-purple)\' }}>{formatCurrency(inv.ourShare)}</td>')
code = code.replace("borderTop: '1px solid rgba(255, 255, 255, 0.05)'", "borderTop: '1px solid var(--border-color)'")
code = code.replace("<span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>", "<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>")

# 5. Leaderboard
code = code.replace("onMouseOver={(e) => e.target.style.color = '#7dd3fc'}", "onMouseOver={(e) => e.target.style.color = '#1e40af'}")
code = code.replace("onMouseOut={(e) => e.target.style.color = '#38bdf8'}", "onMouseOut={(e) => e.target.style.color = 'var(--color-link)'}")
code = code.replace("style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}", "style={{ backgroundColor: 'rgba(29,78,216,0.08)', color: 'var(--color-link)', border: '1px solid rgba(29,78,216,0.2)' }}")
code = code.replace('<td className="font-bold text-right" style={{ color: \'#38bdf8\' }}>{formatCurrency(agent.net_revenue)}</td>', '<td className="font-bold text-right" style={{ color: \'var(--color-purple)\' }}>{formatCurrency(agent.net_revenue)}</td>')

# 6. Accounts
code = code.replace("style={{ color: account.type === 'Franchise Hub' ? 'var(--accent-teal)' : '#8b5cf6', background: 'rgba(255,255,255,0.03)' }}", "style={{ color: account.type === 'Franchise Hub' ? 'var(--accent-teal)' : 'var(--color-purple)', background: 'var(--bg-main)' }}")
code = code.replace("style={{ color: account.margin >= 50 ? 'var(--color-income)' : (account.margin >= 20 ? '#fbbf24' : '#ef4444') }}", "style={{ color: account.margin >= 50 ? 'var(--color-income)' : (account.margin >= 20 ? 'var(--color-pending)' : 'var(--color-expense)') }}")

# 7. Simulator Controls & Report
code = code.replace("<h5 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '8px' }}>Simulation Controls</h5>", "<h5 style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>Simulation Controls</h5>")
code = code.replace("style={{ color: hiringSalary > 0 ? '#ef4444' : '#cbd5e1', fontWeight: 'bold' }}", "style={{ color: hiringSalary > 0 ? 'var(--color-expense)' : 'var(--text-muted)', fontWeight: 'bold' }}")

old_reset_btn = """                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      color: '#cbd5e1',"""
new_reset_btn = """                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',"""
code = code.replace(old_reset_btn, new_reset_btn)

code = code.replace("onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}", "onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}")
code = code.replace("onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}", "onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}")

code = code.replace('<div className="simulator-panel" style={{ background: \'rgba(15, 23, 42, 0.4)\' }}>', '<div className="simulator-panel" style={{ background: \'var(--bg-card)\', border: \'1px solid var(--border-color)\' }}>')
code = code.replace("<h5 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '8px' }}>Simulation Impact Report</h5>", "<h5 style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>Simulation Impact Report</h5>")

old_sim_card1 = """<div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Simulated Monthly Inflow</span>"""
new_sim_card1 = """<div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Simulated Monthly Inflow</span>"""
code = code.replace(old_sim_card1, new_sim_card1)

old_sim_card2 = """<div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Simulated Monthly Outflow</span>"""
new_sim_card2 = """<div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Simulated Monthly Outflow</span>"""
code = code.replace(old_sim_card2, new_sim_card2)

code = code.replace("background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)'", "background: 'var(--bg-main)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)'")
code = code.replace("<span style={{ color: '#cbd5e1' }}>Simulated Net Flow:</span>", "<span style={{ color: 'var(--text-muted)' }}>Simulated Net Flow:</span>")
code = code.replace("<span style={{ color: '#cbd5e1' }}>Simulated Cash Runway:</span>", "<span style={{ color: 'var(--text-muted)' }}>Simulated Cash Runway:</span>")

# 8. Scale simulator
code = code.replace("<span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>", "<span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>")
code = code.replace('<span className="font-bold" style={{ fontSize: \'0.9rem\', color: \'#94a3b8\' }}>Target Scale:</span>', '<span className="font-bold" style={{ fontSize: \'0.9rem\', color: \'var(--text-main)\' }}>Target Scale:</span>')

old_scale_btn = """                      border: '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: scaleMultiplier === mult ? 'var(--accent-teal, #2dd4bf)' : 'rgba(255,255,255,0.04)',
                      color: scaleMultiplier === mult ? '#0b132b' : '#cbd5e1',"""
new_scale_btn = """                      border: scaleMultiplier === mult ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                      backgroundColor: scaleMultiplier === mult ? 'var(--accent-teal)' : 'var(--bg-card)',
                      color: scaleMultiplier === mult ? '#ffffff' : 'var(--text-main)',"""
code = code.replace(old_scale_btn, new_scale_btn)

old_scale_cards = """                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Projected Monthly Revenue</span>"""
new_scale_cards = """                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Projected Monthly Revenue</span>"""
code = code.replace(old_scale_cards, new_scale_cards)

old_scale_cards2 = """                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Projected Monthly Expenses</span>"""
new_scale_cards2 = """                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Projected Monthly Expenses</span>"""
code = code.replace(old_scale_cards2, new_scale_cards2)

old_scale_cards3 = """                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Projected Net Profit</span>"""
new_scale_cards3 = """                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Projected Net Profit</span>"""
code = code.replace(old_scale_cards3, new_scale_cards3)

old_scale_cards4 = """                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Operating Profit Margin</span>"""
new_scale_cards4 = """                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Operating Profit Margin</span>"""
code = code.replace(old_scale_cards4, new_scale_cards4)

code = code.replace("<span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#cbd5e1' }}>{currentScale.margin.toFixed(1)}%</span>", "<span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{currentScale.margin.toFixed(1)}%</span>")

code = code.replace("<h5 style={{ marginBottom: '12px', color: '#cbd5e1' }}>Side-by-Side Scaling Comparative Reference Table</h5>", "<h5 style={{ marginBottom: '12px', color: 'var(--text-main)' }}>Side-by-Side Scaling Comparative Reference Table</h5>")

old_ref_rows = """                    {[
                      { mult: '1x Scale (Baseline)', calc: scale1x, color: '#f8fafc' },
                      { mult: '2x Scale', calc: scale2x, color: '#cbd5e1' },
                      { mult: '3x Scale', calc: scale3x, color: '#94a3b8' },
                      { mult: '5x Scale (Hyper-Scale)', calc: scale5x, color: 'var(--accent-teal)' }
                    ]}"""
new_ref_rows = """                    {[
                      { mult: '1x Scale (Baseline)', calc: scale1x, color: 'var(--text-main)' },
                      { mult: '2x Scale', calc: scale2x, color: 'var(--accent-teal)' },
                      { mult: '3x Scale', calc: scale3x, color: 'var(--color-purple)' },
                      { mult: '5x Scale (Hyper-Scale)', calc: scale5x, color: 'var(--color-income)' }
                    ]}"""
code = code.replace(old_ref_rows, new_ref_rows)

code = code.replace("backgroundColor: scaleMultiplier === (idx === 3 ? 5 : idx + 1) ? 'rgba(45,212,191,0.04)' : 'transparent'", "backgroundColor: scaleMultiplier === (idx === 3 ? 5 : idx + 1) ? 'rgba(15,110,86,0.08)' : 'transparent'")

# 9. MoM Pivot
code = code.replace("let growthColor = '#94a3b8';", "let growthColor = 'var(--text-muted)';")
code = code.replace("growthColor = '#94a3b8';", "growthColor = 'var(--text-muted)';")
code = code.replace('<td className="text-right font-bold" style={{ color: cat.type === \'income\' ? \'var(--accent-teal)\' : \'#f8fafc\' }}>', '<td className="text-right font-bold" style={{ color: cat.type === \'income\' ? \'var(--accent-teal)\' : \'var(--text-main)\' }}>')

# 10. Recently Archived
old_archived = """            {recentlyArchived.length > 0 && (
              <div className="dashboard-card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', padding: '16px' }}>
                <h6 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 'bold' }}>
                  <RotateCcw size={14} />
                  Recently Archived Transactions (Current Browser Session)
                </h6>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {recentlyArchived.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,23,42,0.6)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <strong>{item.category}</strong> - {formatCurrency(item.amount)}
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>Deleted at {item.archivedAt}</span>
                      </div>
                      <button 
                        onClick={() => handleUndoSoftDelete(item.id)}
                        style={{
                          border: 'none',
                          background: 'rgba(16,185,129,0.1)',
                          color: '#10b981',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}"""

new_archived = """            {recentlyArchived.length > 0 && (
              <div className="dashboard-card" style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', padding: '16px' }}>
                <h6 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 'bold' }}>
                  <RotateCcw size={14} />
                  Recently Archived Transactions (Current Browser Session)
                </h6>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {recentlyArchived.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                      <div>
                        <strong>{item.category}</strong> - {formatCurrency(item.amount)}
                        <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Deleted at {item.archivedAt}</span>
                      </div>
                      <button 
                        onClick={() => handleUndoSoftDelete(item.id)}
                        style={{
                          border: 'none',
                          background: 'rgba(15,110,86,0.1)',
                          color: 'var(--color-income)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}"""
code = code.replace(old_archived, new_archived)

# 11. Trust Drawer
old_drawer = """      {selectedRecruiter && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          width: '500px',
          height: '100vh',
          backgroundColor: 'rgba(11, 19, 43, 0.95)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          zIndex: 1000,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          color: '#cbd5e1',
          transition: 'all 0.3s ease-in-out'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Recruiter Trust Layer</span>
              <h4 style={{ color: '#fff', margin: '4px 0 0 0' }}>{selectedRecruiter}</h4>
            </div>
            <button 
              onClick={() => setSelectedRecruiter(null)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>

          {/* Placements detailed table */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
            <h5 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '12px' }}>Audit Invoices Log</h5>
            {recruiterDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <Activity className="animate-spin animate-spin-slow" style={{ margin: '0 auto 12px auto' }} />
                <span>Fetching underlying ledger entries from MySQL...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recruiterDetails.map((row, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
                      <span>{row.company_name}</span>
                      <span style={{ color: '#10b981' }}>{formatCurrency(row.gross_revenue)}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      Invoice: {row.invoice_no} | Date: {row.bill_date}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#38bdf8', marginTop: '4px' }}>
                      <span>Recruiter Net Share: {formatCurrency(row.net_revenue)}</span>
                      <span>Franchise: {row.franchise_name || 'None'}</span>
                    </div>
                  </div>
                ))}
                {recruiterDetails.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No invoice attributions found for this agent.</div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => {
                const headers = 'Company Name,Invoice Number,Bill Date,Gross Revenue (INR),Net Share (INR),Franchisee Name\\n';
                const rows = recruiterDetails.map(r => `"${r.company_name}","${r.invoice_no}","${r.bill_date}",${r.gross_revenue},${r.net_revenue},"${r.franchise_name || 'None'}"`).join('\\n');
                const blob = new Blob([headers + rows], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('href', url);
                a.setAttribute('download', `${selectedRecruiter.replace(/\\s+/g, '_')}_audit_log.csv`);
                a.click();
              }}
              style={{
                flex: 1,
                backgroundColor: '#38bdf8',
                color: '#0b132b',
                fontWeight: 'bold',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Download size={16} />
              Download CSV Audit Log
            </button>
            <button 
              onClick={() => setSelectedRecruiter(null)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}"""

new_drawer = """      {selectedRecruiter && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          width: '500px',
          height: '100vh',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
          zIndex: 1000,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--text-main)',
          transition: 'all 0.3s ease-in-out'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-link)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Recruiter Trust Layer</span>
              <h4 style={{ color: 'var(--text-main)', margin: '4px 0 0 0' }}>{selectedRecruiter}</h4>
            </div>
            <button 
              onClick={() => setSelectedRecruiter(null)}
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>

          {/* Placements detailed table */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
            <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Audit Invoices Log</h5>
            {recruiterDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Activity className="animate-spin animate-spin-slow" style={{ margin: '0 auto 12px auto' }} />
                <span>Fetching underlying ledger entries from MySQL...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recruiterDetails.map((row, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '4px' }}>
                      <span>{row.company_name}</span>
                      <span style={{ color: 'var(--color-income)' }}>{formatCurrency(row.gross_revenue)}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Invoice: {row.invoice_no} | Date: {row.bill_date}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-link)', marginTop: '4px' }}>
                      <span>Recruiter Net Share: {formatCurrency(row.net_revenue)}</span>
                      <span>Franchise: {row.franchise_name || 'None'}</span>
                    </div>
                  </div>
                ))}
                {recruiterDetails.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No invoice attributions found for this agent.</div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => {
                const headers = 'Company Name,Invoice Number,Bill Date,Gross Revenue (INR),Net Share (INR),Franchisee Name\\n';
                const rows = recruiterDetails.map(r => `"${r.company_name}","${r.invoice_no}","${r.bill_date}",${r.gross_revenue},${r.net_revenue},"${r.franchise_name || 'None'}"`).join('\\n');
                const blob = new Blob([headers + rows], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('href', url);
                a.setAttribute('download', `${selectedRecruiter.replace(/\\s+/g, '_')}_audit_log.csv`);
                a.click();
              }}
              style={{
                flex: 1,
                backgroundColor: 'var(--accent-teal)',
                color: '#ffffff',
                fontWeight: 'bold',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Download size={16} />
              Download CSV Audit Log
            </button>
            <button 
              onClick={() => setSelectedRecruiter(null)}
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}"""
code = code.replace(old_drawer, new_drawer)

# 12. Toast
old_toast = """      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          background: 'rgba(15, 23, 42, 0.9)',
          color: '#cbd5e1',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 1050
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 style={{ color: '#10b981' }} size={20} />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{toastMessage}</span>
          </div>
          {toastUndoId && (
            <button 
              onClick={() => handleUndoSoftDelete(toastUndoId)}
              style={{
                backgroundColor: 'rgba(16,185,129,0.1)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Undo (Soft Restore)
            </button>
          )}
        </div>
      )}"""

new_toast = """      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          background: 'var(--text-main, #1b2321)',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          borderRadius: '8px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 1050
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 style={{ color: '#10b981' }} size={20} />
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{toastMessage}</span>
          </div>
          {toastUndoId && (
            <button 
              onClick={() => handleUndoSoftDelete(toastUndoId)}
              style={{
                backgroundColor: 'rgba(16,185,129,0.2)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Undo (Soft Restore)
            </button>
          )}
        </div>
      )}"""
code = code.replace(old_toast, new_toast)

with open('frontend/src/pages/RunwayRoiTracker.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated RunwayRoiTracker.jsx successfully!')
