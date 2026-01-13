import React, { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserRole, Product, View } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import ClientList from './components/ClientList.tsx';
import OSManagement from './components/OSManagement';
import SalesManagement from './components/SalesManagement';
import InventoryList from './components/InventoryList.tsx';
import FinancialView from './components/FinancialView.tsx';
import SettingsView from './components/SettingsView.tsx';
import VehiclesView from './components/VehiclesView.tsx';
import ServicesView from './components/ServicesView.tsx';

import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import MechanicRegistration from './components/MechanicRegistration.tsx';
import MechanicDashboard from './components/MechanicDashboard.tsx';
import { auth, db } from './services/firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useStore } from './services/store';
import { Toaster } from 'sonner';

const App: React.FC = () => {
  const {
    user, setUser,
    inventoryList, setInventoryList,
    initializing, setInitializing,
    isSidebarOpen, toggleSidebar, setSidebarOpen,
    currentView, setCurrentView,
    workshopSettings, setWorkshopSettings
  } = useStore();

  const location = useLocation();
  const isJoinRoute = location.pathname.startsWith('/join/');

  useEffect(() => {
    if (!user) return;
    const qSettings = query(collection(db, 'settings'), where('ownerId', '==', user.role === UserRole.ADMIN ? user.id : user.ownerId));
    const unsubscribe = onSnapshot(qSettings, (snapshot) => {
      if (!snapshot.empty) {
        setWorkshopSettings(snapshot.docs[0].data());
      }
    });
    return () => unsubscribe();
  }, [user?.id, user?.ownerId]);

  useEffect(() => {
    let unsubscribeMechanicListener: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Initial setup with default role, but DO NOT stop initializing yet strictly for the role part? 
        // We can set user immediately, and let the listener update the role.

        // Setup listener for roles (Mechanic or Client)
        const checkRoles = async () => {
          // 1. Check if Mechanic
          const mechanicQuery = query(collection(db, 'mechanics'), where('userId', '==', firebaseUser.uid));
          const mechanicSnap = await getDocs(mechanicQuery);

          if (!mechanicSnap.empty) {
            const mData = mechanicSnap.docs[0].data();
            setUser({
              id: firebaseUser.uid,
              name: mData.name,
              email: firebaseUser.email || '',
              role: UserRole.MECHANIC,
              ownerId: mData.ownerId
            });
            setInitializing(false);
            return;
          }


          // 3. Default to ADMIN (Workshop Owner)
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role: UserRole.ADMIN
          });
          setInitializing(false);
        };

        checkRoles();

      } else {
        if (unsubscribeMechanicListener) unsubscribeMechanicListener();
        setUser(null);
        setInitializing(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMechanicListener) unsubscribeMechanicListener();
    };
  }, [setUser, setInitializing]);

  useEffect(() => {
    // Only fetch main inventory if ADMIN. Mechanics fetch on demand or in their dashboard.
    if (!user || user.role !== UserRole.ADMIN) return;

    // Admins are owners of their products
    const q = query(collection(db, 'products'), where('ownerId', '==', user.id));
    const unsubscribeInventory = onSnapshot(q, (snapshot) => {
      setInventoryList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    }, (error) => {
      console.error("Error reading inventory:", error);
    });
    return () => unsubscribeInventory();
  }, [user, setInventoryList]);

  // Sincronizar visualização atual com a rota
  useEffect(() => {
    const path = location.pathname.slice(1).toUpperCase() || 'DASHBOARD';
    if (['DASHBOARD', 'CLIENTS', 'VEHICLES', 'OS', 'INVENTORY', 'SERVICES', 'FINANCIAL', 'SETTINGS', 'SALES'].includes(path)) {
      setCurrentView(path as View);
    }
  }, [location, setCurrentView]);

  const lowStockCount = useMemo(() => {
    return inventoryList.filter(p => p.stock <= p.minStock).length;
  }, [inventoryList]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  if (initializing) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
    </div>
  );


  if (!user || isJoinRoute) return (
    <Routes>
      <Route path="/join/:orgId" element={<MechanicRegistration />} />
      <Route path="*" element={!user ? <AuthScreen onLogin={setUser} /> : <Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <div className="flex min-h-screen bg-[#09090b] text-white overflow-hidden">
      <Toaster position="top-right" theme="dark" richColors />

      {user.role === UserRole.MECHANIC ? (
        <div className="flex-1 w-full overflow-y-auto custom-scrollbar">
          <div className="flex justify-end p-4 absolute top-0 right-0 z-50">
            <button onClick={handleLogout} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-red-500/20 transition-colors">Sair</button>
          </div>
          <Routes>
            <Route path="/" element={<MechanicDashboard user={user} />} />
            <Route path="/mechanic-dashboard" element={<MechanicDashboard user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      ) : (
        <>
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <Sidebar
            currentView={currentView}
            setView={(v) => { setCurrentView(v); setSidebarOpen(false); }}
            userRole={user.role}
            onLogout={handleLogout}
            lowStockCount={lowStockCount}
            isOpen={isSidebarOpen}
          />

          <div className="flex-1 flex flex-col min-w-0">
            <Header
              user={user}
              currentView={currentView}
              setView={setCurrentView}
              toggleSidebar={toggleSidebar}
            />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth">
              <div className="max-w-7xl mx-auto">
                <Routes>
                  <Route path="/" element={<Dashboard user={user} />} />
                  <Route path="/dashboard" element={<Dashboard user={user} />} />
                  <Route path="/clients" element={<ClientList user={user} />} />
                  <Route path="/vehicles" element={<VehiclesView user={user} />} />
                  <Route path="/sales" element={<SalesManagement user={user} />} />
                  <Route path="/os" element={<OSManagement user={user} />} />
                  <Route path="/inventory" element={<InventoryList user={user} />} />
                  <Route path="/services" element={<ServicesView user={user} />} />
                  <Route path="/financial" element={<FinancialView user={user} />} />
                  <Route path="/settings" element={<SettingsView user={user} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
