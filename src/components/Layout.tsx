import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Bot, 
  ClipboardList, 
  Trophy, 
  LogOut, 
  Bell,
  Menu,
  X
} from 'lucide-react';
import Dashboard from './Dashboard';
import NourixAssistant from './NourixAssistant';
import PlanGenerator from './PlanGenerator';
import Rewards from './Rewards';
import { User } from '../utils';
import { requestNotificationPermission } from '../services/notifications';

interface AppLayoutProps {
  user: User;
  onLogout: () => void;
}

export default function AppLayout({ user, onLogout }: AppLayoutProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [points, setPoints] = useState(user.points);

  useEffect(() => {
    // Refresh points periodically
    const interval = setInterval(() => {
      fetch(`/api/user/${user.id}/stats`)
        .then(res => res.json())
        .then(data => {
          if (data.user) setPoints(data.user.points);
        });
    }, 10000);
    
    return () => clearInterval(interval);
  }, [user.id]);

  const handleNotificationClick = async () => {
    await requestNotificationPermission();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'nourix', label: 'Nourix Assistant', icon: Bot },
    { id: 'plans', label: 'Plan Generator', icon: ClipboardList },
    { id: 'rewards', label: 'Rewards', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-black/5 transition-transform duration-300 lg:translate-x-0 lg:static
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Bot size={24} />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Nourix</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all
                  ${activeTab === item.id 
                    ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/10' 
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'}
                `}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-black/5">
            <div className="flex items-center gap-3 px-2 mb-6">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 font-bold">
                {user.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">{user.name}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-between px-6 lg:px-12 flex-shrink-0">
          <button 
            className="lg:hidden p-2 text-zinc-500"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <h2 className="text-xl font-bold text-zinc-900">
            {navItems.find(i => i.id === activeTab)?.label}
          </h2>

          <div className="flex items-center gap-4">
            <button
              className="p-2 text-zinc-500 hover:text-zinc-900 transition-colors relative"
              onClick={handleNotificationClick}
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-12">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <Dashboard user={user} points={points} />}
                {activeTab === 'nourix' && <NourixAssistant />}
                {activeTab === 'plans' && <PlanGenerator userId={user.id} />}
                {activeTab === 'rewards' && <Rewards points={points} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
