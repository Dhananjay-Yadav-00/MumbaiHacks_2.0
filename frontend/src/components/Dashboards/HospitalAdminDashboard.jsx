import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import HospitalCard from './HospitalCard';
import './HospitalAdminDashboard.css';

const API_URL = import.meta.env.VITE_API_URL;

function formatTime(date) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function HospitalAdminDashboard() {
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const intervalRef = useRef(null);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/hospitals`);
            setHospitals(res.data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (err) {
            console.error('Error fetching hospitals:', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(fetchData, 6000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoRefresh]);

    // ── Network Summary — from REAL backend data ──────────────────────────────
    let totalFacilities = hospitals.length;
    let totalAvailBeds = 0;
    let activeAlerts = 0;
    let totalAmbulances = 0;
    let totalNormal = 0, totalBusy = 0, totalCritical = 0;

    hospitals.forEach(h => {
        const s = h.status || 'Green';
        if (s === 'Red') { totalCritical++; activeAlerts += 3; }
        else if (s === 'Yellow') { totalBusy++; activeAlerts += 1; }
        else totalNormal++;
        totalAvailBeds += h.bed_availability || 0;
        totalAmbulances += h.ambulance_arrivals || 0;
    });



    if (loading) {
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
                    <p>Managing {totalFacilities} facilities across Mumbai</p>
                </div>
                <div className="had-header-right">
                    <span className="had-timestamp">⏱ Last updated: {formatTime(lastUpdated)}</span>
                    <label className="had-auto-refresh">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={e => setAutoRefresh(e.target.checked)}
                            style={{ accentColor: '#3b82f6' }}
                        />
                        Auto-refresh
                    </label>
                    <button className="had-refresh-btn" onClick={fetchData}>
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
            <div className="had-cards-grid">
                {hospitals.map(hospital => (
                    <HospitalCard
                        key={hospital.hospital_id}
                        hospital={hospital}
                        alerts={[]}
                        onUpdate={fetchData}
                    />
                ))}
            </div>
        </div>
    );
}
