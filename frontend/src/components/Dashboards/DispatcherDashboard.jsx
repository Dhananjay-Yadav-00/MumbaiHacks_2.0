import { useState, useEffect } from 'react';
import axios from 'axios';
import MapDisplay from '../MapDisplay/MapDisplay';

const API_URL = import.meta.env.VITE_API_URL;

export default function DispatcherDashboard() {
    const [hospitals, setHospitals] = useState([]);
    const [incident, setIncident] = useState({
        name: "Waiting for Incident...",
        lat: null,
        lon: null,
        assigned_hospital_id: null
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Hospitals
                const resHospitals = await axios.get(`${API_URL}/api/hospitals`);
                let mapData = resHospitals.data.map(h => ({
                    hospital_id: h.hospital_id, // Ensure ID is passed
                    hospital_name: h.hospital_name,
                    lat: h.latitude,
                    lon: h.longitude,
                    assigned_critical: h.er_admissions,
                    assigned_stable: h.bed_availability
                }));

                // Fetch Latest Incident
                const resIncident = await axios.get(`${API_URL}/api/incidents/latest`);

                if (resIncident.data && resIncident.data.latitude && resIncident.data.longitude) {
                    setIncident({
                        name: `Incident #${resIncident.data.id}`,
                        lat: resIncident.data.latitude,
                        lon: resIncident.data.longitude,
                        assigned_hospital_id: resIncident.data.assigned_hospital_id
                    });

                    // Filter Logic: Show Assigned + Top 2 Nearest
                    const { latitude: iLat, longitude: iLon, assigned_hospital_id } = resIncident.data;

                    // Calculate distances
                    const withDist = mapData.map(h => {
                        const dLat = (h.lat - iLat) * (Math.PI / 180);
                        const dLon = (h.lon - iLon) * (Math.PI / 180);
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(iLat * (Math.PI / 180)) * Math.cos(h.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const d = 6371 * c;
                        return { ...h, distance: d };
                    });

                    // Sort by distance
                    withDist.sort((a, b) => a.distance - b.distance);

                    // Find assigned
                    const assigned = withDist.find(h => h.hospital_id === assigned_hospital_id);

                    // Get top 2 others (excluding assigned)
                    const others = withDist.filter(h => h.hospital_id !== assigned_hospital_id).slice(0, 2);

                    // Combine
                    const final = assigned ? [assigned, ...others] : withDist.slice(0, 3);

                    setHospitals(final);
                } else {
                    setIncident({
                        name: "Waiting for Incident...",
                        lat: null,
                        lon: null,
                        assigned_hospital_id: null
                    });
                    setHospitals(mapData); // Show all if no active incident
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>🚑 Live Dispatch Map</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                        <span>Optimal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#eab308' }}></span>
                        <span>Busy</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                        <span>Overloaded</span>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <MapDisplay
                    incident={incident}
                    assignments={hospitals}
                    assignedHospitalId={incident.assigned_hospital_id}
                />
            </div>

            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3>Active Routes</h3>
                <p>Tracking {hospitals.length} hospitals. Map updates in real-time.</p>
            </div>
        </div>
    );
}
