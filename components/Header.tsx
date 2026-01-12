import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, View } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { t } from '../translations.ts';
import { useStore } from '../services/store';

interface HeaderProps {
  user: User;
  currentView: View;
  setView: (view: View) => void;
  toggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, currentView, setView, toggleSidebar }) => {
  const navigate = useNavigate();
  const { workshopSettings } = useStore();

  const handleNavigateToOS = () => {
    setView('OS');
    navigate('/os');
  };

  return (
    <header className="h-16 border-b border-[#1f1f23] bg-[#09090b] px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {toggleSidebar && (
          <button
            onClick={toggleSidebar}
            className="p-2 text-zinc-400 hover:text-white lg:hidden bg-[#161618] border border-[#1f1f23] rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
          </button>
        )}
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-100 hidden sm:block leading-tight">
            {t('welcome_back')}, {user.name.split(' ')[0]} 👋
          </h2>
          {workshopSettings?.businessName && (
            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest hidden sm:block">
              {workshopSettings.businessName}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-1 bg-[#161618] border border-[#1f1f23] rounded-lg p-0.5">
          <button
            onClick={handleNavigateToOS}
            className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center"
          >
            <ICONS.Plus className="w-3.5 h-3.5 mr-1 md:mr-1.5" /> <span className="hidden xs:inline">{t('new_project')}</span>
          </button>
        </div>

        <button className="p-2 text-zinc-400 hover:text-white bg-[#161618] border border-[#1f1f23] rounded-lg">
          <ICONS.Bell className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-full border border-purple-500/50 p-0.5">
          <img
            src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.name}`}
            alt="User"
            className="w-full h-full rounded-full bg-zinc-800"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
