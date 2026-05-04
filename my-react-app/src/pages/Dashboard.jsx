import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config/firebase-config';
import { AuthContext } from '../context/auth-context';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [owedItems, setOwedItems] = useState([]);
  const [owedLoading, setOwedLoading] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    currency: 'USD'
  });

  const createGroupCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  };

  const displayName = userProfile?.displayName || user?.displayName || user?.email || 'User';

  const parseAmount = (value) => {
    const amount = Number(String(value || '').replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(amount) ? amount : 0;
  };

  const formatCurrency = (amount, currency = 'USD') => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);

  const getMemberProfile = async () => {
    if (!user) {
      return {
        uid: '',
        email: '',
        firstName: '',
        lastName: '',
        displayName: ''
      };
    }

    let profile = userProfile;

    if (!profile) {
      const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
      profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    }

    return {
      uid: user.uid,
      email: user.email || '',
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      displayName: profile?.displayName || user.displayName || user.email || '',
      paymentMethods: profile?.paymentMethods || {},
      preferredPaymentMethod: profile?.preferredPaymentMethod || 'venmo'
    };
  };

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
          .map((groupDoc) => {
            const groupData = groupDoc.data();

            if (!groupData.inviteCode) {
              updateDoc(doc(db, 'groups', groupDoc.id), {
                inviteCode: createGroupCode()
              }).catch((error) => {
                console.error('Invite code backfill error:', error);
              });
            }

            return { id: groupDoc.id, ...groupData };
          })
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

  useEffect(() => {
    if (!user || groups.length === 0) {
      setOwedItems([]);
      setOwedLoading(false);
      return;
    }

    let isActive = true;
    setOwedLoading(true);
    const currentUserId = user.uid;

    const getUserSplitPercent = (group) => {
      const memberIds = group.memberIds || [];
      const excludedMemberIds = group.splitSettings?.excludedMemberIds || [];

      if (excludedMemberIds.includes(currentUserId)) {
        return 0;
      }

      const savedPercent = Number(group.splitSettings?.percentages?.[currentUserId]);
      if (Number.isFinite(savedPercent)) {
        return savedPercent;
      }

      const includedMemberCount = memberIds.filter((memberId) => !excludedMemberIds.includes(memberId)).length;
      return includedMemberCount ? 100 / includedMemberCount : 0;
    };

    Promise.all(groups.map(async (group) => {
      const expensesSnapshot = await getDocs(collection(db, 'groups', group.id, 'expenses'));
      const total = expensesSnapshot.docs.reduce((sum, expenseDoc) => (
        sum + parseAmount(expenseDoc.data().price)
      ), 0);
      const percent = getUserSplitPercent(group);
      const owed = total * (percent / 100);

      return {
        id: group.id,
        name: group.name,
        currency: group.currency || 'USD',
        total,
        percent,
        owed
      };
    }))
      .then((items) => {
        if (!isActive) {
          return;
        }

        setOwedItems(items.filter((item) => item.total > 0 && item.owed > 0));
      })
      .catch((error) => {
        console.error('Owed summary error:', error);
        if (isActive) {
          setGroupsError(error.message);
        }
      })
      .finally(() => {
        if (isActive) {
          setOwedLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [groups, user]);

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
      const memberProfile = await getMemberProfile();

      await addDoc(collection(db, 'groups'), {
        name: newGroup.name.trim(),
        currency: newGroup.currency,
        inviteCode: createGroupCode(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        memberIds: [user.uid],
        members: [memberProfile]
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

  const handleJoinGroup = async (e) => {
    e.preventDefault();

    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode || !user || isJoiningGroup) {
      return;
    }

    setIsJoiningGroup(true);
    setGroupsError('');

    try {
      const joinQuery = query(
        collection(db, 'groups'),
        where('inviteCode', '==', normalizedCode)
      );
      const snapshot = await getDocs(joinQuery);

      if (snapshot.empty) {
        setGroupsError('No group found with that code.');
        return;
      }

      const groupDoc = snapshot.docs[0];
      const memberProfile = await getMemberProfile();

      await updateDoc(doc(db, 'groups', groupDoc.id), {
        memberIds: arrayUnion(user.uid),
        members: arrayUnion(memberProfile)
      });

      setJoinCode('');
      navigate(`/groups/${groupDoc.id}`);
    } catch (error) {
      console.error('Join group error:', error);
      setGroupsError(error.message);
    } finally {
      setIsJoiningGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete || isDeletingGroup) {
      return;
    }

    if (groupToDelete.createdBy !== user?.uid) {
      setGroupsError('Only the group administrator can delete this group.');
      setGroupToDelete(null);
      return;
    }

    setIsDeletingGroup(true);
    setGroupsError('');

    try {
      const expensesSnapshot = await getDocs(collection(db, 'groups', groupToDelete.id, 'expenses'));
      const batch = writeBatch(db);

      expensesSnapshot.docs.forEach((expenseDoc) => {
        batch.delete(expenseDoc.ref);
      });

      await batch.commit();
      await deleteDoc(doc(db, 'groups', groupToDelete.id));
      setGroupToDelete(null);
    } catch (error) {
      console.error('Delete group error:', error);
      setGroupsError(error.message);
    } finally {
      setIsDeletingGroup(false);
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
          <span className="user-email">{displayName}</span>
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

        <div className="dashboard-main-grid">
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

            <form className="join-group-form" onSubmit={handleJoinGroup}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter group code"
                disabled={isJoiningGroup}
              />
              <button type="submit" className="group-action-btn" disabled={!joinCode.trim() || isJoiningGroup}>
                {isJoiningGroup ? 'Joining...' : 'Join Group'}
              </button>
            </form>

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
                      <div className="group-meta">
                        <span className="group-currency">{group.currency}</span>
                        <span className="group-code">Code: {group.inviteCode || 'Missing'}</span>
                      </div>
                    </div>
                    <div className="group-actions">
                      <button className="group-action-btn" onClick={() => navigate(`/groups/${group.id}`)}>
                        View
                      </button>
                      {group.createdBy === user?.uid && (
                        <button className="group-action-btn danger" onClick={() => setGroupToDelete(group)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="groups-section">
            <div className="groups-header">
              <h3>What You Owe</h3>
            </div>

            {owedLoading ? (
              <p className="empty-state">Calculating balances...</p>
            ) : owedItems.length === 0 ? (
              <p className="empty-state">You do not owe anything yet.</p>
            ) : (
              <div className="groups-list">
                {owedItems.map((item) => (
                  <div key={item.id} className="owed-item">
                    <div>
                      <h4>{item.name}</h4>
                      <div className="group-meta">
                        <span className="group-code">{item.percent.toFixed(2)}% share</span>
                        <span className="group-code">Total: {formatCurrency(item.total, item.currency)}</span>
                      </div>
                    </div>
                    <strong>{formatCurrency(item.owed, item.currency)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
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

      {groupToDelete && (
        <div className="modal-overlay" onClick={() => setGroupToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Delete Group?</h3>
            <p className="modal-message">
              Are you sure you want to delete {groupToDelete.name}? This removes the group and its expenses.
            </p>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setGroupToDelete(null)}
                disabled={isDeletingGroup}
              >
                Cancel
              </button>
              <button
                className="modal-btn danger"
                onClick={handleDeleteGroup}
                disabled={isDeletingGroup}
              >
                {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
