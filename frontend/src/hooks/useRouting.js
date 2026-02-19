import { useState, useEffect } from 'react';

export const useRouting = (incidentCoords, processedHospitals) => {
    const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;
    const [routes, setRoutes] = useState([]);

    useEffect(() => {
        let isMounted = true;

        async function getRoutes() {
            if (!incidentCoords.lat || !incidentCoords.lon || !processedHospitals.length) return;

            const lines = [];
            for (const h of processedHospitals) {
                try {
                    const start = `${incidentCoords.lon},${incidentCoords.lat}`;
                    const end = `${h.lon},${h.lat}`;

                    const res = await fetch(
                        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${start}&end=${end}`
                    );
                    const data = await res.json();

                    // ✅ Ensure we reverse coords properly for Leaflet (which uses [lat, lon])
                    if (data?.features?.[0]?.geometry?.coordinates) {
                        const coords = data.features[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
                        lines.push({
                            name: h.hospital_name,
                            coords,
                        });
                    } else {
                        console.warn("No route data found for:", h.hospital_name);
                    }
                } catch (err) {
                    console.error("Routing error for", h.hospital_name, err);
                }
            }

            if (isMounted) {
                setRoutes(lines);
            }
        }

        getRoutes();

        return () => {
            isMounted = false;
        };
    }, [incidentCoords, processedHospitals, ORS_API_KEY]);

    return routes;
};
