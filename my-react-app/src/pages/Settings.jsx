import { useContext, useEffect, useState } from 'react';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase-config';
import { AuthContext } from '../context/auth-context';
import '../styles/Settings.css';

const initialPaymentMethods = {
  venmo: '',
  zelle: '',
  cashApp: '',
  paypal: ''
};

const paymentMethodOptions = [
  { id: 'venmo', label: 'Venmo' },
  { id: 'zelle', label: 'Zelle' },
  { id: 'cashApp', label: 'Cash App' },
  { id: 'paypal', label: 'PayPal' }
];

function Settings() {
  const navigate = useNavigate();
  const { user, userProfile } = useContext(AuthContext);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: ''
  });
  const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState('venmo');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    setProfileForm({
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || ''
    });
    setPaymentMethods({
      ...initialPaymentMethods,
      ...(userProfile?.paymentMethods || {})
    });
    setPreferredPaymentMethod(userProfile?.preferredPaymentMethod || 'venmo');
  }, [userProfile]);

  const displayName = `${profileForm.firstName.trim()} ${profileForm.lastName.trim()}`.trim();

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentMethods((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const clearMessages = () => {
    setStatus('');
    setError('');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!user || !profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      setError('Please enter both your first and last name.');
      return;
    }

    setIsSavingProfile(true);

    try {
      await updateProfile(user, { displayName });
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email || '',
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        displayName,
        paymentMethods,
        preferredPaymentMethod,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const groupsSnapshot = await getDocs(query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', user.uid)
      ));

      await Promise.all(groupsSnapshot.docs.map((groupDoc) => {
        const group = groupDoc.data();
        const nextMembers = (group.members || []).map((member) => (
          member.uid === user.uid
            ? {
              ...member,
              email: user.email || '',
              firstName: profileForm.firstName.trim(),
              lastName: profileForm.lastName.trim(),
              displayName,
              paymentMethods,
              preferredPaymentMethod
            }
            : member
        ));

        return updateDoc(doc(db, 'groups', groupDoc.id), {
          members: nextMembers
        });
      }));

      setStatus('Profile and payment settings saved.');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Enter your current password and confirm your new password.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSavingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatus('Password updated.');
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setError('Please sign out and sign back in before changing your password.');
      } else {
        setError(error.message);
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    clearMessages();

    if (deleteConfirmation !== 'DELETE' || !deletePassword) {
      setError('Type DELETE and enter your current password to confirm account deletion.');
      return;
    }

    setIsDeletingAccount(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(auth.currentUser);
      navigate('/');
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setError('Please sign out and sign back in before deleting your account.');
      } else {
        setError(error.message);
      }
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="settings-container">
      <button className="settings-back-button" onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </button>

      <header className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile, payout details, and account access.</p>
        </div>
      </header>

      <main className="settings-content">
        {(status || error) && (
          <div className={error ? 'settings-message error' : 'settings-message'}>
            {error || status}
          </div>
        )}

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h2>Profile</h2>
            <p>This name appears in your dashboard and next to expenses you add.</p>
          </div>
          <form className="settings-form" onSubmit={handleSaveProfile}>
            <div className="settings-field-grid">
              <label>
                <span>First Name</span>
                <input
                  type="text"
                  name="firstName"
                  value={profileForm.firstName}
                  onChange={handleProfileChange}
                  disabled={isSavingProfile}
                />
              </label>
              <label>
                <span>Last Name</span>
                <input
                  type="text"
                  name="lastName"
                  value={profileForm.lastName}
                  onChange={handleProfileChange}
                  disabled={isSavingProfile}
                />
              </label>
            </div>

            <div className="settings-readonly-row">
              <span>Email</span>
              <strong>{user?.email}</strong>
            </div>

            <div className="settings-panel-heading compact">
              <h2>Payment Methods</h2>
              <p>Add handles or links people can use when settling up.</p>
            </div>

            <div className="settings-field-grid">
              <label>
                <span>Venmo</span>
                <input
                  type="text"
                  name="venmo"
                  value={paymentMethods.venmo}
                  onChange={handlePaymentChange}
                  placeholder="@yourname or venmo.com/u/yourname"
                  disabled={isSavingProfile}
                />
              </label>
              <label>
                <span>Zelle</span>
                <input
                  type="text"
                  name="zelle"
                  value={paymentMethods.zelle}
                  onChange={handlePaymentChange}
                  placeholder="email or phone"
                  disabled={isSavingProfile}
                />
              </label>
              <label>
                <span>Cash App</span>
                <input
                  type="text"
                  name="cashApp"
                  value={paymentMethods.cashApp}
                  onChange={handlePaymentChange}
                  placeholder="$cashtag"
                  disabled={isSavingProfile}
                />
              </label>
              <label>
                <span>PayPal</span>
                <input
                  type="text"
                  name="paypal"
                  value={paymentMethods.paypal}
                  onChange={handlePaymentChange}
                  placeholder="paypal.me/yourname"
                  disabled={isSavingProfile}
                />
              </label>
            </div>

            <div className="preferred-payment-group">
              <span>Preferred Payment Option</span>
              <div className="preferred-payment-options">
                {paymentMethodOptions.map((option) => (
                  <label key={option.id} className="preferred-payment-option">
                    <input
                      type="radio"
                      name="preferredPaymentMethod"
                      checked={preferredPaymentMethod === option.id}
                      onChange={() => setPreferredPaymentMethod(option.id)}
                      disabled={isSavingProfile}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="settings-actions">
              <button className="settings-primary-button" type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <h2>Password</h2>
            <p>Change the password you use to sign in.</p>
          </div>
          <form className="settings-form" onSubmit={handleChangePassword}>
            <div className="settings-field-grid">
              <label>
                <span>Current Password</span>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  disabled={isSavingPassword}
                />
              </label>
              <label>
                <span>New Password</span>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  disabled={isSavingPassword}
                />
              </label>
              <label>
                <span>Confirm Password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  disabled={isSavingPassword}
                />
              </label>
            </div>
            <div className="settings-actions">
              <button className="settings-primary-button" type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>

        <section className="settings-panel danger">
          <div className="settings-panel-heading">
            <h2>Delete Account</h2>
            <p>This permanently removes your sign-in account. Type DELETE to enable deletion.</p>
          </div>
          <div className="settings-form">
            <label>
              <span>Confirmation</span>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                disabled={isDeletingAccount}
              />
            </label>
            <label>
              <span>Current Password</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={isDeletingAccount}
              />
            </label>
            <div className="settings-actions">
              <button
                className="settings-danger-button"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE' || !deletePassword || isDeletingAccount}
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Settings;
