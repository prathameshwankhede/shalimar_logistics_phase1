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
  const { currentUser } = useAuth();

  React.useEffect(() => {
    // 🛡️ Auto-clean query params like ?reset= from address bar so page doesn't re-trigger reset
    if (typeof window !== 'undefined' && window.location.search && (window.location.search.includes('reset=') || window.location.search.includes('sync='))) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  if (!currentUser) {
    return <LoginModal />;
  }

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
