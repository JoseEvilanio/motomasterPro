import { create } from 'zustand';
import { User, Product, View } from '../types';

interface AppState {
    user: User | null;
    currentView: View;
    inventoryList: Product[];
    initializing: boolean;
    isSidebarOpen: boolean;
    workshopSettings: any | null;

    setUser: (user: User | null) => void;
    setCurrentView: (view: View) => void;
    setInventoryList: (list: Product[]) => void;
    setInitializing: (initializing: boolean) => void;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    setWorkshopSettings: (settings: any) => void;
}

export const useStore = create<AppState>((set) => ({
    user: null,
    currentView: 'DASHBOARD',
    inventoryList: [],
    initializing: true,
    isSidebarOpen: false,
    workshopSettings: null,

    setUser: (user) => set({ user }),
    setCurrentView: (currentView) => set({ currentView }),
    setInventoryList: (inventoryList) => set({ inventoryList }),
    setInitializing: (initializing) => set({ initializing }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
    setWorkshopSettings: (workshopSettings) => set({ workshopSettings }),
}));
