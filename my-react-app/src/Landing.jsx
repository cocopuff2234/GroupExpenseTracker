import React from 'react';
import './Landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      {/* Header */}
      <header className="landing-header">
        <button
          className="auth-button sign-in"
          onClick={() => (window.location.href = '/signin')}
        >
          Sign In
        </button>
        <button
          className="auth-button sign-up"
          onClick={() => (window.location.href = '/signup')}
        >
          Sign Up
        </button>
      </header>

      {/* Title */}
      <div className="title-section">
        <h1 className="landing-title">SplitCheck</h1>
        <p className="landing-subtitle">
          Split expenses, track balances, and settle up with ease.
        </p>
      </div>

      {/* Cards */}
      <div className="cards-container">
        <div className="feature-card">
            <h2>Easy Group Management</h2>
            <p>Create or join groups and track shared expenses in one place.</p>
            </div>

            <div className="feature-card">
            <h2>Smart Expense Tracking</h2>
            <p>Automatically calculate who owes what with flexible split options.</p>
            </div>

            <div className="feature-card">
            <h2>Seamless Payments</h2>
            <p>Pay friends easily with Venmo, Zelle, and Cash App integrations.</p>
            </div>
      </div>
    </div>
  );
};

export default Landing;