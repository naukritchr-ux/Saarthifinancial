import React, { useContext } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { ProgressBarList } from '../components/CustomCharts';
import { TrendingDown, ArrowDownRight, DollarSign } from 'lucide-react';

const CashOutflow = () => {
  const { transactions, selectedMonth } = useContext(FinanceContext);

  // Filter current expenses
  const currentExpenses = transactions.filter(tx => {
    if (tx.type !== 'expense') return false;
    if (selectedMonth === 'All Months') return true;

    const date = new Date(tx.date);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    return txMonthYear === selectedMonth;
  });

  const totalExpense = currentExpenses.reduce((sum, tx) => sum + tx.amount, 0);

  // Direct cost = expense tied to a specific franchisee or BD agent (wouldn't exist without that deal/hub)
  // Overhead = expense that exists regardless of any single deal (rent, subscriptions, fixed salaries, etc.)
  const directCostTxs = currentExpenses.filter(tx => tx.franchiseeId || tx.bdAgentId);
  const overheadTxs = currentExpenses.filter(tx => !tx.franchiseeId && !tx.bdAgentId);
  const directCost = directCostTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const overheadCost = overheadTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const overheadPct = totalExpense > 0 ? (overheadCost / totalExpense) * 100 : 0;

  // Group by category
  const expenseCategories = {};
  currentExpenses.forEach(tx => {
    const cat = tx.category || 'Other';
    expenseCategories[cat] = (expenseCategories[cat] || 0) + tx.amount;
  });

  const categoryColors = {
    'Salaries': '#6366f1',
    'BD commissions': '#3b82f6',
    'Marketing': '#f59e0b',
    'Office & infra': '#ef4444',
    'Portal subscriptions': '#10b981',
    'Other': '#94a3b8'
  };

  const chartData = Object.keys(expenseCategories).map(cat => ({
    label: cat,
    value: expenseCategories[cat],
    color: categoryColors[cat] || '#8b5cf6'
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="cash-outflow-page animate-fade-in">
      
      {/* Top Banner */}
      <section className="kpi-grid">
        <div className="kpi-card card-red">
          <div className="kpi-header">
            <span className="kpi-title">Total Outflow â€¢ {selectedMonth}</span>
            <span className="kpi-icon"><TrendingDown size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatCurrency(totalExpense)}</h2>
          <div className="kpi-change down">
            <ArrowDownRight size={14} />
            <span>Operational overhead and payouts logged</span>
          </div>
        </div>

        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Direct Cost</span>
            <span className="kpi-icon"><DollarSign size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatCurrency(directCost)}</h2>
          <div className="kpi-change down">
            <span>Tied to a specific franchisee/agent deal</span>
          </div>
        </div>

        <div className="kpi-card card-purple">
          <div className="kpi-header">
            <span className="kpi-title">Overhead</span>
            <span className="kpi-icon"><TrendingDown size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatCurrency(overheadCost)}</h2>
          <div className="kpi-change down">
            <span>{overheadPct.toFixed(0)}% of total outflow â€” fixed costs</span>
          </div>
        </div>
      </section>

      <div className="charts-grid-row">
        {/* Category breakdown visual representation */}
        <div className="dashboard-card flex-1">
          <h3 className="card-title">Outflow Allocation</h3>
          <div className="card-content">
            {chartData.length === 0 ? (
              <p className="no-data-text">No expenses logged for this period.</p>
            ) : (
              <ProgressBarList data={chartData} />
            )}
          </div>
        </div>

        {/* Expense items ledger */}
        <div className="dashboard-card flex-1">
          <h3 className="card-title">Expense Log Details</h3>
          <div className="card-content">
            {currentExpenses.length === 0 ? (
              <p className="no-data-text">No expense entries found.</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table small-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExpenses.map(tx => (
                      <tr key={tx.id}>
                        <td className="font-bold">{tx.title}</td>
                        <td>{tx.category}</td>
                        <td>{formatDate(tx.date)}</td>
                        <td className="font-bold text-red text-right">
                          {formatCurrency(tx.amount, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default CashOutflow;
