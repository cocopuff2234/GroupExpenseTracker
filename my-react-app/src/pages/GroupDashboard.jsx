import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../config/firebase-config';
import { AuthContext } from '../context/auth-context';
import '../styles/Dashboard.css';

const initialExpense = {
  date: '',
  price: '',
  name: '',
  imageName: '',
  imageUrl: ''
};

const GroupDashboard = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [error, setError] = useState('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseMode, setExpenseMode] = useState('manual');
  const [newExpense, setNewExpense] = useState(initialExpense);
  const [expenseImageFile, setExpenseImageFile] = useState(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const [splitPercentages, setSplitPercentages] = useState({});
  const [excludedMemberIds, setExcludedMemberIds] = useState([]);
  const [isSavingSplit, setIsSavingSplit] = useState(false);

  const members = group?.members || [];
  const includedMembers = members.filter((member) => !excludedMemberIds.includes(member.uid));
  const defaultSplitPercent = includedMembers.length ? 100 / includedMembers.length : 0;

  const expenseTotal = expenses.reduce((total, expense) => {
    const amount = Number(String(expense.price || '').replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);

  const formattedExpenseTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: group?.currency || 'USD'
  }).format(expenseTotal);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: group?.currency || 'USD'
  }).format(amount);

  const getMemberSplitPercent = (member) => {
    if (excludedMemberIds.includes(member.uid)) {
      return 0;
    }

    const savedPercent = Number(splitPercentages[member.uid]);
    return Number.isFinite(savedPercent) ? savedPercent : defaultSplitPercent;
  };

  const splitRows = members.map((member) => {
    const percent = getMemberSplitPercent(member);
    return {
      ...member,
      percent,
      amount: expenseTotal * (percent / 100),
      isExcluded: excludedMemberIds.includes(member.uid)
    };
  });

  const splitPercentageTotal = splitRows.reduce((total, member) => total + member.percent, 0);

  useEffect(() => {
    if (!groupId) {
      navigate('/dashboard');
      return undefined;
    }

    setLoading(true);
    setError('');

    const unsubscribe = onSnapshot(
      doc(db, 'groups', groupId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError('This group does not exist or you no longer have access.');
          setGroup(null);
        } else {
          setGroup({ id: snapshot.id, ...snapshot.data() });
        }
        setLoading(false);
      },
      (error) => {
        console.error('Group subscription error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [groupId, navigate]);

  useEffect(() => {
    if (!groupId) {
      return undefined;
    }

    setExpenseLoading(true);

    const expensesQuery = query(
      collection(db, 'groups', groupId, 'expenses'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      expensesQuery,
      (snapshot) => {
        setExpenses(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setExpenseLoading(false);
      },
      (error) => {
        console.error('Expenses subscription error:', error);
        setError(error.message);
        setExpenseLoading(false);
      }
    );

    return unsubscribe;
  }, [groupId]);

  useEffect(() => {
    if (!group) {
      return;
    }

    setSplitPercentages(group.splitSettings?.percentages || {});
    setExcludedMemberIds(group.splitSettings?.excludedMemberIds || []);
  }, [group]);

  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setNewExpense((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExpenseImage = (e) => {
    const file = e.target.files?.[0];
    setExpenseImageFile(file || null);
    setNewExpense((prev) => ({
      ...prev,
      imageName: file?.name || ''
    }));
  };

  const handleAddExpense = async () => {
    if (!newExpense.date.trim() || !newExpense.price.trim() || !newExpense.name.trim() || isSavingExpense) {
      return;
    }

    setIsSavingExpense(true);
    setError('');

    try {
      let imageUrl = '';

      if (expenseMode === 'image' && expenseImageFile) {
        const imagePath = `receipts/${groupId}/${Date.now()}-${expenseImageFile.name}`;
        const imageRef = ref(storage, imagePath);
        await uploadBytes(imageRef, expenseImageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, 'groups', groupId, 'expenses'), {
        date: newExpense.date.trim(),
        price: newExpense.price.trim(),
        name: newExpense.name.trim(),
        imageName: newExpense.imageName,
        imageUrl,
        entryType: expenseMode,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || ''
      });

      setNewExpense(initialExpense);
      setExpenseImageFile(null);
      setExpenseMode('manual');
      setShowExpenseModal(false);
    } catch (error) {
      console.error('Add expense error:', error);
      setError(error.message);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleSplitPercentChange = (memberId, value) => {
    setSplitPercentages((prev) => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleExcludeMember = (memberId) => {
    setExcludedMemberIds((prev) => (
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    ));
  };

  const handleEvenSplit = () => {
    const nextIncludedMembers = members.filter((member) => !excludedMemberIds.includes(member.uid));
    const nextPercent = nextIncludedMembers.length ? 100 / nextIncludedMembers.length : 0;
    const nextPercentages = {};

    members.forEach((member) => {
      nextPercentages[member.uid] = excludedMemberIds.includes(member.uid) ? 0 : Number(nextPercent.toFixed(2));
    });

    setSplitPercentages(nextPercentages);
  };

  const handleSaveSplitSettings = async () => {
    if (!groupId || isSavingSplit) {
      return;
    }

    setIsSavingSplit(true);
    setError('');

    try {
      const nextPercentages = {};

      members.forEach((member) => {
        const percent = excludedMemberIds.includes(member.uid)
          ? 0
          : Number(splitPercentages[member.uid] ?? defaultSplitPercent);
        nextPercentages[member.uid] = Number.isFinite(percent) ? percent : 0;
      });

      await updateDoc(doc(db, 'groups', groupId), {
        splitSettings: {
          percentages: nextPercentages,
          excludedMemberIds,
          updatedAt: serverTimestamp()
        }
      });
    } catch (error) {
      console.error('Save split settings error:', error);
      setError(error.message);
    } finally {
      setIsSavingSplit(false);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Group Dashboard</h1>
        <div className="header-actions">
          <Link className="text-link" to="/dashboard">Back to Dashboard</Link>
        </div>
      </header>

      <div className="dashboard-content">
        {loading ? (
          <section className="groups-section">
            <p className="empty-state">Loading group...</p>
          </section>
        ) : error ? (
          <section className="groups-section">
            <p className="error-state">{error}</p>
          </section>
        ) : (
          <>
            <section className="welcome-section group-dashboard-hero">
              <div>
                <h2>{group.name}</h2>
                <p>{group.currency} group</p>
              </div>
              <div className="invite-code-panel">
                <span>Group Code</span>
                <strong>{group.inviteCode || 'Missing'}</strong>
              </div>
            </section>

            <section className="groups-section">
              <div className="group-tabs" role="tablist" aria-label="Group dashboard sections">
                <button
                  className={activeTab === 'expenses' ? 'group-tab active' : 'group-tab'}
                  onClick={() => setActiveTab('expenses')}
                  type="button"
                >
                  Expenses
                </button>
                <button
                  className={activeTab === 'members' ? 'group-tab active' : 'group-tab'}
                  onClick={() => setActiveTab('members')}
                  type="button"
                >
                  Members
                </button>
                <button
                  className={activeTab === 'split' ? 'group-tab active' : 'group-tab'}
                  onClick={() => setActiveTab('split')}
                  type="button"
                >
                  Split Bill
                </button>
              </div>

              {activeTab === 'expenses' ? (
                <>
                  <div className="groups-header">
                    <h3>Expenses</h3>
                    <button
                      className="add-group-btn"
                      onClick={() => setShowExpenseModal(true)}
                      title="Add expense"
                    >
                      +
                    </button>
                  </div>

                  {expenseLoading ? (
                    <p className="empty-state">Loading expenses...</p>
                  ) : expenses.length === 0 ? (
                    <p className="empty-state">No expenses yet.</p>
                  ) : (
                    <div className="groups-list">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="group-item">
                          <div className="group-info">
                            <h4>{expense.name || expense.location}</h4>
                            <div className="group-meta">
                              <span className="group-currency">{expense.price}</span>
                              <span className="group-code">{expense.date}</span>
                              <span className="group-code">By {expense.createdByEmail || 'Unknown user'}</span>
                              {expense.imageName && <span className="group-code">{expense.imageName}</span>}
                            </div>
                            {expense.imageUrl && (
                              <a className="receipt-link" href={expense.imageUrl} target="_blank" rel="noreferrer">
                                View receipt image
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="expense-total-row">
                        <span>Total Expenses</span>
                        <strong>{formattedExpenseTotal}</strong>
                      </div>
                    </div>
                  )}
                </>
              ) : activeTab === 'members' ? (
                <>
                  <div className="groups-header">
                    <h3>Members</h3>
                    <span className="member-count">{members.length} joined</span>
                  </div>

                  {members.length === 0 ? (
                    <p className="empty-state">No members yet.</p>
                  ) : (
                    <div className="groups-list">
                      {members.map((member) => (
                        <div key={member.uid || member.email} className="member-item">
                          <div className="member-avatar">
                            {(member.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="group-info">
                            <h4>{member.email || 'Unknown user'}</h4>
                            <div className="group-meta">
                              {member.uid === group.createdBy && <span className="group-code">Creator</span>}
                              {member.uid === user?.uid && <span className="group-code">You</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="groups-header">
                    <h3>Split Bill</h3>
                    <button
                      className="group-action-btn"
                      type="button"
                      onClick={handleEvenSplit}
                    >
                      Even Split
                    </button>
                  </div>

                  <div className="split-summary">
                    <div>
                      <span>Total Expenses</span>
                      <strong>{formattedExpenseTotal}</strong>
                    </div>
                    <div>
                      <span>Assigned</span>
                      <strong>{splitPercentageTotal.toFixed(2)}%</strong>
                    </div>
                  </div>

                  {Math.abs(splitPercentageTotal - 100) > 0.01 && (
                    <p className="split-warning">
                      Percentages should add up to 100% for the whole bill to be assigned.
                    </p>
                  )}

                  <div className="groups-list">
                    {splitRows.map((member) => (
                      <div key={member.uid || member.email} className="split-member-row">
                        <div className="split-member-main">
                          <div className="member-avatar">
                            {(member.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="group-info">
                            <h4>{member.email || 'Unknown user'}</h4>
                            <div className="group-meta">
                              {member.uid === user?.uid && <span className="group-code">You</span>}
                              {member.isExcluded && <span className="group-code">Excluded</span>}
                            </div>
                          </div>
                        </div>
                        <div className="split-controls">
                          <label>
                            <span>Paying?</span>
                            <input
                              type="checkbox"
                              checked={!member.isExcluded}
                              onChange={() => handleExcludeMember(member.uid)}
                            />
                          </label>
                          <label>
                            <span>Percent</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={member.percent}
                              disabled={member.isExcluded}
                              onChange={(e) => handleSplitPercentChange(member.uid, e.target.value)}
                            />
                          </label>
                          <div className="split-owed">
                            <span>Owes</span>
                            <strong>{formatCurrency(member.amount)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="expense-total-row">
                      <span>Total Owed</span>
                      <strong>{formatCurrency(splitRows.reduce((total, member) => total + member.amount, 0))}</strong>
                    </div>
                  </div>

                  <div className="split-actions">
                    <button
                      className="modal-btn create"
                      type="button"
                      onClick={handleSaveSplitSettings}
                      disabled={isSavingSplit}
                    >
                      {isSavingSplit ? 'Saving...' : 'Save Split Settings'}
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Add Expense</h3>
            <div className="expense-mode-toggle">
              <button
                className={expenseMode === 'manual' ? 'mode-button active' : 'mode-button'}
                onClick={() => setExpenseMode('manual')}
                type="button"
              >
                Manual
              </button>
              <button
                className={expenseMode === 'image' ? 'mode-button active' : 'mode-button'}
                onClick={() => setExpenseMode('image')}
                type="button"
              >
                Image
              </button>
            </div>
            <div className="modal-form">
              {expenseMode === 'image' && (
                <div className="form-group">
                  <label htmlFor="expenseImage">Expense Image</label>
                  <input
                    type="file"
                    id="expenseImage"
                    accept="image/*"
                    onChange={handleExpenseImage}
                    disabled={isSavingExpense}
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="expenseDate">Date</label>
                <input
                  type="text"
                  id="expenseDate"
                  name="date"
                  value={newExpense.date}
                  onChange={handleExpenseChange}
                  placeholder="May 3, 2026"
                  disabled={isSavingExpense}
                />
              </div>
              <div className="form-group">
                <label htmlFor="expensePrice">Price</label>
                <input
                  type="text"
                  id="expensePrice"
                  name="price"
                  value={newExpense.price}
                  onChange={handleExpenseChange}
                  placeholder="$24.50"
                  disabled={isSavingExpense}
                />
              </div>
              <div className="form-group">
                <label htmlFor="expenseName">Expense Name</label>
                <input
                  type="text"
                  id="expenseName"
                  name="name"
                  value={newExpense.name}
                  onChange={handleExpenseChange}
                  placeholder="Groceries"
                  disabled={isSavingExpense}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowExpenseModal(false)}
                disabled={isSavingExpense}
              >
                Cancel
              </button>
              <button
                className="modal-btn create"
                onClick={handleAddExpense}
                disabled={!newExpense.date.trim() || !newExpense.price.trim() || !newExpense.name.trim() || isSavingExpense}
              >
                {isSavingExpense ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDashboard;
