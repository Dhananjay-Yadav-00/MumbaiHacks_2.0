import { useState, useEffect } from 'react';
import axios from 'axios';
import './HospitalAdminDashboard.css';

const API_URL = import.meta.env.VITE_API_URL;

// Use REAL status from backend — single source of truth
function getTier(hospital) {
    const s = hospital.status || 'Green';
    return s === 'Red' ? 'critical' : s === 'Yellow' ? 'busy' : 'normal';
}

function barColor(pct) {
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return '#22c55e';
}

export default function AdminDashboard() {
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/hospitals`);
                setHospitals(res.data);
            } catch (err) {
                console.error('Error fetching hospitals:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 6000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="had-loading">
            <div className="had-spinner" />
            <p>Loading Hospital Overview...</p>
        </div>
    );

    let critical = 0, busy = 0, normal = 0, totalAvail = 0, totalAll = 0;
    hospitals.forEach(h => {
        const t = getTier(h);
        if (t === 'critical') critical++;
        else if (t === 'busy') busy++;
        else normal++;
        totalAvail += h.bed_availability || 0;
        totalAll += h.total_beds || 100;
    });

    return (
        <div className="had-root">
            <div className="had-header">
                <div className="had-header-left">
                    <h2>📊 Hospital Status Overview</h2>
                    <p>Real-time snapshot of {hospitals.length} facilities across Mumbai</p>
                </div>
            </div>

            <div className="had-summary-grid">
                {[
                    { icon: '🏥', label: 'Total Hospitals', value: hospitals.length, cls: 'blue' },
                    { icon: '🟢', label: 'Normal', value: normal, cls: 'green' },
                    { icon: '🟡', label: 'Busy', value: busy, cls: 'amber' },
                    { icon: '🔴', label: 'Critical', value: critical, cls: 'red' },
                    { icon: '🛏', label: 'Available Beds', value: totalAvail, cls: 'green' },
                ].map(s => (
                    <div key={s.label} className={`had-summary-card ${s.cls}`}>
                        <span className="had-summary-icon">{s.icon}</span>
                        <div className="had-summary-info">
                            <div className="label">{s.label}</div>
                            <div className="value">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="had-cards-grid">
                {hospitals.map(h => {
                    const tier = getTier(h);
                    const avail = h.bed_availability || 0;
                    const total = h.total_beds || 100;
                    const occ = total - avail;
                    const pct = Math.min(100, Math.round((occ / total) * 100));
                    const color = barColor(pct);
                    const statusLabel = tier === 'critical' ? '🔴 Critical' : tier === 'busy' ? '🟡 Busy' : '🟢 Normal';
                    const bgColor = tier === 'critical' ? '#fee2e2' : tier === 'busy' ? '#fef9c3' : '#dcfce7';
                    const txtColor = tier === 'critical' ? '#991b1b' : tier === 'busy' ? '#854d0e' : '#166534';

                    return (
                        <div key={h.hospital_id} style={{
                            background: 'white', borderRadius: 12,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            borderLeft: `4px solid ${color}`,
                            border: `1px solid #e2e8f0`,
                            borderLeftWidth: 4,
                            padding: '1.1rem 1.25rem',
                            display: 'flex', flexDirection: 'column', gap: '0.75rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '0.95rem', color: '#1e293b', flex: 1, paddingRight: '0.5rem' }}>{h.hospital_name}</strong>
                                <span style={{ padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: bgColor, color: txtColor, whiteSpace: 'nowrap' }}>
                                    {statusLabel}
                                </span>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', marginBottom: '0.2rem' }}>
                                    <span>Bed Occupancy</span>
                                    <span style={{ fontWeight: 700, color }}>{avail} free / {total} total ({pct}%)</span>
                                </div>
                                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                                {[
                                    { icon: '🚨', label: 'ER Admissions', val: h.er_admissions },
                                    { icon: '🚑', label: 'Ambulances', val: h.ambulance_arrivals },
                                    { icon: '👨‍⚕️', label: 'Staff Capacity', val: h.staff_capacity },
                                ].map(s => (
                                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem' }}>{s.icon}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.label}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{s.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
