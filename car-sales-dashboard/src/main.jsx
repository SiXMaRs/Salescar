import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import App from './App';
import SalesReport from './Salesreport.jsx';

function NavBar() {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1A1F2E', borderRadius: 16, padding: '6px',
      display: 'flex', gap: 6, zIndex: 100,
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <NavLink 
        to="/" 
        style={({ isActive }) => ({
          ...navLinkBaseStyle,
          background: isActive ? '#0052A5' : 'transparent',
          color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
        })}
      >
        <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 13 }}></i>
        อัปโหลด PDF
      </NavLink>

      <NavLink 
        to="/report" 
        style={({ isActive }) => ({
          ...navLinkBaseStyle,
          background: isActive ? '#0052A5' : 'transparent',
          color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
        })}
      >
        <i className="fa-solid fa-chart-line" style={{ fontSize: 13 }}></i>
        รายงานยอดขาย
      </NavLink>
    </div>
  );
}

const navLinkBaseStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '10px 20px', borderRadius: 12,
  fontSize: 13, fontWeight: 600,
  textDecoration: 'none', transition: 'all 0.2s ease',
  fontFamily: "'Sarabun', sans-serif",
};

// ── Root ────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* เพิ่มฟอนต์และ Icon ที่จำเป็น */}
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <NavBar />

      <Routes>
        <Route path="/"       element={<App />} />
        <Route path="/report" element={<SalesReport />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);