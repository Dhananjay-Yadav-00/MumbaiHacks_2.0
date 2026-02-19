import { useState } from 'react';
import HospitalCard from './HospitalCard';
import './HospitalAdminDashboard.css';
import { useHospitalData } from '../../hooks/useHospitalData';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

function formatTime(date) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function HospitalAdminDashboard() {
    const { hospitals, loading, refetch, lastUpdated } = useHospitalData(6000);
    const { user } = useAuth();
    const isHospitalAdmin = user?.role === 'hospital';
    // Hospital admins see only their own hospital; admins see all
    const visibleHospitals = isHospitalAdmin && user?.hospitalId
        ? hospitals.filter(h => h.hospital_id === user.hospitalId)
        : hospitals;
    const [autoRefresh, setAutoRefresh] = useState(true);

    // ── Network Summary — computed from visible hospitals ────────────────────
    let totalFacilities = visibleHospitals.length;
    let totalAvailBeds = 0;
    let activeAlerts = 0;
    let totalAmbulances = 0;

    visibleHospitals.forEach(h => {
        totalAvailBeds += h.bed_availability || 0;
        totalAmbulances += h.ambulance_arrivals || 0;
        activeAlerts += (h.alerts?.length || 0);
    });

    if (loading && hospitals.length === 0) {
        return (
            <div className="had-loading">
                <div className="had-spinner" />
                <p>Loading Hospital Network...</p>
            </div>
        );
    }

    return (
        <div className="had-root">
            {/* ── Header ── */}
            <div className="had-header">
                <div className="had-header-left">
                    <h2>🏥 Hospital Administration</h2>
                    <p>
                        {isHospitalAdmin
                            ? `Managing your hospital (${user?.hospitalId})`
                            : `Managing ${totalFacilities} facilities across Mumbai`}
                    </p>
                </div>
                <div className="had-header-right">
                    <span className="had-timestamp">⏱ Last updated: {formatTime(lastUpdated || new Date())}</span>
                    <label className="had-auto-refresh">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={e => setAutoRefresh(e.target.checked)}
                            style={{ accentColor: '#3b82f6' }}
                        />
                        Auto-refresh
                    </label>
                    <button className="had-refresh-btn" onClick={refetch}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* ── Network Summary ── */}
            <div className="had-summary-grid">
                <div className="had-summary-card blue">
                    <span className="had-summary-icon">🏥</span>
                    <div className="had-summary-info">
                        <div className="label">Total Facilities</div>
                        <div className="value">{totalFacilities}</div>
                    </div>
                </div>
                <div className="had-summary-card green">
                    <span className="had-summary-icon">🛏</span>
                    <div className="had-summary-info">
                        <div className="label">Available Beds</div>
                        <div className="value">{totalAvailBeds}</div>
                    </div>
                </div>
                <div className="had-summary-card red">
                    <span className="had-summary-icon">🚨</span>
                    <div className="had-summary-info">
                        <div className="label">Active Alerts</div>
                        <div className="value">{activeAlerts}</div>
                    </div>
                </div>
                <div className="had-summary-card amber">
                    <span className="had-summary-icon">🚑</span>
                    <div className="had-summary-info">
                        <div className="label">Ambulance Arrivals</div>
                        <div className="value">{totalAmbulances}</div>
                    </div>
                </div>
            </div>

            {/* ── Hospital Cards ── */}
            {isHospitalAdmin && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '0.65rem 1rem', fontSize: '0.83rem', color: '#1d4ed8', marginBottom: '1rem' }}>
                    🔒 You are viewing only your hospital ({user?.hospitalId}). Edit controls are enabled for your hospital only.
                </div>
            )}
            <div className="had-cards-grid">
                {visibleHospitals.map(hospital => (
                    <HospitalCard
                        key={hospital.hospital_id}
                        hospital={hospital}
                        onUpdate={refetch}
                        isOwner={!isHospitalAdmin || hospital.hospital_id === user?.hospitalId}
                    />
                ))}
            </div>
        </div>
    );
}
