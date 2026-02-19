// src/components/Dashboard/Dashboard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import './Dashboard.css';

// -- Sub-components can live in the same file for simplicity --

const Header = ({ systemStatus }) => {
  const statusInfo = {
    operational: { text: 'System Operational', color: 'var(--success-color)' },
    warning: { text: 'Degraded Performance', color: '#f59e0b' },
    offline: { text: 'System Offline', color: 'var(--error-color)' },
  };
  const currentStatus = statusInfo[systemStatus] || statusInfo.offline;

  return (
    <header className="dashboard-header">
      <div className="logo">
        <span role="img" aria-label="siren">🚨</span> HealthHive<span>.AI</span>
      </div>
      <div className="system-status">
        <div className="status-indicator" style={{ backgroundColor: currentStatus.color, boxShadow: `0 0 8px ${currentStatus.color}` }}></div>
        <span>{currentStatus.text}</span>
      </div>
    </header>
  );
};

const SystemCapabilities = () => {
  const capabilities = [
    { icon: '🗺️', title: 'Smart Routing', description: 'Calculates optimal hospital assignments via ML.' },
    { icon: '📊', title: 'Predictive Analysis', description: 'Forecasts hospital load to prevent overcrowding.' },
    { icon: '⚙️', title: 'Dynamic Allocation', description: 'Adjusts resources based on incident severity.' },
    { icon: '🔔', title: 'Real-time Alerts', description: 'Sends instant notifications to hospital staff.' },
  ];
  return (
    <div className="widget-card">
      <h3>System Capabilities</h3>
      <ul className="capabilities-list">
        {capabilities.map((item, index) => (
          <li key={index}>
            <div className="capability-icon">{item.icon}</div>
            <div className="capability-text">
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ActivityFeed = () => {
    const activities = [
        { time: '2 min ago', desc: 'New plan generated for incident at Khar West.', icon: '⚡' },
        { time: '15 min ago', desc: 'Resource levels updated for Nanavati Hospital.', icon: '🔄' },
        { time: '28 min ago', desc: 'Traffic data refreshed from live API.', icon: '🚗' },
        { time: '45 min ago', desc: 'Plan generated for 3-patient incident in Dadar.', icon: '⚡' },
    ];
    return (
        <div className="widget-card">
            <h3>Recent Activity</h3>
            <ul className="activity-list">
                {activities.map((activity, index) => (
                    <li key={index}>
                        <div className="activity-icon">{activity.icon}</div>
                        <div className="activity-content">
                            <span className="activity-desc">{activity.desc}</span>
                            <span className="activity-time">{activity.time}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// -- Main Dashboard Component --
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
};


const Dashboard = ({ systemStatus }) => {
  return (
    <motion.div
      className="dashboard-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <motion.div variants={itemVariants}>
        <Header systemStatus={systemStatus} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="welcome-banner">
          <h1>AI Emergency Load Balancer</h1>
          <p>Intelligent resource allocation for emergency medical services using real-time ML predictions.</p>
        </div>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <SystemCapabilities />
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <ActivityFeed />
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;