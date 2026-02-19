import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './ResultsDisplay.css'; // Reuse existing styles or add new ones

const phases = [
    { status: 'Dispatching', message: 'Locating nearest ambulance...', icon: '📡', color: '#f59e0b' },
    { status: 'En Route', message: 'Ambulance is on the way to your location.', icon: '🚑', color: '#3b82f6' },
    { status: 'Arriving', message: 'Ambulance is arriving in less than 2 minutes.', icon: '📍', color: '#8b5cf6' },
    { status: 'On Scene', message: 'Ambulance has arrived at pickup location.', icon: '✅', color: '#22c55e' }
];

const AmbulanceTracker = ({ estimatedTime = 15 }) => {
    const [currentPhase, setCurrentPhase] = useState(0);

    useEffect(() => {
        const times = [2000, 5000, 8000]; // Simulated delays: 2s, 5s, 8s

        let timeouts = [];

        if (currentPhase < 3) {
            const next = currentPhase + 1;
            const delay = times[currentPhase] || 5000;

            const timer = setTimeout(() => {
                setCurrentPhase(next);
            }, delay);
            timeouts.push(timer);
        }

        return () => timeouts.forEach(clearTimeout);
    }, [currentPhase]);

    const phase = phases[currentPhase];
    const progress = ((currentPhase + 1) / phases.length) * 100;

    return (
        <div className="result-card full-width ambulance-tracker" style={{ borderLeft: `6px solid ${phase.color}` }}>
            <div className="tracker-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{phase.icon}</span>
                    Live Ambulance Status
                </h4>
                <div className="live-indicator" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="pulsing-dot" style={{ background: phase.color }}></span>
                    <span style={{ fontWeight: '600', color: phase.color }}>{phase.status}</span>
                </div>
            </div>

            <div className="tracker-progress" style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ height: '100%', background: phase.color }}
                />
            </div>

            <p style={{ margin: 0, fontSize: '1.1rem' }}>{phase.message}</p>

            {currentPhase < 3 && (
                <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                    Estimated Arrival: <strong>{estimatedTime} mins</strong>
                </p>
            )}
        </div>
    );
};

export default AmbulanceTracker;
