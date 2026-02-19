import { useState, useEffect } from 'react';

export const useGeocoding = (incident) => {
    const fallback = [19.076, 72.8777]; // Mumbai center
    const [incidentCoords, setIncidentCoords] = useState({
        lat: incident.lat || null,
        lon: incident.lon || null,
    });

    useEffect(() => {
        if (incident.lat && incident.lon) {
            setIncidentCoords({ lat: incident.lat, lon: incident.lon });
            return;
        }

        let isMounted = true;

        (async () => {
            try {
                const query = incident.name || "Bandra, Mumbai, India";
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&viewbox=72.775,19.300,72.990,18.850&bounded=1&q=${encodeURIComponent(
                        query
                    )}`
                );
                const data = await res.json();

                if (isMounted) {
                    if (data && data[0]) {
                        setIncidentCoords({
                            lat: parseFloat(data[0].lat),
                            lon: parseFloat(data[0].lon),
                        });
                    } else {
                        setIncidentCoords({ lat: fallback[0], lon: fallback[1] });
                    }
                }
            } catch {
                if (isMounted) {
                    setIncidentCoords({ lat: fallback[0], lon: fallback[1] });
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [incident]);

    return incidentCoords;
};

export const useHospitalGeocoding = (assignments) => {
    const [processed, setProcessed] = useState([]);

    useEffect(() => {
        let isMounted = true;

        (async () => {
            const results = [];
            const MUMBAI_BOX = {
                minLat: 18.85,
                maxLat: 19.30,
                minLon: 72.77,
                maxLon: 72.99,
            };

            for (const h of assignments) {
                const name = h.hospital_name;
                let lat = h.lat;
                let lon = h.lon;

                // 🌍 Try to geocode if coords missing
                if (!lat || !lon) {
                    const q = encodeURIComponent(name + " Mumbai India");
                    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=1&q=${q}`;
                    try {
                        const res = await fetch(url);
                        const data = await res.json();

                        if (data && data[0]) {
                            lat = parseFloat(data[0].lat);
                            lon = parseFloat(data[0].lon);
                        }
                    } catch (err) {
                        console.error("❌ Geocode failed for", name, err);
                    }
                }

                // 🧭 Validate coordinates → keep only Mumbai area
                if (
                    !lat ||
                    !lon ||
                    lat < MUMBAI_BOX.minLat ||
                    lat > MUMBAI_BOX.maxLat ||
                    lon < MUMBAI_BOX.minLon ||
                    lon > MUMBAI_BOX.maxLon
                ) {
                    console.warn(`⚠️ ${name} returned invalid location, using fallback near Bandra`);
                    lat = 19.076 + (Math.random() - 0.5) * 0.02; // small offset
                    lon = 72.8777 + (Math.random() - 0.5) * 0.02;
                }

                results.push({
                    ...h,
                    lat,
                    lon,
                });
            }

            if (isMounted) {
                setProcessed(results);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [assignments]);

    return processed;
};
