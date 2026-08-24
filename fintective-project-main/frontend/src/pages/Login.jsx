import React, { useContext } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { Key, ArrowRight } from 'lucide-react';

const Login = () => {
  const { login } = useContext(FinanceContext);

  const handleLogin = (e) => {
    e.preventDefault();
    login('admin', { name: 'Admin Manager', email: 'admin@saarthi.co' });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <h1>Saarthi Finance</h1>
          <p className="login-subtitle">Central Operations & Auditing Portal Login</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {/* Administrator notice */}
          <div className="form-group select-profile-group">
            <div className="admin-login-notice">
              <Key size={24} className="notice-icon" />
              <div>
                <h4>Administrator Control Access</h4>
                <p>Logging in as full system auditor. Access central runway charts, budget variables, and sync logs.</p>
              </div>
            </div>
          </div>

          <button type="submit" className="login-submit-btn">
            <span>Enter Portal Dashboard</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="login-footer">
          <span>Protected by Saarthi Identity Engine â€¢ Version 2.0</span>
        </div>
      </div>
    </div>
  );
};

export default Login;

