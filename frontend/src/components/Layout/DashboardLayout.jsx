import { Outlet, Link, useLocation } from 'react-router-dom';
import './DashboardLayout.css';

export default function DashboardLayout() {
    const location = useLocation();
    const role = location.pathname.split('/')[1] || 'home';

    return (
        <div className="dashboard-container">
            <nav className="sidebar">
                <div className="logo">HealthHIVE</div>
                <ul>
                    <li className={role === 'system-admin' ? 'active' : ''}>
                        <Link to="/system-admin">System Admin</Link>
                    </li>
                    <li className={role === 'hospital-admin' ? 'active' : ''}>
                        <Link to="/hospital-admin">Hospital Admin</Link>
                    </li>
                    <li className={role === 'dispatcher' ? 'active' : ''}>
                        <Link to="/dispatcher">Dispatcher</Link>
                    </li>
                    <li className={role === 'patient' ? 'active' : ''}>
                        <Link to="/patient">Patient / Bystander</Link>
                    </li>
                </ul>
                <div className="nav-footer">
                    <Link to="/">Exit to Home</Link>
                </div>
            </nav>
            <main className="content">
                <header className="top-bar">
                    <h1>{role.charAt(0).toUpperCase() + role.slice(1)} Dashboard</h1>
                    <div className="status-indicator">
                        <span className="dot online"></span> System Online
                    </div>
                </header>
                <div className="page-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
