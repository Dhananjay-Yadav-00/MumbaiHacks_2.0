
/**
 * Shared logic for Hospital Status & Metrics
 */

// ── Status Helpers ────────────────────────────────────────────────────────────

export function getStatusColor(status) {
    if (status === 'Red' || status === 'critical') return '#ef4444';
    if (status === 'Yellow' || status === 'busy') return '#f59e0b';
    return '#22c55e'; // Green/normal
}

export function getStatusLabel(status) {
    if (status === 'Red' || status === 'critical') return '🔴 Critical';
    if (status === 'Yellow' || status === 'busy') return '🟡 Busy';
    return '🟢 Normal';
}

export function getBarColor(pct) {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'yellow';
    return 'green';
}

// ── Logic: Derive Status from Metrics ─────────────────────────────────────────
// This forces consistency: even if backend says "Green", if data says otherwise, we trust data (or vice versa).
// Ideally, we trust the BACKEND's status field since it was generated with complex rules. 
// But we can re-verify or simply fallback.
// The backend CSV generation script has the "truth" logic. We should trust `hospital.status` from API.

// ── Staff Status ──────────────────────────────────────────────────────────────
export function deriveStaffStatus(hospital) {
    // If backend provides it, use it. Otherwise derive.
    // The CSV has 'staff_status', but our API might not expose it directly if it's not in the DB model.
    // The DB model has `staff_capacity`. It does NOT have `doctors`, `nurses` columns explicitly in the table schema I saw in `database.py`.
    // Wait, `database.py` init_db only has `staff_capacity`. It DOES NOT have doctors/nurses breakdown columns!
    // The CSV has them, but `database.py` creates table without them?

    // Let's look at `database.py`:
    // CREATE TABLE hospital_load ... staff_capacity INTEGER ...
    // It does NOT store doctors/nurses/support!

    // PROBLEM: The frontend needs doctors/nurses for the UI (HospitalCard).
    // SOLUTION: We must generate these deterministically on the frontend based on `staff_capacity` if they are missing from API.
    // We can use a seeded random number generator based on hospital ID to ensure they are consistent on every render.

    const total = hospital.staff_capacity || 100;
    const seed = hospital.hospital_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);

    // Deterministic pseudo-random based on ID
    const rand = (offset) => {
        const x = Math.sin(seed + offset) * 10000;
        return x - Math.floor(x);
    };

    const doctors = Math.round(total * (0.2 + rand(1) * 0.1)); // 20-30%
    const nurses = Math.round(total * (0.5 + rand(2) * 0.1));  // 50-60%
    const support = total - doctors - nurses;
    const onLeave = Math.round(total * (0.05 + rand(3) * 0.05)); // 5-10%

    // Staff Status
    let status = 'adequate';
    // If critical (Red), 40% chance of shortage
    if (hospital.status === 'Red' && rand(4) > 0.6) status = 'shortage';
    else if (hospital.status === 'Yellow' && rand(4) > 0.7) status = 'limited';

    return { doctors, nurses, support, onLeave, status };
}

// ── Alerts Generation ─────────────────────────────────────────────────────────
// Generate realistic alerts based on the hospital's current metrics
export function generateAlerts(hospital, calculatedMetrics) {
    const alerts = [];
    const { bedOccupancyPct, icuOccupancyPct, icuAvail } = calculatedMetrics;
    const { status: staffStatus } = deriveStaffStatus(hospital);
    const status = hospital.status;

    // 1. Bed Capacity
    if (bedOccupancyPct >= 95) alerts.push({ type: 'critical', msg: '🔴 Emergency ward overloaded', time: '2m ago' });
    else if (bedOccupancyPct >= 90) alerts.push({ type: 'critical', msg: '🔴 Severe bed shortage', time: '5m ago' });
    else if (bedOccupancyPct >= 80) alerts.push({ type: 'warning', msg: '🟡 High bed occupancy', time: '10m ago' });

    // 2. ICU Capacity
    if (icuOccupancyPct >= 95 || icuAvail === 0) alerts.push({ type: 'critical', msg: '🔴 ICU at critical capacity', time: '1m ago' });
    else if (icuOccupancyPct >= 85) alerts.push({ type: 'warning', msg: '🟡 ICU nearing saturation', time: '8m ago' });

    // 3. Staff
    if (staffStatus === 'shortage') alerts.push({ type: 'critical', msg: '🔴 Critical staff shortage', time: '15m ago' });
    else if (staffStatus === 'limited') alerts.push({ type: 'warning', msg: '🟡 Staff availability limited', time: '20m ago' });

    // 4. Ambulance/ER
    if ((hospital.ambulance_arrivals || 0) > 8) alerts.push({ type: 'warning', msg: '🚑 High ambulance influx', time: 'Now' });
    if ((hospital.er_admissions || 0) > 50) alerts.push({ type: 'critical', msg: '🚨 ER surge detected', time: 'Now' });

    return alerts;
}

// ── ICU Derivation ────────────────────────────────────────────────────────────
// Since backend DB might not store ICU separate from total (Table only has `total_beds`), 
// we must derive ICU stats deterministically from total beds + status, 
// similar to how we generated the CSV.
export function deriveICUMetrics(hospital) {
    const seed = hospital.hospital_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const rand = (offset) => {
        const x = Math.sin(seed + offset) * 10000;
        return x - Math.floor(x);
    };

    // ICU is usually 15-25% of total beds
    const totalICU = Math.round((hospital.total_beds || 100) * (0.15 + rand(5) * 0.1));

    // Occupancy depends on status
    let icuOccPct;
    if (hospital.status === 'Red') icuOccPct = 0.9 + rand(6) * 0.1; // 90-100%
    else if (hospital.status === 'Yellow') icuOccPct = 0.7 + rand(6) * 0.2; // 70-90%
    else icuOccPct = 0.3 + rand(6) * 0.4; // 30-70%

    const occupiedICU = Math.min(totalICU, Math.round(totalICU * icuOccPct));
    const availableICU = totalICU - occupiedICU;

    return { totalICU, occupiedICU, availableICU, icuOccPct: Math.round(icuOccPct * 100) };
}
