import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const ROLE_LABELS = {
    admin: 'System Admin',
    hospital: 'Hospital Admin',
};

const ROLE_REDIRECTS = {
    admin: '/system-admin',
    hospital: '/hospital-admin',
    guest: '/patient',
};

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [role, setRole] = useState('admin');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGuestLogin = () => {
        login('guest', 'Guest');
        navigate('/patient');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { role, username, password });
            const { role: r, username: u, hospital_id } = res.data;
            login(r, u, hospital_id);
            navigate(ROLE_REDIRECTS[r] || '/patient');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            padding: '1rem',
        }}>
            <div style={{ width: '100%', maxWidth: 440 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>❤️</div>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                        Health<span style={{ color: '#38bdf8' }}>HIVE</span>
                    </h1>
                    <p style={{ color: '#94a3b8', margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
                        AI-Powered Emergency Health Network
                    </p>
                </div>

                {/* Guest Card */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(56,189,248,0.3)',
                    borderRadius: 16,
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.25rem',
                    backdropFilter: 'blur(12px)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '2rem' }}>🆘</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                                Patient / Bystander
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                                No login required — enter as guest
                            </div>
                        </div>
                        <button
                            onClick={handleGuestLogin}
                            style={{
                                padding: '0.55rem 1.25rem',
                                background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 10,
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
                            }}
                        >
                            Enter →
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>or sign in with credentials</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '1.75rem 1.5rem',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        🔐 Staff Login
                    </h2>

                    {/* Role Selector */}
                    <div>
                        <label style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                            Role
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {Object.entries(ROLE_LABELS).map(([r, label]) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    style={{
                                        flex: 1,
                                        padding: '0.55rem',
                                        borderRadius: 8,
                                        border: `2px solid ${role === r ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                                        background: role === r ? 'rgba(56,189,248,0.15)' : 'transparent',
                                        color: role === r ? '#38bdf8' : '#94a3b8',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {r === 'admin' ? '🛡️' : '🏥'} {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Username */}
                    <div>
                        <label style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                            Username
                        </label>
                        <input
                            type="text"
                            placeholder={role === 'admin' ? 'sysadmin' : 'kemadmin'}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.7rem 0.9rem',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.7rem 0.9rem',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#fca5a5', fontSize: '0.83rem' }}>
                            ❌ {error}
                        </div>
                    )}

                    {/* Hint */}
                    <div style={{ background: 'rgba(56,189,248,0.08)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: '#7dd3fc' }}>
                        💡 Demo: <strong>sysadmin / admin123</strong> (System Admin) · <strong>kemadmin / hosp123</strong> (Hospital Admin)
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '0.75rem',
                            background: loading ? '#334155' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 10,
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : '0 4px 12px rgba(37,99,235,0.4)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {loading ? '⏳ Signing in...' : '🔐 Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
