import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

function barColor(pct) {
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return '#22c55e';
}

function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Hospital Card for Patient View ──────────────────────────────────────────
function HospitalRecommendCard({ hospital, userLat, userLon, patientCount, onBook }) {
    const avail = hospital.bed_availability || 0;
    const total = hospital.total_beds || 100;
    const occ = total - avail;
    const pct = Math.min(100, Math.round((occ / total) * 100));
    const color = barColor(pct);
    const dist = (userLat && userLon) ? distanceKm(userLat, userLon, hospital.latitude, hospital.longitude).toFixed(1) : null;
    const statusMap = { Red: { label: '🔴 Critical', bg: '#fee2e2', tx: '#991b1b' }, Yellow: { label: '🟡 Busy', bg: '#fef9c3', tx: '#854d0e' }, Green: { label: '🟢 Available', bg: '#dcfce7', tx: '#166534' } };
    const st = statusMap[hospital.status] || statusMap.Green;

    return (
        <div style={{ background: 'white', borderRadius: 12, border: `1px solid #e2e8f0`, borderLeft: `4px solid ${color}`, padding: '1.1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{hospital.hospital_name}</strong>
                    {dist && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>📍 {dist} km away</div>}
                </div>
                <span style={{ padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: st.bg, color: st.tx, whiteSpace: 'nowrap' }}>{st.label}</span>
            </div>

            {/* Bed bar */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', marginBottom: '0.2rem' }}>
                    <span>Bed Occupancy</span>
                    <span style={{ fontWeight: 700, color }}>{avail} free / {total} ({pct}%)</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                    { icon: '🛏', label: 'Beds Required', val: patientCount, ok: avail >= patientCount },
                    { icon: '🚨', label: 'ER Admissions', val: hospital.er_admissions },
                    { icon: '👨‍⚕️', label: 'Staff', val: hospital.staff_capacity },
                ].map(s => (
                    <div key={s.label} style={{ background: s.ok === false ? '#fee2e2' : '#f8fafc', borderRadius: 8, padding: '0.35rem 0.65rem', textAlign: 'center', flex: '1 0 auto' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.icon} {s.label}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: s.ok === false ? '#dc2626' : '#1e293b' }}>{s.val}</div>
                    </div>
                ))}
            </div>

            <button
                onClick={() => onBook(hospital)}
                style={{ width: '100%', padding: '0.65rem', background: avail >= patientCount ? '#2563eb' : '#94a3b8', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: avail >= patientCount ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}
                disabled={avail < patientCount}
            >
                {avail >= patientCount ? '📋 Book Hospital' : '❌ Insufficient Beds'}
            </button>
        </div>
    );
}

// ── Booking Confirmation Modal ────────────────────────────────────────────────
function BookingModal({ hospital, formData, onConfirm, onClose, booking, result }) {
    if (result) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', borderRadius: 16, padding: '2rem', maxWidth: 440, width: '90%', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                    <h2 style={{ color: '#166534', marginBottom: '0.5rem' }}>Booking Confirmed!</h2>
                    <p style={{ color: '#64748b', marginBottom: '1rem' }}>Your bed has been reserved successfully.</p>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '1rem', textAlign: 'left', marginBottom: '1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>🏥 {result.hospital_name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>📍 Distance: <strong>{result.distance} km</strong></div>
                        <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>🛏 Beds: <strong>{formData.patient_count} reserved</strong></div>
                        <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>🚑 Type: <strong>{formData.booking_type === 'ambulance' ? 'Bed + Ambulance' : 'Bed Only'}</strong></div>
                    </div>
                    <button onClick={onClose} style={{ width: '100%', padding: '0.7rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                        Close
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 16, padding: '2rem', maxWidth: 440, width: '90%' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>📋 Confirm Booking</h2>
                <p style={{ color: '#64748b', marginBottom: '1.25rem' }}>You are about to book at:</p>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>🏥 {hospital.hospital_name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>📍 Location: {formData.location || 'Not set'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>🛏 Beds needed: {formData.patient_count}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>🚑 Type: {formData.booking_type === 'ambulance' ? 'Bed + Ambulance' : 'Bed Only'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={onConfirm} disabled={booking} style={{ flex: 1, padding: '0.7rem', background: booking ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                        {booking ? '⏳ Booking...' : '✅ Confirm Booking'}
                    </button>
                    <button onClick={onClose} style={{ padding: '0.7rem 1rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ── Main PatientDashboard ─────────────────────────────────────────────────────
export default function PatientDashboard() {
    const [formData, setFormData] = useState({
        location: '', latitude: null, longitude: null,
        patient_count: 1, severity: 'Critical', booking_type: 'bed_only'
    });
    const [hospitals, setHospitals] = useState([]);
    const [predictions, setPredictions] = useState([]);
    const [loadingPred, setLoadingPred] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [bookingHospital, setBookingHospital] = useState(null);
    const [booking, setBooking] = useState(false);
    const [bookingResult, setBookingResult] = useState(null);
    const intervalRef = useRef(null);

    const fetchHospitals = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/hospitals`);
            setHospitals(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchPredictions = async () => {
        setLoadingPred(true);
        try {
            const res = await axios.get(`${API_URL}/api/predict/beds`);
            setPredictions(res.data);
        } catch (err) { console.error('Predictions unavailable', err); }
        setLoadingPred(false);
    };

    useEffect(() => {
        fetchHospitals();
        fetchPredictions();
        intervalRef.current = setInterval(fetchHospitals, 6000);
        return () => clearInterval(intervalRef.current);
    }, []);

    const handleLiveLocation = () => {
        if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords: { latitude, longitude } }) => {
                setFormData(p => ({ ...p, location: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`, latitude, longitude }));
                setIsLocating(false);
            },
            () => { alert('Unable to get location'); setIsLocating(false); }
        );
    };

    // Filter: only hospitals with at least patient_count available beds
    const suitableHospitals = hospitals
        .filter(h => (h.bed_availability || 0) >= Math.max(1, formData.patient_count))
        .map(h => ({
            ...h,
            _dist: (formData.latitude && formData.longitude)
                ? distanceKm(formData.latitude, formData.longitude, h.latitude, h.longitude)
                : null
        }))
        .sort((a, b) => {
            if (a._dist !== null && b._dist !== null) return a._dist - b._dist;
            return (b.bed_availability || 0) - (a.bed_availability || 0);
        });

    const handleConfirmBooking = async () => {
        setBooking(true);
        try {
            const payload = { ...formData, assigned_hospital_id: bookingHospital.hospital_id };
            const res = await axios.post(`${API_URL}/api/incidents`, payload);
            setBookingResult({
                hospital_name: res.data.assigned_hospital_name || bookingHospital.hospital_name,
                distance: res.data.distance_km?.toFixed(1) ?? '—',
            });
            fetchHospitals(); // refresh bed counts
        } catch (err) {
            alert('Booking failed: ' + (err.response?.data?.error || err.message));
        }
        setBooking(false);
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>🆘 Patient / Bystander Portal</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b' }}>Find available hospitals and book in real-time</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* ── Left: Booking Form ── */}
                <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>📋 Search Hospitals</div>

                    {/* Location */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>📍 Your Location</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="e.g. Bandra West"
                                value={formData.location}
                                onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                onBlur={async () => {
                                    if (formData.location && !formData.latitude) {
                                        try {
                                            const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${formData.location}, Mumbai`);
                                            if (res.data?.length > 0) {
                                                const { lat, lon } = res.data[0];
                                                setFormData(p => ({ ...p, latitude: parseFloat(lat), longitude: parseFloat(lon) }));
                                            }
                                        } catch { }
                                    }
                                }}
                                style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }}
                            />
                            <button onClick={handleLiveLocation} disabled={isLocating}
                                style={{ padding: '0.55rem 0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                {isLocating ? '📍...' : '📍 Live'}
                            </button>
                        </div>
                    </div>

                    {/* Patient Count */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>👤 Number of Patients</label>
                        <input
                            type="number" min={1} value={formData.patient_count}
                            onChange={e => setFormData(p => ({ ...p, patient_count: Math.max(1, parseInt(e.target.value) || 1) }))}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>Only hospitals with ≥ this many beds will appear</div>
                    </div>

                    {/* Severity */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>🚑 Severity</label>
                        <select value={formData.severity} onChange={e => setFormData(p => ({ ...p, severity: e.target.value }))}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }}>
                            <option value="Critical">Critical</option>
                            <option value="Moderate">Moderate</option>
                            <option value="Minor">Minor</option>
                        </select>
                    </div>

                    {/* Booking Type */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>🏥 Booking Type</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { val: 'bed_only', icon: '🛏', label: 'Bed Only', desc: 'Patient will arrive independently' },
                                { val: 'ambulance', icon: '🚑', label: 'Bed + Ambulance', desc: 'Dispatch ambulance to your location' },
                            ].map(opt => (
                                <label key={opt.val} style={{ display: 'flex', gap: '0.75rem', padding: '0.65rem 0.85rem', border: `1.5px solid ${formData.booking_type === opt.val ? '#2563eb' : '#e2e8f0'}`, borderRadius: 8, cursor: 'pointer', background: formData.booking_type === opt.val ? '#eff6ff' : 'white' }}>
                                    <input type="radio" name="bt" value={opt.val} checked={formData.booking_type === opt.val} onChange={() => setFormData(p => ({ ...p, booking_type: opt.val }))} style={{ marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{opt.icon} {opt.label}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{opt.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#475569' }}>
                        Showing <strong style={{ color: '#2563eb' }}>{suitableHospitals.length}</strong> of {hospitals.length} hospitals with ≥ {formData.patient_count} bed(s) available.
                    </div>
                </div>

                {/* ── Right: Results + Prediction ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Hospital List */}
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '0.75rem' }}>
                            🏥 Recommended Hospitals — Sorted by {formData.latitude ? 'Distance' : 'Bed Availability'}
                        </div>
                        {suitableHospitals.length === 0 ? (
                            <div style={{ background: 'white', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏨</div>
                                <strong>No hospitals have {formData.patient_count}+ available beds right now.</strong>
                                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Try reducing patient count or check back shortly.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                                {suitableHospitals.map(h => (
                                    <HospitalRecommendCard
                                        key={h.hospital_id}
                                        hospital={h}
                                        userLat={formData.latitude}
                                        userLon={formData.longitude}
                                        patientCount={formData.patient_count}
                                        onBook={setBookingHospital}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Bed Prediction Section */}
                    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
                            <span style={{ fontSize: '1.3rem' }}>🤖</span>
                            <div>
                                <div style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>AI Bed Availability Prediction</div>
                                <div style={{ fontSize: '0.75rem', color: '#bfdbfe' }}>Tomorrow's forecast using LightGBM AI model</div>
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.25rem' }}>
                            {loadingPred ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>⏳ Loading predictions...</div>
                            ) : predictions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>Predictions unavailable. Ensure backend AI model is active.</div>
                            ) : (
                                <>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                                        Showing top predictions for hospitals near you. Higher predicted beds = better availability tomorrow.
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 280, overflowY: 'auto' }}>
                                        {predictions.map(p => {
                                            const trend = p.predicted_beds > p.current_beds ? '📈' : p.predicted_beds < p.current_beds ? '📉' : '➡️';
                                            const trendCol = p.predicted_beds > p.current_beds ? '#16a34a' : p.predicted_beds < p.current_beds ? '#dc2626' : '#64748b';
                                            const predPct = p.total_beds > 0 ? Math.min(100, Math.round(((p.total_beds - p.predicted_beds) / p.total_beds) * 100)) : 0;
                                            return (
                                                <div key={p.hospital_id} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.6rem 0.85rem', background: '#f8fafc', borderRadius: 8 }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.hospital_name}</div>
                                                        <div style={{ height: 5, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginTop: '0.3rem' }}>
                                                            <div style={{ height: '100%', width: `${predPct}%`, background: barColor(predPct), borderRadius: 99 }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Now: <strong>{p.current_beds}</strong></div>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: trendCol }}>{trend} {p.predicted_beds} tomorrow</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Booking Modal */}
            {bookingHospital && (
                <BookingModal
                    hospital={bookingHospital}
                    formData={formData}
                    booking={booking}
                    result={bookingResult}
                    onConfirm={handleConfirmBooking}
                    onClose={() => { setBookingHospital(null); setBookingResult(null); }}
                />
            )}
        </div>
    );
}
