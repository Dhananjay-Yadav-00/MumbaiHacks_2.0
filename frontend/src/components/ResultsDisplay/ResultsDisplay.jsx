import React from "react";
import { useLocation } from "react-router-dom";
import "./ResultsDisplay.css";
import MapDisplay from "../MapDisplay/MapDisplay";
import AmbulanceTracker from "./AmbulanceTracker";

// Utility to group staff actions
const groupActionsByHospital = (actions) => {
  if (!actions || !Array.isArray(actions)) return {};
  return actions.reduce((acc, action) => {
    const hospitalName = `${action.hospital_name} (${action.hospital_id})`;
    if (!acc[hospitalName]) acc[hospitalName] = [];
    let cleanAction = action.action
      .replace(`at ${action.hospital_name} (${action.hospital_id})`, "")
      .replace(`to ${action.hospital_name}`, "");
    acc[hospitalName].push(cleanAction.trim());
    return acc;
  }, {});
};

const ResultsDisplay = ({ data, error, isLoading, onGoBack, onGoHome }) => {
  const location = useLocation();
  const resultsData = location.state?.results || data;

  if (isLoading) {
    return (
      <div className="results-loading">
        <div className="spinner large"></div>
        <h2>Generating Action Plan...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-error">
        <h2>Error Generating Plan</h2>
        <p>{error}</p>
        <button className="primary-button" onClick={onGoBack}>
          ← Try Again
        </button>
      </div>
    );
  }

  if (!resultsData) {
    return (
      <div className="results-error">
        <h2>No Data Available</h2>
        <p>Please try generating the plan again.</p>
      </div>
    );
  }

  const incident_location = resultsData.incident_location || "Unknown";
  const total_critical = resultsData.total_critical || 0;
  const total_stable = resultsData.total_stable || 0;
  const total_patients = total_critical + total_stable;
  const scenario = resultsData.scenario || "Unknown";

  const action_plan = resultsData.action_plan || {};
  const ambulance_dispatch = action_plan.ambulance_dispatch || [];
  const hospital_alerts = action_plan.hospital_alerts || [];
  const staff_actions = action_plan.staff_actions || [];
  const public_advisory = action_plan.public_advisory || "";
  const groupedStaffActions = groupActionsByHospital(staff_actions);

  // --- NEW: Get the decision rationale data safely ---
  const decision_rationale = action_plan.decision_rationale || [];

  return (
    <>
      <div className="results-container">
        {/* Header */}
        <div className="results-header-card">
          <button className="back-button" onClick={onGoBack}>
            ← New Report
          </button>
          <h3>Action Plan Generated</h3>
          <p>
            Incident at <strong>{incident_location}</strong> involving{" "}
            <strong>{total_patients}</strong> patients.
          </p>
          <p className="scenario-line">
            Scenario: <strong>{scenario}</strong> | Critical:{" "}
            <strong>{total_critical}</strong> | Stable:{" "}
            <strong>{total_stable}</strong>
          </p>
        </div>

        {/* --- NEW: Ambulance Tracker --- */}
        {ambulance_dispatch.length > 0 && (
          <AmbulanceTracker estimatedTime={parseFloat(ambulance_dispatch[0].travel_min || 15).toFixed(0)} />
        )}

        {/* --- NEW: Decision Rationale Card --- */}
        {decision_rationale.length > 0 && (
          <div className="result-card full-width rationale-card">
            <h4>🧠 Decision Rationale</h4>
            <p className="rationale-subtitle">
              The AI's top choices based on a combined score of travel time, capacity, and predicted surge. <strong>Lower scores are better.</strong>
            </p>
            <ul className="rationale-list">
              {decision_rationale.map((hospital) => (
                <li key={hospital.hospital_id} className="rationale-item">
                  <span className="hospital-name">{hospital.hospital_name} ({hospital.hospital_id})</span>
                  <span className="hospital-score">Score: {hospital.total_score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dispatch & Alerts */}
        <div className="results-grid">
          <div className="result-card">
            <h4>🚑 Ambulance Dispatch</h4>
            <ul>
              {ambulance_dispatch.length ? (
                ambulance_dispatch.map((d, i) => (
                  <li key={i}>
                    <strong>
                      {d.hospital_name} ({d.hospital_id})
                    </strong>
                    <div>
                      <span className="critical">{d.critical} critical</span> •{" "}
                      <span>{d.stable} stable</span>
                    </div>
                    <div className="details">
                      ~{parseFloat(d.distance_km).toFixed(1)} km •{" "}
                      ~{parseFloat(d.travel_min).toFixed(0)} min
                    </div>
                  </li>
                ))
              ) : (
                <li>No dispatch required</li>
              )}
            </ul>
          </div>

          <div className="result-card">
            <h4>🏥 Hospital Alerts</h4>
            <ul>
              {hospital_alerts.length ? (
                hospital_alerts.map((a, i) => <li key={i}>{a.message || a}</li>)
              ) : (
                <li>No alerts</li>
              )}
            </ul>
          </div>
        </div>

        {/* Staff Actions */}
        {Object.keys(groupedStaffActions).length > 0 && (
          <div className="result-card full-width">
            <h4>👨‍⚕️ Staff & Resource Actions</h4>
            <div className="action-groups">
              {Object.entries(groupedStaffActions).map(([name, actions]) => (
                <div key={name} className="action-group">
                  <h5>{name}</h5>
                  <ul>
                    {actions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public Advisory */}
        {public_advisory && (
          <div className="result-card full-width">
            <h4>📢 Public Advisory</h4>
            <p className="advisory-text">{public_advisory}</p>
          </div>
        )}
      </div>

      {/* Full-width Map */}
      {resultsData && (
        <section className="map-section">
          <h4 className="map-title">🗺️ Geospatial View</h4>
          <div className="map-wrapper">
            <MapDisplay
              incident={{
                name:
                  resultsData.action_plan?.summary?.incident_location ||
                  resultsData.incident_location ||
                  "Unknown",
                lat: resultsData.incident_lat,
                lon: resultsData.incident_lon,
              }}
              assignments={
                resultsData.assignments ||
                resultsData.action_plan?.ambulance_dispatch ||
                []
              }
            />
          </div>
        </section>
      )}
    </>
  );
};

export default ResultsDisplay;
