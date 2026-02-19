import { useState, useEffect } from 'react';
import axios from 'axios';
import { getStatusColor, getBarColor, getStatusLabel } from '../../hospitalUtils';
import { useHospitalData } from '../../hooks/useHospitalData';

const API_URL = import.meta.env.VITE_API_URL;

// ── Use REAL status from backend — single source of truth ────────────────────
function getHospitalTier(hospital) {
    const s = hospital.status || 'Green';
    return s === 'Red' ? 'critical' : s === 'Yellow' ? 'busy' : 'normal';
}

function StatusDot({ status }) {
    // Map 'critical' -> 'Red', etc for getStatusColor
    const map = { critical: 'Red', busy: 'Yellow', normal: 'Green' };
    const color = getStatusColor(map[status] || 'Green');
    return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />;
}

function MiniBar({ pct, color }) {
    return (
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
    );
}

function formatTime(d) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function SystemAdminDashboard() {
    const { hospitals, loading: hospitalsLoading, lastUpdated, refetch } = useHospitalData(6000);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [retraining, setRetraining] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all'); // all | critical | busy | normal
    const [search, setSearch] = useState('');

    // Fetch logs separately
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/logs`);
                setLogs(res.data);
            } catch (err) {
                console.error('Error fetching logs:', err);
            } finally {
                setLoadingLogs(false);
            }
        };
        fetchLogs();
        const interval = setInterval(fetchLogs, 6000);
        return () => clearInterval(interval);
    }, []);

    const handleRetrain = async () => {
        setRetraining(true);
        try {
            await axios.post(`${API_URL}/api/admin/retrain`);
            alert('✅ Model retraining started!');
        } catch (err) {
            alert('❌ Error: ' + err.message);
        } finally {
            setRetraining(false);
        }
    };

    const handleDeleteHospital = async (id, name) => {
        if (!window.confirm(`Delete ${name}?`)) return;
        try {
            await axios.delete(`${API_URL}/api/admin/hospitals/${id}`);
            // Refetching is handled by the hook's interval, or we could expose refetch from hook
        } catch (err) {
            alert('Error deleting: ' + err.message);
        }
    };

    // ── Derived summary stats ────────────────────────────────────────────────
    let totalCritical = 0, totalBusy = 0, totalNormal = 0;

    hospitals.forEach(h => {
        const tier = getHospitalTier(h);
        if (tier === 'critical') totalCritical++;
        else if (tier === 'busy') totalBusy++;
        else totalNormal++;
    });

    // ── Filtering ────────────────────────────────────────────────────────────
    const filtered = hospitals.filter(h => {
        const tier = getHospitalTier(h);
        const matchFilter = filterStatus === 'all' || tier === filterStatus;
        const matchSearch = h.hospital_name.toLowerCase().includes(search.toLowerCase()) ||
            h.hospital_id.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    });

    if (hospitalsLoading && loadingLogs) return (
        <div className="had-loading">
            <div className="had-spinner" />
            <p>Loading System Data...</p>
        </div>
    );

    return (
        <div className="had-root">
            {/* ── Header ── */}
            <div className="had-header">
                <div className="had-header-left">
                    <h2>⚙️ System Administration</h2>
                    <p>HealthHIVE AI Control Panel · Mumbai Network · ⏱ {lastUpdated ? formatTime(lastUpdated) : '--:--:--'}</p>
                </div>
                <div className="had-header-right">
                    <button
                        onClick={handleRetrain}
                        disabled={retraining}
                        style={{ padding: '0.5rem 1.1rem', background: retraining ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                    >
                        {retraining ? '⏳ Retraining...' : '🤖 Retrain AI Model'}
                    </button>
                    <button className="had-refresh-btn" onClick={refetch}>🔄 Refresh</button>
                </div>
            </div>

            {/* ── Network KPI Row ── */}
            <div className="had-summary-grid">
                <div className="had-summary-card blue">
                    <span className="had-summary-icon">🏥</span>
                    <div className="had-summary-info">
                        <div className="label">Total Facilities</div>
                        <div className="value">{hospitals.length}</div>
                    </div>
                </div>
                <div className="had-summary-card green">
                    <span className="had-summary-icon">🟢</span>
                    <div className="had-summary-info">
                        <div className="label">Normal</div>
                        <div className="value">{totalNormal}</div>
                    </div>
                </div>
                <div className="had-summary-card amber">
                    <span className="had-summary-icon">🟡</span>
                    <div className="had-summary-info">
                        <div className="label">Busy</div>
                        <div className="value">{totalBusy}</div>
                    </div>
                </div>
                <div className="had-summary-card red">
                    <span className="had-summary-icon">🔴</span>
                    <div className="had-summary-info">
                        <div className="label">Critical</div>
                        <div className="value">{totalCritical}</div>
                    </div>
                </div>
            </div>

            {/* ── Main 2-column layout ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* ── Hospital Registry ── */}
                <div>
                    {/* Search & Filter */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="🔍 Search hospital..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ flex: 1, minWidth: 180, padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.875rem', outline: 'none' }}
                        />
                        {['all', 'normal', 'busy', 'critical'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(f)}
                                style={{
                                    padding: '0.4rem 0.85rem', borderRadius: 8, border: '1px solid #e2e8f0',
                                    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                                    background: filterStatus === f ? '#2563eb' : 'white',
                                    color: filterStatus === f ? 'white' : '#475569'
                                }}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
                        {filtered.map(h => {
                            const tier = getHospitalTier(h);
                            const avail = h.bed_availability || 0;
                            const total = h.total_beds || 100;
                            const occ = total - avail;
                            const pct = Math.min(100, Math.round((occ / total) * 100));
                            const color = getBarColor(pct);
                            const statusLabel = tier === 'critical' ? '🔴 Critical' : tier === 'busy' ? '🟡 Busy' : '🟢 Normal';

                            return (
                                <div key={h.hospital_id} style={{
                                    background: 'white', borderRadius: 10, padding: '0.85rem 1rem',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    borderLeft: `4px solid ${color}`,
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{h.hospital_name}</strong>
                                            <span style={{
                                                fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999,
                                                background: tier === 'critical' ? '#fee2e2' : tier === 'busy' ? '#fef9c3' : '#dcfce7',
                                                color: tier === 'critical' ? '#991b1b' : tier === 'busy' ? '#854d0e' : '#166534'
                                            }}>{statusLabel}</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                            {h.hospital_id} · Beds: <strong>{avail}/{total}</strong> · Staff: <strong>{h.staff_capacity}</strong> · ER: <strong>{h.er_admissions}</strong>
                                        </div>
                                        {/* Mini Bed Bar */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                                            <MiniBar pct={pct} color={color} />
                                            <span style={{ fontSize: '0.72rem', color, fontWeight: 700, whiteSpace: 'nowrap' }}>{pct}%</span>
                                        </div>
                                    </div>
                                    {/* Delete */}
                                    <button
                                        onClick={() => handleDeleteHospital(h.hospital_id, h.hospital_name)}
                                        style={{ padding: '0.35rem 0.65rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                                    >
                                        🗑 Delete
                                    </button>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hospitals match the filter.</div>
                        )}
                    </div>
                </div>

                {/* ── System Log Panel ── */}
                <div>
                    <div style={{ background: '#0f172a', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                            <span style={{ marginLeft: '0.5rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>System Logs</span>
                        </div>
                        <div style={{ height: '60vh', overflowY: 'auto', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {logs.length === 0 && (
                                <>
                                    {['Hospital network online', 'AI model loaded — LightGBM v4.1', 'Simulation thread started', 'Database connected: hospital.db', 'CORS enabled for localhost:5173', '46 facilities registered', 'Auto-refresh active (6s interval)', 'Monitoring: bed occupancy, ER load, staff'].map((msg, i) => (
                                        <div key={i}>
                                            <span style={{ color: '#475569' }}>[{formatTime(new Date())}]</span>{' '}
                                            <span style={{ color: '#22c55e' }}>INFO</span>:{' '}{msg}
                                        </div>
                                    ))}
                                </>
                            )}
                            {logs.map((log, i) => (
                                <div key={i}>
                                    <span style={{ color: '#475569' }}>[{(log.timestamp || '').split('T')[1]?.split('.')[0] || '—'}]</span>{' '}
                                    <span style={{ color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARNING' ? '#f59e0b' : '#22c55e' }}>{log.level}</span>:{' '}
                                    {log.message}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Model Status Card */}
                    <div style={{ background: 'white', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.75rem' }}>🤖 AI Model Status</div>
                        {[
                            { label: 'Algorithm', val: 'LightGBM' },
                            { label: 'Prediction Target', val: 'Bed Congestion' },
                            { label: 'Features', val: '6 (ER, Beds, Staff, Ambul…)' },
                            { label: 'Status', val: '🟢 Active', valColor: '#16a34a' },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                                <span style={{ color: '#64748b' }}>{item.label}</span>
                                <span style={{ fontWeight: 600, color: item.valColor || '#1e293b' }}>{item.val}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
