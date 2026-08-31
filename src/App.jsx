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

  // 1. Session Restoration Phase
  if (authInitializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f1d', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: '44px', height: '44px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <p style={{ marginTop: '18px', fontSize: '1rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.02em' }}>
          Restoring secure session...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated Phase
  if (!currentUser) {
    return <LoginModal />;
  }

  // 3. Initial Business Data Hydration Phase (Before Database Data Arrives)
  if (isDataBootstrapping && (!db || !db._hasLoaded)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f1d', color: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: '52px', height: '52px', border: '4px solid rgba(16, 185, 129, 0.2)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <h3 style={{ marginTop: '22px', fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
          Loading production data...
        </h3>
        <p style={{ marginTop: '6px', fontSize: '0.9rem', color: '#64748b' }}>
          Hydrating live freight requirements, master commodities & plant directories
        </p>
        {bootstrapError && (
          <div style={{ marginTop: '20px', padding: '16px 24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#fca5a5', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
              Connection delay: {bootstrapError}
            </p>
            <button
              onClick={() => refreshDB()}
              style={{ padding: '8px 20px', background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              🔄 Retry Data Load
            </button>
          </div>
        )}
      </div>
    );
  }

  // 4. Render Final Authenticated Application
  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: '0 20px 40px 20px' }}>
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
