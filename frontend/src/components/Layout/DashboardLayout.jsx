import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './DashboardLayout.css';

const NAV_ITEMS = [
    {
        path: '/system-admin',
        label: '⚙️ System Admin',
        key: 'system-admin',
        roles: ['admin'],
    },
    {
        path: '/hospital-admin',
        label: '🏥 Hospital Admin',
        key: 'hospital-admin',
        roles: ['admin', 'hospital'],
    },
    {
        path: '/dispatcher',
        label: '🚑 Dispatcher',
        key: 'dispatcher',
        roles: ['admin', 'hospital', 'guest'],
    },
    {
        path: '/patient',
        label: '🆘 Patient / Bystander',
        key: 'patient',
        roles: ['admin', 'hospital', 'guest'],
    },
];

const ROLE_LABELS = {
    admin: '🛡️ System Admin',
    hospital: '🏥 Hospital Admin',
    guest: '🆘 Patient (Guest)',
};

const PAGE_TITLES = {
    'system-admin': 'System Administration',
    'hospital-admin': 'Hospital Management',
    'dispatcher': 'Dispatcher Dashboard',
    'patient': 'Patient & Bystander Portal',
};

export default function DashboardLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const segment = location.pathname.split('/')[1] || 'home';
    const userRole = user?.role || 'guest';

    const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(userRole));

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="dashboard-container">
            <nav className="sidebar">
                {/* Logo */}
                <div className="logo">
                    <span style={{ color: '#38bdf8' }}>Health</span>HIVE
                </div>

                {/* User Badge */}
                {user && (
                    <div style={{
                        margin: '0 0 1rem 0',
                        padding: '0.6rem 0.85rem',
                        background: 'rgba(56,189,248,0.1)',
                        border: '1px solid rgba(56,189,248,0.25)',
                        borderRadius: 10,
                        fontSize: '0.78rem',
                        color: '#7dd3fc',
                        lineHeight: 1.4,
                    }}>
                        <div style={{ fontWeight: 700, color: '#bae6fd', marginBottom: '0.15rem' }}>
                            {ROLE_LABELS[userRole]}
                        </div>
                        <div style={{ color: '#94a3b8' }}>@{user.username}</div>
                        {user.hospitalId && (
                            <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.1rem' }}>
                                Hospital: {user.hospitalId}
                            </div>
                        )}
                    </div>
                )}

                {/* Nav Links */}
                <ul>
                    {visibleNav.map(item => (
                        <li key={item.key} className={segment === item.key ? 'active' : ''}>
                            <Link to={item.path}>{item.label}</Link>
                        </li>
                    ))}
                </ul>

                {/* Footer */}
                <div className="nav-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Link to="/" style={{ color: '#64748b', fontSize: '0.82rem' }}>← Exit to Home</Link>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#fca5a5',
                            borderRadius: 8,
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        🚪 {user?.role === 'guest' ? 'Exit Guest' : 'Logout'}
                    </button>
                </div>
            </nav>

            <main className="content">
                <header className="top-bar">
                    <h1>{PAGE_TITLES[segment] || 'Dashboard'}</h1>
                    <div className="status-indicator">
                        <span className="dot online" />
                        System Online
                    </div>
                </header>
                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
