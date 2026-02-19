import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export default function ITDashboard() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/logs`);
                setLogs(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchLogs();
    }, []);

    return (
        <div className="dashboard-view">
            <h2>System Logs & Health</h2>
            <div style={{ backgroundColor: '#1e293b', color: '#38bdf8', padding: '1.5rem', borderRadius: '8px', fontFamily: 'monospace' }}>
                {logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: '0.5rem' }}>
                        <span style={{ color: '#94a3b8' }}>[{log.timestamp}]</span>{' '}
                        <span style={{ color: log.level === 'ERROR' ? '#ef4444' : '#22c55e' }}>{log.level}</span>:{' '}
                        {log.message}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px' }}>
                    <h4>Model Accuracy</h4>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>94.2%</div>
                </div>
                <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px' }}>
                    <h4>Uptime</h4>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>99.9%</div>
                </div>
                <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px' }}>
                    <h4>Active Connections</h4>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>42</div>
                </div>
            </div>
        </div>
    );
}
