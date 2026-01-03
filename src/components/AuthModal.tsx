import { useState } from 'react';
import { account, OAUTH_SUCCESS_URL, OAUTH_FAILURE_URL } from '../lib/appwrite';
import { OAuthProvider } from 'appwrite';
import { useAuth } from '../contexts/AuthContext';
import { X, Github, Chrome } from 'lucide-react';
import '../App.css'; // Ensure styles

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Profile update states
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');

  const { checkSession, user, logout } = useAuth();

  // Reset states when modal connects/disconnects or user changes
  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await account.createEmailPasswordSession(email, password);
      } else {
        await account.create('unique()', email, password, name);
        await account.createEmailPasswordSession(email, password);
      }
      await checkSession();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (provider: OAuthProvider) => {
    try {
      account.createOAuth2Session(
        provider,
        OAUTH_SUCCESS_URL,
        OAUTH_FAILURE_URL
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      setLoading(true);

      try {
          if (newName && newName !== user?.name) {
              await account.updateName(newName);
          }
          if (newPassword) {
              await account.updatePassword(newPassword, oldPassword);
          }
          await checkSession();
          setSuccess('Profile updated successfully');
          setNewPassword('');
          setOldPassword('');
      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleLogout = async () => {
      await logout();
      onClose();
  };

  // Profile View
  if (user) {
      return (
        <div className="settings-overlay" onClick={onClose}>
          <div className="welcome-card" style={{ maxWidth: '400px', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Profile</h2>
              <button className="settings-close" onClick={onClose}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', 
                    background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '1rem', border: '2px solid var(--primary-color)'
                }}>
                     <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                         {(user.name || user.email).substring(0, 2).toUpperCase()}
                     </span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{user.name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
            </div>

            {error && <div className="settings-error" style={{ marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
            {success && <div style={{ color: '#4caf50', background: 'rgba(76, 175, 80, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{success}</div>}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Display Name</label>
                    <input 
                        type="text" 
                        className="settings-input" 
                        defaultValue={user.name}
                        placeholder="Your Name"
                        onChange={e => setNewName(e.target.value)}
                    />
                </div>

                <div style={{ height: 1, background: 'var(--border-color)', margin: '0.5rem 0' }}></div>
                
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Change Password</div>
                <input 
                    type="password" 
                    className="settings-input" 
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                />
                {newPassword && (
                    <input 
                        type="password" 
                        className="settings-input" 
                        placeholder="Current Password (Required)"
                        value={oldPassword}
                        onChange={e => setOldPassword(e.target.value)}
                        required
                    />
                )}

                <button type="submit" className="welcome-button primary" disabled={loading}>
                    {loading ? 'Updating...' : 'Save Changes'}
                </button>
            </form>

            <button 
                onClick={handleLogout}
                style={{ 
                    width: '100%', marginTop: '1rem', padding: '0.75rem', 
                    background: 'transparent', border: '1px solid var(--border-color)', 
                    color: 'var(--text-secondary)', borderRadius: 'var(--radius)', cursor: 'pointer' 
                }}
            >
                Log Out
            </button>
          </div>
        </div>
      );
  }

  // Login View (Auth)
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="welcome-card" style={{ maxWidth: '400px', padding: '2rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button className="settings-close" onClick={onClose}><X size={20} /></button>
        </div>

        {error && <div className="settings-error" style={{ marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button 
            className="welcome-option" 
            style={{ justifyContent: 'center', gap: '0.5rem', background: '#fff', color: '#000', border: 'none' }}
            onClick={() => handleOAuth(OAuthProvider.Google)}
          >
           <Chrome size={18} /> Continue with Google
          </button>
          <button 
            className="welcome-option" 
            style={{ justifyContent: 'center', gap: '0.5rem', background: '#24292e', color: '#fff', border: 'none' }}
            onClick={() => handleOAuth(OAuthProvider.Github)}
          >
            <Github size={18} /> Continue with GitHub
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
          OR
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }}></div>
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Name" 
              className="settings-input" 
              value={name}
              onChange={e => setName(e.target.value)}
              required 
            />
          )}
          <input 
            type="email" 
            placeholder="Email" 
            className="settings-input" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="settings-input" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required 
          />
          
          <button type="submit" className="welcome-button primary" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', padding: 0, fontSize: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
}
