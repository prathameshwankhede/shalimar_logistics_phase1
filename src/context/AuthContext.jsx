// src/context/AuthContext.jsx
// Bulletproof Multi-Tenant Authentication & Transporter Resolution Engine 🛡️⚡

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loadDB,
  loadDBFromSupabase,
  saveDB,
  resetDB as resetStoreDB,
  setAuthToken,
  getAuthToken
} from '../store/dbStore';

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

const USER_SESSION_KEY = 'transflow_current_user';
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [db, setDb] = useState(() => loadDB());
  const [authInitializing, setAuthInitializing] = useState(true);
  const [isDataBootstrapping, setIsDataBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(null);

  // Restore current user session safely
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const storedStr = sessionStorage.getItem(USER_SESSION_KEY) || localStorage.getItem(USER_SESSION_KEY);
      if (storedStr) {
        const parsed = JSON.parse(storedStr);
        if (parsed && (parsed.username || parsed.id)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to restore user session', e);
    }
    return null;
  });

  // Centralized Application Data Bootstrap Function
  const initializeApplicationData = async (options = {}) => {
    try {
      setIsDataBootstrapping(true);
      setBootstrapError(null);
      const freshDb = await loadDBFromSupabase(options);
      if (freshDb) {
        setDb(freshDb);
        setBootstrapError(null);
        console.log('🎉 [BOOTSTRAP] Complete');
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('transflow_live_sync_v1');
            bc.postMessage({ type: 'SYNC_DB', timestamp: Date.now() });
            bc.close();
          } catch (e) {}
        }
      }
      return freshDb;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('❌ [BOOTSTRAP] Initialization error:', e.message);
        setBootstrapError(e.message);
      }
      return null;
    } finally {
      setIsDataBootstrapping(false);
    }
  };

  // Structured Application Lifecycle Bootstrap Sequence
  useEffect(() => {
    let isMounted = true;

    async function runBootstrapSequence() {
      console.log('🚀 [BOOTSTRAP] Starting application initialization');
      console.log('🔑 [AUTH] Restoring session');

      let restoredUser = null;
      try {
        const storedStr = sessionStorage.getItem(USER_SESSION_KEY) || localStorage.getItem(USER_SESSION_KEY);
        if (storedStr) {
          restoredUser = JSON.parse(storedStr);
        }
      } catch (e) {
        console.error('Session parsing error:', e);
      }

      const token = getAuthToken();

      if (restoredUser && token) {
        console.log(`✅ [AUTH] Session restored successfully: ${restoredUser.username} (${restoredUser.role})`);
        if (isMounted) {
          setCurrentUser(restoredUser);
          setAuthInitializing(false);
        }
        await initializeApplicationData();
      } else {
        console.log('ℹ️ [AUTH] No active session found');
        if (isMounted) {
          setCurrentUser(null);
          setAuthInitializing(false);
          setIsDataBootstrapping(false);
        }
      }
    }

    runBootstrapSequence();

    // Safe typing detection to prevent background synchronization from clobbering active form inputs 🛡️
    const isUserActivelyTyping = () => {
      if (typeof document === 'undefined') return false;
      const active = document.activeElement;
      if (!active) return false;
      const tag = (active.tagName || '').toUpperCase();
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || active.isContentEditable;
    };

    const safeApplyFreshData = (freshData) => {
      if (!freshData || !isMounted) return;
      if (isUserActivelyTyping()) {
        // Postpone state swap so user typing and focus are strictly preserved
        setTimeout(() => {
          if (isMounted && !isUserActivelyTyping()) {
            setDb(freshData);
          }
        }, 4000);
        return;
      }
      setDb(freshData);
    };

    // Listen to Storage & BroadcastChannel for real-time background sync
    let debounceTimer = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted && getAuthToken()) {
          loadDBFromSupabase().then((data) => {
            safeApplyFreshData(data);
          }).catch(() => {});
        }
      }, 1500);
    };

    const handleStorageChange = (e) => {
      if (!e.key || e.key.includes('transflow')) {
        debouncedFetch();
      }
    };

    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('transflow_live_sync_v1');
        bc.onmessage = (msg) => {
          if (msg?.data?.type === 'SYNC_DB') {
            debouncedFetch();
          }
        };
      } catch (e) {}
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (getAuthToken() && !isUserActivelyTyping()) {
        loadDBFromSupabase().then((data) => {
          safeApplyFreshData(data);
        }).catch(() => {});
      }
    }, 45000);

    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, []);

  // Save session state
  useEffect(() => {
    if (currentUser) {
      try {
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
      } catch (e) {
        console.error('Failed to save session token', e);
      }
    } else {
      sessionStorage.removeItem(USER_SESSION_KEY);
      localStorage.removeItem(USER_SESSION_KEY);
    }
  }, [currentUser]);

  const refreshRequirements = async (options = {}) => {
    return await initializeApplicationData(options);
  };

  const refreshDB = async (options = {}) => {
    return await initializeApplicationData(options);
  };

  const addSecurityLog = (targetDb, action, username, role, status = 'AUTHENTICATED 🛡️') => {
    const newLog = {
      id: `sec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      action,
      username: username || 'Guest',
      role: role || 'user',
      ip: '192.168.1.105 (Secure MIDC Network)',
      status,
      timestamp: new Date().toISOString()
    };
    const logs = [newLog, ...(targetDb?.security_audit_logs || [])].slice(0, 100);
    return { ...(targetDb || {}), security_audit_logs: logs };
  };

const updateLocalRateSubmission = (savedBid) => {
  if (!savedBid) return;
  setDb((prevDb) => {
    const list = Array.isArray(prevDb?.rate_submissions) ? prevDb.rate_submissions : [];
    const existingIndex = list.findIndex(
      (bid) =>
        String(bid.id) === String(savedBid.id) ||
        (
          String(bid.requirement_id) === String(savedBid.requirement_id) &&
          String(bid.item_id || 'MAIN') === String(savedBid.item_id || 'MAIN') &&
          String(bid.transporter_id) === String(savedBid.transporter_id)
        )
    );

    let updated;
    if (existingIndex >= 0) {
      updated = [...list];
      updated[existingIndex] = { ...updated[existingIndex], ...savedBid };
    } else {
      updated = [savedBid, ...list];
    }

    return { ...(prevDb || {}), rate_submissions: updated };
  });
};

const updateDB = async (newDb) => {
  if (!newDb) return;
  
  setDb(newDb);

  try {
    await saveDB(newDb);
  } catch (e) {
    console.error('MySQL save failed in updateDB:', e);
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('transflow_live_sync_v1');
      bc.postMessage({ type: 'SYNC_DB', timestamp: Date.now() });
      bc.close();
    }
  } catch (e) {
    // ignore
  }

  // ⚡ Immediately re-fetch fresh MySQL state after mutation
  await refreshRequirements();
};

  const login = async (username, password) => {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });

      const json = await res.json();
      if (res.ok && json.success && json.user) {
        setAuthToken(json.token);
        setCurrentUser(json.user);
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(json.user));
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(json.user));
        refreshRequirements();
        return { success: true, user: json.user };
      } else {
        return { success: false, error: json.error || 'Invalid Username or Password' };
      }
    } catch (err) {
      console.error('Login API Error:', err.message);
      return { success: false, error: err.message || 'Login connection error' };
    }
  };

  const quickSwitchUser = async (username) => {
    const cleanUser = String(username || '').trim();
    if (!cleanUser) return false;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/switch-transporter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token && data.user) {
        setAuthToken(data.token);
        setCurrentUser(data.user);
        sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(data.user));
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(data.user));

        let currentDb = db;
        const updatedWithLog = addSecurityLog(
          currentDb,
          `QUICK_SWITCH_ROLE (TRANSPORTER - ${data.user.username})`,
          data.user.username,
          'transporter',
          'SWITCHED 🛡️'
        );
        updateDB(updatedWithLog);
        return true;
      }
    } catch (e) {
      console.warn('Backend switch-transporter error:', e.message);
    }

    let currentDb = db;
    let found = (currentDb.users || []).find((u) => u.username === cleanUser);
    if (!found) {
      const transporter = currentDb.transporters?.find((t) => t.username === cleanUser || t.code === cleanUser || t.id === cleanUser);
      if (transporter) {
        found = {
          id: transporter.id,
          username: transporter.username || transporter.code,
          name: transporter.company_name,
          role: 'transporter',
          transporter_id: transporter.id
        };
      }
    }

    if (found) {
      setCurrentUser(found);
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(found));
      return true;
    }
    return false;
  };

  const logout = () => {
    if (currentUser) {
      let currentDb = db;
      const updatedWithLog = addSecurityLog(
        currentDb,
        `USER_LOGOUT`,
        currentUser.username,
        currentUser.role,
        'LOGGED_OUT 🔒'
      );
      updateDB(updatedWithLog);
    }
    setAuthToken(null);
    setCurrentUser(null);
    sessionStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(USER_SESSION_KEY);
  };

  const resetAllData = () => {
    const initial = resetStoreDB();
    const adminUser = initial.users.find((u) => u.role === 'admin');
    const updatedWithLog = addSecurityLog(
      initial,
      `DATABASE_RESET_SEED`,
      adminUser?.username || 'admin',
      'admin',
      'RESET_CLEARED 🛡️'
    );
    updateDB(updatedWithLog);
    setCurrentUser(null);
    sessionStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(USER_SESSION_KEY);
  };

  // 🛡️ BULLETPROOF TRANSPORTER RESOLUTION ENGINE
  let currentTransporter = null;
  if (currentUser) {
    if (currentUser.role === 'transporter' || currentUser.transporter_id) {
      currentTransporter = (db.transporters || []).find(
        (t) =>
          (currentUser.transporter_id && t.id === currentUser.transporter_id) ||
          (currentUser.username && t.username && t.username.toLowerCase() === (currentUser?.username || "").toLowerCase()) ||
          (currentUser.username && t.code && t.code.toLowerCase() === (currentUser?.username || "").toLowerCase()) ||
          (currentUser.id && t.id === currentUser.id)
      );

      if (!currentTransporter && currentUser.username) {
        currentTransporter = {
          id: currentUser.transporter_id || `trans_${(currentUser?.username || "").toLowerCase()}`,
          company_name: currentUser.name || `${currentUser.username} Logistics Pvt Ltd`,
          code: (currentUser?.username || "").toUpperCase(),
          contact_person: currentUser.name || 'Logistics Incharge',
          mobile: '+91 98230 11223',
          email: `${(currentUser?.username || "").toLowerCase()}@transporter.com`,
          address: 'MIDC Transport Hub, Maharashtra',
          gst_pan: '27AAPCS1419M1ZV',
          username: currentUser.username,
          status: 'Active'
        };
      }
    } else if (currentUser.role === 'admin') {
      currentTransporter = (db.transporters || [])[0] || {
        id: 'trans_s001',
        company_name: 'Shalimar Express Logistics (Admin Test)',
        code: 'S001',
        contact_person: 'Logistics Desk',
        mobile: '+91 98230 11223'
      };
    }
  }

  return (
    <AuthContext.Provider
      value={{
        db,
        currentUser,
        currentTransporter,
        authInitializing,
        isDataBootstrapping,
        bootstrapError,
        initializeApplicationData,
        login,
        quickSwitchUser,
        logout,
        refreshDB,
        refreshRequirements,
        updateDB,
        updateLocalRateSubmission,
        resetAllData,
        addSecurityLog
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
