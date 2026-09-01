import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { TransporterPortal } from './components/TransporterPortal';
import { LoginModal } from './components/LoginModal';
import { Footer } from './components/Footer';
import { resetDB } from './store/dbStore';

import { ErrorBoundary } from './components/ErrorBoundary';

function MainApp() {
  const { currentUser, authInitializing, isDataBootstrapping, bootstrapError, refreshDB, db } = useAuth();

  React.useEffect(() => {
    // 🛡️ Auto-clean query params like ?reset= from address bar so page doesn't re-trigger reset
    if (typeof window !== 'undefined' && window.location.search && (window.location.search.includes('reset=') || window.location.search.includes('sync='))) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  // 1. Session Restoration Phase (only if no session found yet)
  if (authInitializing && !currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f1d', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <p style={{ marginTop: '16px', fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>
          Restoring secure session...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated Phase
  if (!currentUser) {
    return <LoginModal />;
  }

  // 3. Render Final Authenticated Application with Smooth Top Shimmer when hydrating
  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: '0 20px 40px 20px', position: 'relative' }}>
      {isDataBootstrapping && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '3px',
            background: 'linear-gradient(90deg, #38bdf8, #10b981, #c084fc, #38bdf8)',
            backgroundSize: '200% 100%',
            animation: 'shimmerGradient 1.2s linear infinite',
            zIndex: 100000
          }}
        />
      )}
      <Navbar />

      <main>
        {currentUser.role === 'admin' ? (
          <AdminDashboard />
        ) : (
          <TransporterPortal />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
