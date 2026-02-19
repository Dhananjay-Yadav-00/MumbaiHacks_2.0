import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// ── Seeded PRNG (only for non-DB fields: ICU, doctors, nurses, support) ──────
function strToSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return Math.abs(h);
}
function createRng(seed) {
    let s = seed >>> 0;
    return () => {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }

// ── Derive realistic fields from REAL backend data + seeded extras ────────────
// Status, bed counts, staff_capacity all come from the real DB/CSV.
// ICU, doctors breakdown are derived consistently via seed.
function deriveHospitalData(hospital) {
    const rng = createRng(strToSeed(String(hospital.hospital_id || 'x')));

    // ── REAL fields from backend ──────────────────────────────────────────────
    const totalBeds = hospital.total_beds || 100;
    const availBeds = Math.max(0, hospital.bed_availability ?? 0);
    const occupiedBeds = Math.max(0, totalBeds - availBeds);
    const occupancyPct = Math.min(100, Math.round((occupiedBeds / totalBeds) * 100));

    // ── Status directly from backend (the ONLY source of truth) ───────────────
    const status = hospital.status || 'Green';  // 'Red' | 'Yellow' | 'Green'
    const tier = status === 'Red' ? 'critical' : status === 'Yellow' ? 'busy' : 'normal';

    // ── ICU — seeded but proportional to real occupancy ───────────────────────
    const icuTotal = Math.max(5, Math.round(totalBeds * (0.10 + rng() * 0.08)));
    const icuPct = Math.min(100, occupancyPct + randInt(rng, -5, 15));
    const icuOccupied = Math.min(icuTotal, Math.round(icuTotal * icuPct / 100));
    const icuAvail = icuTotal - icuOccupied;

    // ── Staff from real backend field + seeded breakdown ──────────────────────
    const staffTotal = hospital.staff_capacity || 80;
    const doctors = Math.round(staffTotal * (0.22 + rng() * 0.05));
    const nurses = Math.round(staffTotal * (0.50 + rng() * 0.08));
    const support = Math.round(staffTotal * (0.12 + rng() * 0.05));
    const onLeave = Math.max(1, Math.round(staffTotal * (0.03 + rng() * 0.07)));

    let staffStatus;
    if (tier === 'critical') staffStatus = rng() < 0.55 ? 'critical' : 'limited';
    else if (tier === 'busy') staffStatus = rng() < 0.45 ? 'limited' : 'adequate';
    else staffStatus = rng() < 0.85 ? 'adequate' : 'limited';

    // ── Alerts from real data ─────────────────────────────────────────────────
    const generatedAlerts = [];
    if (icuPct >= 90) generatedAlerts.push({ type: 'critical', msg: '🔴 ICU at critical capacity', time: `${randInt(rng, 1, 5)}m ago` });
    if (occupancyPct >= 90) generatedAlerts.push({ type: 'critical', msg: '🔴 Emergency ward overloaded', time: `${randInt(rng, 1, 8)}m ago` });
    if (staffStatus === 'critical') generatedAlerts.push({ type: 'critical', msg: '🔴 Critical staff shortage', time: `${randInt(rng, 2, 12)}m ago` });
    if (icuPct >= 75 && icuPct < 90) generatedAlerts.push({ type: 'warning', msg: '🟡 ICU nearing capacity', time: `${randInt(rng, 5, 20)}m ago` });
    if (staffStatus === 'limited') generatedAlerts.push({ type: 'warning', msg: '🟡 Staff availability limited', time: `${randInt(rng, 8, 30)}m ago` });
    if (availBeds <= 5) generatedAlerts.push({ type: 'critical', msg: `🔴 Only ${availBeds} beds remaining`, time: `${randInt(rng, 1, 10)}m ago` });
    if (hospital.ambulance_arrivals >= 8) generatedAlerts.push({ type: 'info', msg: '🚑 High ambulance influx', time: `${randInt(rng, 3, 15)}m ago` });

    return {
        totalBeds, availBeds, occupiedBeds, occupancyPct,
        icuTotal, icuOccupied, icuAvail, icuPct,
        doctors, nurses, support, onLeave, staffTotal, staffStatus,
        status, tier, generatedAlerts,
    };
}

function barColor(pct) {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'yellow';
    return 'green';
}
function staffLabel(s) {
    if (s === 'adequate') return { label: '🟢 Adequate', cls: 'adequate' };
    if (s === 'limited') return { label: '🟡 Limited', cls: 'limited' };
    return { label: '🔴 Shortage', cls: 'critical' };
}

// ══════════════════════════════════════════════════════════════════════════════
// Edit Modal — update beds & staff and sync to DB + CSV
// ══════════════════════════════════════════════════════════════════════════════
function EditHospitalModal({ hospital, derived: d, onClose, onSaved }) {
    const [totalBeds, setTotalBeds] = useState(String(hospital.total_beds || d.totalBeds));
    const [availBeds, setAvailBeds] = useState(String(hospital.bed_availability ?? d.availBeds));
    const [staffCap, setStaffCap] = useState(String(hospital.staff_capacity || d.staffTotal));
    const [erAdmit, setErAdmit] = useState(String(hospital.er_admissions || 0));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const tb = parseInt(totalBeds, 10);
        const ab = parseInt(availBeds, 10);
        const sc = parseInt(staffCap, 10);
        const er = parseInt(erAdmit, 10);
        if (isNaN(tb) || isNaN(ab) || isNaN(sc) || tb < 1 || ab < 0 || ab > tb) {
            setError('Invalid values: Available Beds must be ≥ 0 and ≤ Total Beds.');
            return;
        }
        // Derive status from new occupancy
        const occPct = Math.round(((tb - ab) / tb) * 100);
        const newStatus = occPct >= 90 ? 'Red' : occPct >= 70 ? 'Yellow' : 'Green';

        setSaving(true);
        setError('');
        try {
            await axios.post(`${API_URL}/api/hospital/${hospital.hospital_id}/update`, {
                total_beds: tb,
                bed_availability: ab,
                staff_capacity: sc,
                er_admissions: er,
                status: newStatus,
                sync_csv: true,   // tells backend to also write CSV
            });
            onSaved();
            onClose();
        } catch (err) {
            setError('Failed to save: ' + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="hc-modal-overlay" onClick={onClose}>
            <div className="hc-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div className="hc-modal-header">
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>✏️ Edit Hospital</h2>
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>{hospital.hospital_name}</p>
                    </div>
                    <button className="hc-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="hc-modal-body">
                    {[
                        { label: '🛏 Total Beds', val: totalBeds, set: setTotalBeds, type: 'number', min: 1, hint: 'Total bed capacity' },
                        { label: '✅ Available Beds', val: availBeds, set: setAvailBeds, type: 'number', min: 0, hint: 'Currently unoccupied beds' },
                        { label: '👩‍⚕️ Staff Capacity', val: staffCap, set: setStaffCap, type: 'number', min: 1, hint: 'Total staff on duty' },
                        { label: '🚨 ER Admissions', val: erAdmit, set: setErAdmit, type: 'number', min: 0, hint: 'Current ER intake' },
                    ].map(f => (
                        <div key={f.label} style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                                {f.label}
                            </label>
                            <input
                                type={f.type}
                                min={f.min}
                                value={f.val}
                                onChange={e => f.set(e.target.value)}
                                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
                            />
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>{f.hint}</div>
                        </div>
                    ))}

                    {/* Preview new status */}
                    {(() => {
                        const tb = parseInt(totalBeds, 10) || 1;
                        const ab = parseInt(availBeds, 10) || 0;
                        const pct = Math.round(((tb - ab) / tb) * 100);
                        const ns = pct >= 90 ? 'Red' : pct >= 70 ? 'Yellow' : 'Green';
                        const bgC = ns === 'Red' ? '#fee2e2' : ns === 'Yellow' ? '#fef9c3' : '#dcfce7';
                        const txC = ns === 'Red' ? '#991b1b' : ns === 'Yellow' ? '#854d0e' : '#166534';
                        return (
                            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem' }}>
                                New occupancy: <strong>{pct}%</strong> → Status will become{' '}
                                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, background: bgC, color: txC, fontWeight: 700 }}>
                                    {ns === 'Red' ? '🔴 Critical' : ns === 'Yellow' ? '🟡 Busy' : '🟢 Normal'}
                                </span>
                            </div>
                        );
                    })()}

                    {error && <div style={{ color: '#dc2626', fontSize: '0.82rem', padding: '0.5rem', background: '#fee2e2', borderRadius: 6 }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{ flex: 1, padding: '0.65rem', background: saving ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            {saving ? '💾 Saving...' : '💾 Save & Sync CSV'}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: '0.65rem 1rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Detail Modal
// ══════════════════════════════════════════════════════════════════════════════
function HospitalDetailModal({ hospital, derived: d, onClose }) {
    const equip = [
        { icon: '🫁', label: 'Ventilators', count: Math.max(1, Math.round(d.icuTotal * 0.6)) },
        { icon: '❤️', label: 'Cardiac Monitors', count: Math.max(2, Math.round(d.icuTotal * 0.8)) },
        { icon: '🩸', label: 'Defibrillators', count: Math.max(1, Math.round(d.icuTotal * 0.4)) },
        { icon: '🚑', label: 'Ambulances', count: Math.max(1, hospital.ambulance_arrivals || 3) },
        { icon: '💊', label: 'Med Dispensers', count: Math.max(2, Math.round(d.doctors * 0.5)) },
        { icon: '🩻', label: 'CT / MRI', count: 2 },
    ];
    const wards = [
        { label: 'General Ward', total: d.totalBeds - d.icuTotal, occupied: Math.max(0, d.occupiedBeds - d.icuOccupied) },
        { label: 'ICU', total: d.icuTotal, occupied: d.icuOccupied },
        { label: 'Emergency', total: Math.round(d.totalBeds * 0.10), occupied: Math.min(Math.round(d.totalBeds * 0.10), Math.round(d.icuOccupied * 0.7)) },
    ];
    const badgeCls = d.status === 'Red' ? 'red' : d.status === 'Yellow' ? 'yellow' : 'green';

    return (
        <div className="hc-modal-overlay" onClick={onClose}>
            <div className="hc-modal" onClick={e => e.stopPropagation()}>
                <div className="hc-modal-header">
                    <div>
                        <h2 style={{ margin: '0 0 0.25rem' }}>🏥 {hospital.hospital_name}</h2>
                        <div className={`hc-status-badge ${badgeCls}`} style={{ display: 'inline-flex' }}>
                            <span className="pulse-dot"></span>
                            {d.status === 'Red' ? '🔴 Critical' : d.status === 'Yellow' ? '🟡 Busy' : '🟢 Normal'}
                        </div>
                    </div>
                    <button className="hc-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="hc-modal-body">
                    <div className="hc-modal-section">
                        <h4>Key Metrics</h4>
                        <div className="hc-metric-grid">
                            {[
                                { icon: '🛏', label: 'Total Beds', val: d.totalBeds },
                                { icon: '✅', label: 'Available', val: d.availBeds },
                                { icon: '🏥', label: 'ICU Available', val: d.icuAvail },
                                { icon: '👨‍⚕️', label: 'Doctors', val: d.doctors },
                                { icon: '👩‍⚕️', label: 'Nurses', val: d.nurses },
                                { icon: '📊', label: 'Occupancy', val: `${d.occupancyPct}%` },
                            ].map(m => (
                                <div className="hc-metric-card" key={m.label}>
                                    <div className="m-icon">{m.icon}</div>
                                    <div className="m-label">{m.label}</div>
                                    <div className="m-val">{m.val}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="hc-modal-section">
                        <h4>Bed Breakdown</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {wards.map(w => {
                                const pct = w.total > 0 ? Math.min(100, Math.round((w.occupied / w.total) * 100)) : 0;
                                return (
                                    <div key={w.label}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                            <strong>{w.label}</strong>
                                            <span style={{ color: '#64748b' }}>{w.occupied}/{w.total} · {pct}%</span>
                                        </div>
                                        <div className="hc-bar-track">
                                            <div className={`hc-bar-fill ${barColor(pct)}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="hc-modal-section">
                        <h4>Equipment</h4>
                        <div className="hc-equipment-grid">
                            {equip.map(e => (
                                <div className="hc-equip-item" key={e.label}>
                                    <div className="eq-icon">{e.icon}</div>
                                    <div className="eq-label">{e.label}</div>
                                    <div className="eq-count">{e.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="hc-modal-section">
                        <h4>Alert Log</h4>
                        {d.generatedAlerts.length === 0
                            ? <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.875rem' }}>✅ No active alerts</p>
                            : (
                                <table className="hc-log-table">
                                    <thead><tr><th>Level</th><th>Message</th><th>Time</th></tr></thead>
                                    <tbody>
                                        {d.generatedAlerts.map((a, i) => (
                                            <tr key={i}>
                                                <td><span className={`hc-log-dot ${a.type}`}></span>{a.type.charAt(0).toUpperCase() + a.type.slice(1)}</td>
                                                <td>{a.msg}</td>
                                                <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{a.time}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main HospitalCard Component
// ══════════════════════════════════════════════════════════════════════════════
export default function HospitalCard({ hospital, onUpdate }) {
    const [showDetail, setShowDetail] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [actionMsg, setActionMsg] = useState('');

    const d = deriveHospitalData(hospital);
    const sf = staffLabel(d.staffStatus);
    const badgeCls = d.status === 'Red' ? 'red' : d.status === 'Yellow' ? 'yellow' : 'green';
    const badgeLabel = d.status === 'Red' ? '🔴 Critical' : d.status === 'Yellow' ? '🟡 Busy' : '🟢 Normal';

    const doQuickAction = async (type) => {
        let payload = {};
        let msg = '';
        const curAvail = hospital.bed_availability ?? d.availBeds;
        const curTotal = hospital.total_beds || d.totalBeds;
        if (type === 'bed_available') {
            const nb = Math.min(curTotal, curAvail + 1);
            const pct = Math.round(((curTotal - nb) / curTotal) * 100);
            payload = { bed_availability: nb, status: pct >= 90 ? 'Red' : pct >= 70 ? 'Yellow' : 'Green', sync_csv: true };
            msg = '✅ 1 bed marked available';
        } else if (type === 'emergency_case') {
            const nb = Math.max(0, curAvail - 1);
            const pct = Math.round(((curTotal - nb) / curTotal) * 100);
            payload = { bed_availability: nb, er_admissions: (hospital.er_admissions || 0) + 1, status: pct >= 90 ? 'Red' : pct >= 70 ? 'Yellow' : 'Green', sync_csv: true };
            msg = '🚨 Emergency case admitted';
        } else if (type === 'staff_backup') {
            payload = { staff_capacity: (hospital.staff_capacity || 80) + 5, sync_csv: true };
            msg = '👩‍⚕️ Staff backup +5 added';
        }
        try {
            await axios.post(`${API_URL}/api/hospital/${hospital.hospital_id}/update`, payload);
            setActionMsg(msg);
            setTimeout(() => setActionMsg(''), 3500);
            if (onUpdate) onUpdate();
        } catch {
            setActionMsg('❌ Update failed');
            setTimeout(() => setActionMsg(''), 3000);
        }
    };

    return (
        <>
            <div className="hc-card">
                <div className="hc-card-header">
                    <h3 style={{ flex: 1, paddingRight: '0.5rem' }}>{hospital.hospital_name}</h3>
                    <div className={`hc-status-badge ${badgeCls}`}>
                        <span className="pulse-dot"></span>{badgeLabel}
                    </div>
                </div>

                <div className="hc-card-body">
                    {/* Beds */}
                    <div>
                        <div className="hc-section-title">🛏 Bed Occupancy</div>
                        {[
                            { label: 'Overall', pct: d.occupancyPct, occ: d.occupiedBeds, tot: d.totalBeds },
                            { label: 'ICU', pct: d.icuPct, occ: d.icuOccupied, tot: d.icuTotal },
                        ].map(row => (
                            <div className="hc-bar-row" key={row.label}>
                                <div className="hc-bar-label">
                                    <span>{row.label}</span>
                                    <span>{row.occ}/{row.tot}<span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: '0.3rem' }}>{row.pct}%</span></span>
                                </div>
                                <div className="hc-bar-track">
                                    <div className={`hc-bar-fill ${barColor(row.pct)}`} style={{ width: `${row.pct}%` }} />
                                </div>
                            </div>
                        ))}
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                            Available: <strong>{d.availBeds}</strong> beds · ICU free: <strong>{d.icuAvail}</strong>
                        </div>
                    </div>

                    {/* Staff */}
                    <div>
                        <div className="hc-section-title">👩‍⚕️ Staff</div>
                        <div className="hc-staff-grid">
                            {[['Doctors', d.doctors], ['Nurses', d.nurses], ['Support', d.support], ['On Leave', d.onLeave]].map(([lbl, val]) => (
                                <div className="hc-staff-item" key={lbl}><div className="s-label">{lbl}</div><div className="s-val">{val}</div></div>
                            ))}
                        </div>
                        <div className={`hc-staff-status ${sf.cls}`}>{sf.label}</div>
                    </div>

                    {/* Alerts */}
                    <div>
                        <div className="hc-section-title">🚨 Active Alerts</div>
                        {d.generatedAlerts.length === 0
                            ? <div className="hc-no-alerts">✅ No active alerts</div>
                            : (
                                <div className="hc-alerts-list">
                                    {d.generatedAlerts.slice(0, 2).map((a, i) => (
                                        <div key={i} className={`hc-alert-item ${a.type}`}>
                                            <span>{a.msg}</span>
                                            <span className="hc-alert-time">{a.time}</span>
                                        </div>
                                    ))}
                                    {d.generatedAlerts.length > 2 && (
                                        <div style={{ fontSize: '0.75rem', color: '#3b82f6', cursor: 'pointer' }} onClick={() => setShowDetail(true)}>
                                            +{d.generatedAlerts.length - 2} more alerts
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    </div>

                    {actionMsg && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#166534' }}>
                            {actionMsg}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="hc-actions">
                    <button className="hc-btn primary" onClick={() => setShowDetail(true)}>📋 View Details</button>
                    <button className="hc-btn secondary" onClick={() => setShowEdit(true)}>✏️ Edit Beds & Staff</button>
                    <button className="hc-btn success" onClick={() => doQuickAction('bed_available')}>✅ Mark Bed Free</button>
                    <button className="hc-btn danger" onClick={() => doQuickAction('emergency_case')}>🚨 Emergency Case</button>
                </div>
            </div>

            {showDetail && <HospitalDetailModal hospital={hospital} derived={d} onClose={() => setShowDetail(false)} />}
            {showEdit && <EditHospitalModal hospital={hospital} derived={d} onClose={() => setShowEdit(false)} onSaved={() => { if (onUpdate) onUpdate(); }} />}
        </>
    );
}
