import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { auth, db } from '../config/firebase-config';
import { AuthContext } from '../context/auth-context';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    currency: 'USD'
  });

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setGroupsLoading(false);
      return undefined;
    }

    setGroupsLoading(true);
    setGroupsError('');

    const groupsQuery = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      groupsQuery,
      (snapshot) => {
        const nextGroups = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

        setGroups(nextGroups);
        setGroupsLoading(false);
      },
      (error) => {
        console.error('Groups subscription error:', error);
        setGroupsError(error.message);
        setGroupsLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || !user || isCreatingGroup) {
      return;
    }

    setIsCreatingGroup(true);
    setGroupsError('');

    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroup.name.trim(),
        currency: newGroup.currency,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        memberIds: [user.uid],
        members: [
          {
            uid: user.uid,
            email: user.email || ''
          }
        ]
      });

      setNewGroup({ name: '', currency: 'USD' });
      setShowCreateGroup(false);
    } catch (error) {
      console.error('Create group error:', error);
      setGroupsError(error.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGroup(prev => ({
      ...prev,
      [name]: value
    }));
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

        {/* Groups List */}
        <section className="groups-section">
          <div className="groups-header">
            <h3>Your Groups</h3>
            <button
              className="add-group-btn"
              onClick={() => setShowCreateGroup(true)}
              title="Create new group"
            >
              +
            </button>
          </div>

          {groupsLoading ? (
            <p className="empty-state">Loading your groups...</p>
          ) : groupsError ? (
            <p className="error-state">{groupsError}</p>
          ) : groups.length === 0 ? (
            <p className="empty-state">No groups yet. Create or join one to get started!</p>
          ) : (
            <div className="groups-list">
              {groups.map(group => (
                <div key={group.id} className="group-item">
                  <div className="group-info">
                    <h4>{group.name}</h4>
                    <span className="group-currency">{group.currency}</span>
                  </div>
                  <div className="group-actions">
                    <button className="group-action-btn">View</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New Group</h3>
            <div className="modal-form">
              <div className="form-group">
                <label htmlFor="groupName">Group Name</label>
                <input
                  type="text"
                  id="groupName"
	                  name="name"
	                  value={newGroup.name}
	                  onChange={handleInputChange}
	                  placeholder="Enter group name"
	                  disabled={isCreatingGroup}
	                  autoFocus
	                />
              </div>
              <div className="form-group">
                <label htmlFor="currency">Currency</label>
                <select
	                  id="currency"
	                  name="currency"
	                  value={newGroup.currency}
	                  onChange={handleInputChange}
	                  disabled={isCreatingGroup}
	                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowCreateGroup(false)}
                disabled={isCreatingGroup}
              >
                Cancel
              </button>
              <button
                className="modal-btn create"
                onClick={handleCreateGroup}
                disabled={!newGroup.name.trim() || isCreatingGroup}
              >
                {isCreatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
