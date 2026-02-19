import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { deriveICUMetrics, deriveStaffStatus, generateAlerts } from '../hospitalUtils';

const API_URL = import.meta.env.VITE_API_URL;

export function useHospitalData(refreshInterval = 6000) {
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const intervalRef = useRef(null);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/hospitals`);
            const rawData = res.data;

            // Enrich the data with computed fields
            const enriched = rawData.map(h => {
                const totalBeds = h.total_beds || 100;
                const availBeds = h.bed_availability || 0;
                const occupiedBeds = totalBeds - availBeds;
                const bedOccupancyPct = Math.round((occupiedBeds / totalBeds) * 100);

                const icu = deriveICUMetrics(h);
                const staff = deriveStaffStatus(h);

                // Bundle metrics for alert generation
                const metrics = {
                    bedOccupancyPct,
                    icuOccupancyPct: icu.icuOccPct,
                    icuAvail: icu.availableICU
                };

                const alerts = generateAlerts(h, metrics);

                return {
                    ...h,
                    // Bed Stats
                    occupiedBeds,
                    bedOccupancyPct,

                    // ICU Stats (Derived)
                    totalICU: icu.totalICU,
                    occupiedICU: icu.occupiedICU,
                    availableICU: icu.availableICU,
                    icuOccupancyPct: icu.icuOccPct,

                    // Staff Stats (Derived)
                    doctors: staff.doctors,
                    nurses: staff.nurses,
                    support: staff.support,
                    onLeave: staff.onLeave,
                    staffStatus: staff.status,

                    // Alerts
                    alerts
                };
            });

            setHospitals(enriched);
            setLastUpdated(new Date());
            setLoading(false);
            setError(null);
        } catch (err) {
            console.error("Error fetching hospital data:", err);
            setError(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchData, refreshInterval);
        }
        return () => clearInterval(intervalRef.current);
    }, [refreshInterval]);

    return { hospitals, loading, error, lastUpdated, refetch: fetchData };
}
