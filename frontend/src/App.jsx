import { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import './App.css';

// Auth
import { AuthProvider } from './context/AuthContext';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Layout
import DashboardLayout from './components/Layout/DashboardLayout.jsx';

// Pages
import LandingPage from './components/LandingPage/LandingPage.jsx';
import IncidentForm from './components/IncidentForm/IncidentForm.jsx';
import ResultsDisplay from './components/ResultsDisplay/ResultsDisplay.jsx';

// Dashboards
import SystemAdminDashboard from './components/Dashboards/SystemAdminDashboard.jsx';
import HospitalAdminDashboard from './components/Dashboards/HospitalAdminDashboard.jsx';
import DispatcherDashboard from './components/Dashboards/DispatcherDashboard.jsx';
import PatientDashboard from './components/Dashboards/PatientDashboard.jsx';

const API_URL = import.meta.env.VITE_API_URL;

const AnimatedRoutes = () => {
  const [planData, setPlanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemStatus, setSystemStatus] = useState('offline');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!API_URL) { setSystemStatus('offline'); return; }
    axios.get(`${API_URL}/health`, { timeout: 10000 })
      .then(() => setSystemStatus('operational'))
      .catch(() => setSystemStatus('offline'));
  }, []);

  const handleGeneratePlan = async (formData) => {
    setIsLoading(true);
    setError('');
    setPlanData(null);
    navigate('/results');
    try {
      const response = await axios.post(`${API_URL}/generate-plan`, formData, { timeout: 60000 });
      setPlanData(response.data);
    } catch (err) {
      let msg = 'Failed to generate plan. ';
      if (err.code === 'ECONNABORTED') msg += 'Request timed out.';
      else if (err.response) msg += `Server error (${err.response.status}): ${err.response.data?.error || err.response.statusText}`;
      else if (err.request) msg += 'Cannot connect to the backend server.';
      else msg += `Unknown error: ${err.message}`;
      setError(msg);
    } finally { setIsLoading(false); }
  };

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/" element={<LandingPage systemStatus={systemStatus} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/incident" element={<IncidentForm onSubmit={handleGeneratePlan} isLoading={isLoading} />} />
        <Route path="/results" element={<ResultsDisplay data={planData} error={error} isLoading={isLoading} onGoBack={() => { setPlanData(null); setError(''); navigate('/incident'); }} onGoHome={() => { setPlanData(null); setError(''); navigate('/'); }} />} />

        {/* Protected Dashboards */}
        <Route element={<DashboardLayout />}>
          <Route
            path="/system-admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SystemAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hospital-admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hospital']}>
                <HospitalAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatcher"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hospital', 'guest']}>
                <DispatcherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hospital', 'guest']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
            <h1 style={{ fontSize: '3rem', color: '#1e293b' }}>404</h1>
            <p style={{ color: '#64748b' }}>Page not found</p>
            <button style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/')}>Go Home</button>
          </div>
        } />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;