import { useState, useMemo } from 'react';
import './IncidentForm.css';

// These are just for the icons, they can stay as they are.
const AlertCircle = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const MapPin = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

// Simplified IncidentForm component
function IncidentForm({ onSubmit, isLoading }) {
  const [location, setLocation] = useState('Bandra');
  const [critical, setCritical] = useState(4);
  const [stable, setStable] = useState(7);
  const [scenario, setScenario] = useState('1');

  // This function now just calls the `onSubmit` prop passed from App.jsx
  const handleSubmit = (e) => {
    e.preventDefault();
    const incidentData = {
      location: location,
      critical_patients: parseInt(critical),
      stable_patients: parseInt(stable),
      scenario: parseInt(scenario),
    };
    onSubmit(incidentData);
  };

  const totalPatients = useMemo(() => (parseInt(critical) || 0) + (parseInt(stable) || 0), [critical, stable]);

  return (
    <div className="page-wrapper incident-form-wrapper">
      <div className="incident-form-banner">
        <div className="banner-icon"><AlertCircle /></div>
        <h2>Emergency Hospital Finder</h2>
        <p>Enter incident details to generate an optimized routing plan.</p>
      </div>
      <div className="card incident-form-card">
        <form onSubmit={handleSubmit}>
          <h3>Incident Details</h3>
          <div className="form-group">
            <label htmlFor="location">Incident Location</label>
            <div className="input-with-icon">
              <MapPin />
              <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Marine Drive" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="critical">Critical Patients</label>
              <div className="input-with-icon">
                <UserIcon />
                <input type="number" id="critical" value={critical} onChange={(e) => setCritical(e.target.value)} min="0" required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="stable">Stable Patients</label>
              <div className="input-with-icon">
                <UserIcon />
                <input type="number" id="stable" value={stable} onChange={(e) => setStable(e.target.value)} min="0" required />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="scenario">Scenario Type</label>
            <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)} required>
              <option value="1">Normal Operations</option>
              <option value="2">Accident (Critical Spike)</option>
              <option value="3">Outbreak (Both Up)</option>
              <option value="4">Festival Crowd (Stable Spike)</option>
            </select>
          </div>
          <div className="total-patients-display">
            Total Patients: <strong>{totalPatients}</strong>
          </div>
          <button type="submit" className="primary-button" disabled={isLoading}>
            {isLoading ? (<>Generating Plan <span className="spinner"></span></>) : ('🚀 Generate Action Plan')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default IncidentForm;