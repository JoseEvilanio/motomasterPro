import React, { useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import PlatformAdminView from './components/PlatformAdminView.tsx';

import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import MechanicRegistration from './components/MechanicRegistration.tsx';
import MechanicDashboard from './components/MechanicDashboard.tsx';
import { auth, db } from './services/firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  const navigate = useNavigate();
  const isJoinRoute = location.pathname.startsWith('/join/');

  useEffect(() => {
    if (!user) return;

    // Determine which ownerId to use based on role
    const targetOwnerId = user.role === UserRole.MECHANIC ? user.ownerId : user.id;

    if (!targetOwnerId) {
      console.warn("User has no ownerId or id, skipping settings fetch");
      return;
    }

    const qSettings = query(collection(db, 'settings'), where('ownerId', '==', targetOwnerId));
    const unsubscribe = onSnapshot(qSettings, (snapshot) => {
      if (!snapshot.empty) {
        setWorkshopSettings(snapshot.docs[0].data());
      }
    });
    return () => unsubscribe();
  }, [user?.id, user?.ownerId, user?.role]);

  useEffect(() => {
    let unsubscribeMechanicListener: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const checkRoles = async () => {
          // 1. Check if Mechanic
          const mechanicQuery = query(collection(db, 'mechanics'), where('userId', '==', firebaseUser.uid));
          const mechanicSnap = await getDocs(mechanicQuery);

          // Base Sync Data
          const syncData: any = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            lastLogin: serverTimestamp(),
          };

          if (!mechanicSnap.empty) {
            const mData = mechanicSnap.docs[0].data();
            const mechanicUser = {
              id: firebaseUser.uid,
              name: mData.name,
              email: firebaseUser.email || '',
              role: UserRole.MECHANIC,
              ownerId: mData.ownerId
            };
            setUser(mechanicUser);
            // Sync Mechanic
            syncData.name = mData.name;
            syncData.role = UserRole.MECHANIC;
            syncData.ownerId = mData.ownerId;
          } else if (firebaseUser.email === 'jose_evilanio@hotmail.com') {
            const superAdmin = {
              id: firebaseUser.uid,
              name: "Super Admin",
              email: firebaseUser.email,
              role: UserRole.PLATFORM_ADMIN
            };
            setUser(superAdmin);
            // Sync Super Admin
            syncData.name = "Super Admin";
            syncData.role = UserRole.PLATFORM_ADMIN;
          } else {
            const adminUser = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: UserRole.ADMIN
            };
            setUser(adminUser);
            // Sync Admin
            syncData.role = UserRole.ADMIN;
          }

          // Persistent syncing to 'users' collection for ALL users
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), syncData, { merge: true });
          } catch (syncError) {
            console.error("Error syncing user data to Firestore:", syncError);
          }

          setInitializing(false);
        };

        checkRoles();

        // 2. Setup Real-time Profile Listener to catch blocking/updates
        const unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Since store.setUser doesn't support functional update, we merge with current user from store
            const currentUser = useStore.getState().user;
            setUser({ ...(currentUser || {}), ...data } as any);
          }
        });

        unsubscribeMechanicListener = unsubscribeProfile;
      } else {
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
    if (['DASHBOARD', 'CLIENTS', 'VEHICLES', 'OS', 'INVENTORY', 'SERVICES', 'FINANCIAL', 'SETTINGS', 'SALES', 'PLATFORM_ADMIN'].includes(path)) {
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
      navigate('/'); // Redirect to safe path on logout
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

  // Block Access if User or Workshop is Inactive
  const isBlocked = user.role !== UserRole.PLATFORM_ADMIN && (user.isActive === false || (workshopSettings && workshopSettings.isActive === false));

  if (isBlocked) {
    return (
      <div className="fixed inset-0 bg-[#09090b] z-[9999] flex items-center justify-center p-6 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900 blur-[120px] rounded-full" />
        </div>

        <div className="relative w-full max-w-md bg-[#1c1c20]/40 backdrop-blur-xl border border-red-500/20 rounded-[2.5rem] p-10 text-center space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl mx-auto flex items-center justify-center border border-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Acesso Bloqueado</h2>
            <p className="text-zinc-400 text-sm">Sua conta ou oficina foi temporariamente suspensa por um administrador da plataforma.</p>
          </div>

          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
            <p className="text-xs text-red-400 font-bold">Por favor, entre em contato com o suporte para regularizar seu acesso.</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-4 bg-white text-black text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all active:scale-95"
          >
            Sair do Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden">
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
                  {/* Protected Admin Route */}
                  <Route
                    path="/platform_admin"
                    element={user.role === UserRole.PLATFORM_ADMIN ? <PlatformAdminView user={user} /> : <Navigate to="/dashboard" replace />}
                  />
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
