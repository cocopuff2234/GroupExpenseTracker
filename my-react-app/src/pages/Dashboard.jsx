import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase-config';
import { AuthContext } from '../context/AuthContext';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/landing');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">SplitCheck</h1>
        <div className="header-actions">
          <span className="user-email">{user?.email}</span>
          <button className="icon-button" onClick={handleSettings}>
            ⚙️ Settings
          </button>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-content">
        <section className="welcome-section">
          <h2>Welcome to SplitCheck!</h2>
          <p>Manage your groups and expenses here.</p>
        </section>

        {/* Quick Actions */}
        <section className="quick-actions">
          <div className="action-card">
            <h3>📊 My Groups</h3>
            <p>View and manage your expense groups.</p>
            <button className="action-button">View Groups</button>
          </div>

          <div className="action-card">
            <h3>➕ Add Expense</h3>
            <p>Record a new shared expense.</p>
            <button className="action-button">Add Expense</button>
          </div>

          <div className="action-card">
            <h3>💰 Settle Up</h3>
            <p>Pay back your friends or collect payments.</p>
            <button className="action-button">Settle</button>
          </div>
        </section>

        {/* Placeholder for Groups List */}
        <section className="groups-section">
          <h3>Your Groups</h3>
          <p className="empty-state">No groups yet. Create or join one to get started!</p>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
