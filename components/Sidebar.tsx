import React from 'react';
import { useNavigate } from 'react-router-dom';
import { View, UserRole } from '../types.ts';
import { ICONS, APP_NAME } from '../constants.tsx';
import { t } from '../translations.ts';
import { useStore } from '../services/store';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  userRole: UserRole;
  onLogout: () => void;
  lowStockCount?: number;
  isOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, userRole, onLogout, lowStockCount = 0, isOpen = false }) => {
  const navigate = useNavigate();
  const { workshopSettings } = useStore();

  const handleNavigation = (view: View) => {
    setView(view);
    navigate(`/${view.toLowerCase()}`);
  };

  const sections = [
    {
      title: 'MAIN',
      items: [
        { id: 'DASHBOARD' as View, label: t('dashboard'), icon: <ICONS.Dashboard className="w-4 h-4" /> },
        { id: 'SALES' as View, label: t('sales'), icon: <ICONS.ShoppingBag className="w-4 h-4" /> },
        { id: 'OS' as View, label: t('os'), icon: <ICONS.Wrench className="w-4 h-4" /> },
      ]
    },
    {
      title: 'RESOURCES',
      items: [
        { id: 'CLIENTS' as View, label: t('clients'), icon: <ICONS.Users className="w-4 h-4" /> },
        { id: 'VEHICLES' as View, label: t('vehicles'), icon: <ICONS.Bike className="w-4 h-4" /> },
        {
          id: 'INVENTORY' as View,
          label: t('inventory'),
          icon: <ICONS.Box className="w-4 h-4" />,
          badge: lowStockCount > 0 ? lowStockCount : undefined
        },
        { id: 'SERVICES' as View, label: t('services'), icon: <ICONS.Wrench className="w-4 h-4" /> },
        { id: 'FINANCIAL' as View, label: t('financial'), icon: <ICONS.Dollar className="w-4 h-4" /> },
      ]
    },
    ...(userRole === UserRole.PLATFORM_ADMIN ? [{
      title: 'SUPER ADMIN',
      items: [
        { id: 'PLATFORM_ADMIN' as View, label: 'ADMINISTRAÇÃO', icon: <ICONS.Dashboard className="w-4 h-4" /> },
      ]
    }] : [])
  ];

  return (
    <aside className={`
      fixed lg:sticky top-0 inset-y-0 left-0 z-50
      w-64 flex flex-col bg-[#0e0e10] border-r border-[#1f1f23] h-screen overflow-y-auto custom-scrollbar
      transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          {workshopSettings?.logoUrl ? (
            <img src={workshopSettings.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded" />
          ) : (
            <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center flex-shrink-0">
              <ICONS.Bike className="text-white w-5 h-5" />
            </div>
          )}
          <span className="font-bold text-sm tracking-tight text-white uppercase truncate">
            {workshopSettings?.businessName || APP_NAME}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-6 mt-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-[10px] font-bold text-zinc-500 mb-2 tracking-widest uppercase">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors rounded-md group ${currentView === item.id
                    ? 'bg-[#1c1c20] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#161618]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </div>
                  {item.badge !== undefined && (
                    <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] flex items-center justify-center shadow-lg shadow-rose-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#1f1f23] space-y-1">
        <button onClick={() => handleNavigation('SETTINGS')} className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${currentView === 'SETTINGS' ? 'bg-[#1c1c20] text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-[#161618]'}`}>
          <ICONS.Settings className="w-4 h-4" /> {t('settings')}
        </button>
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
          <ICONS.LogOut className="w-4 h-4" /> {t('logout')}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
