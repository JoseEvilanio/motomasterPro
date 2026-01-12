import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Wrench,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight
} from 'lucide-react';
import { User, OSStatus, UserRole } from '../types.ts';
import { t } from '../translations.ts';
import { db } from '../services/firebase.ts';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [clientsCount, setClientsCount] = useState(0);
  const [activeOSCount, setActiveOSCount] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentOS, setRecentOS] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;

    const qClients = query(collection(db, 'clients'), where('ownerId', '==', ownerId));
    const unsubClients = onSnapshot(qClients, (snap) => {
      setClientsCount(snap.size);
    });

    const qOS = query(collection(db, 'service_orders'), where('ownerId', '==', ownerId));
    const unsubOS = onSnapshot(qOS, (snap) => {
      const active = snap.docs.filter(doc => {
        const s = doc.data().status;
        return [OSStatus.OPEN, OSStatus.IN_PROGRESS, OSStatus.WAITING_PARTS].includes(s);
      });
      setActiveOSCount(active.length);

      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRecentOS(sorted.slice(0, 5));
    });

    const qFinance = query(collection(db, 'transactions'), where('ownerId', '==', ownerId));
    const unsubFinance = onSnapshot(qFinance, (snap) => {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      let weeklyTotal = 0;
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentYear = now.getFullYear();
      const grouped: Record<string, number> = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        const date = data.date?.toDate ? data.date.toDate() : null;

        if (date && data.category === 'INCOME' && data.status === 'PAID') {
          if (date >= sevenDaysAgo) weeklyTotal += (data.amount || 0);
          if (date.getFullYear() === currentYear) {
            const monthLabel = months[date.getMonth()];
            grouped[monthLabel] = (grouped[monthLabel] || 0) + (data.amount || 0);
          }
        }
      });

      setWeeklyRevenue(weeklyTotal);
      const chartArray = months.map(m => ({ name: m, revenue: grouped[m] || 0 })).slice(0, now.getMonth() + 1);
      setMonthlyData(chartArray);
      setLoading(false);
    });

    const qProducts = query(collection(db, 'products'), where('ownerId', '==', ownerId));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      const low = snap.docs.filter(doc => {
        const d = doc.data();
        return (d.stock || 0) <= (d.minStock || 0);
      }).length;
      setLowStockCount(low);
    });

    return () => {
      unsubClients();
      unsubOS();
      unsubFinance();
      unsubProducts();
    };
  }, [user.id, user.ownerId, user.role]);

  const stats = [
    { label: t('total_clients'), value: clientsCount.toString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: "OS Ativas", value: activeOSCount.toString(), icon: Wrench, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: t('weekly_revenue'), value: `R$ ${weeklyRevenue.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: "Alertas Estoque", value: lowStockCount.toString(), icon: AlertTriangle, color: lowStockCount > 0 ? 'text-rose-500' : 'text-zinc-500', bg: lowStockCount > 0 ? 'bg-rose-500/10' : 'bg-zinc-500/10', pulse: lowStockCount > 0 },
  ];

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-main">DASHBOARD</h2>
          <p className="text-secondary mt-1">Visão Geral da Oficina</p>
        </div>
        <div className="hidden md:block bg-background-card px-4 py-2 rounded-xl border border-border">
          <p className="text-[10px] font-black text-zinc-500 uppercase flex items-center gap-2">
            <Clock className="w-3 h-3 text-purple-500" /> Atualizado em tempo real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="group relative card-premium p-6 hover:border-white/10 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} blur-3xl opacity-20 -mr-12 -mt-12 transition-transform group-hover:scale-150`}></div>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl ${stat.bg} border border-border`}>
                <stat.icon className={`w-6 h-6 ${stat.color} ${stat.pulse ? 'animate-pulse' : ''}`} />
              </div>
              {stat.label === t('weekly_revenue') && (
                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  <TrendingUp className="w-3 h-3" /> +12%
                </span>
              )}
            </div>
            <div>
              <p className="text-secondary mb-1">{stat.label}</p>
              <h3 className={`text-2xl font-black ${stat.color === 'text-zinc-500' ? 'text-white' : stat.color} tracking-tighter`}>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 card-premium p-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Fluxo de Receita</h3>
              <p className="text-[10px] text-zinc-500 font-medium">Faturamento mensal consolidado em 2024</p>
            </div>
            <select className="bg-background-main border border-border text-[10px] font-black text-zinc-400 px-4 py-2 rounded-xl uppercase tracking-widest outline-none focus:border-purple-500 transition-colors">
              <option>Últimos 12 Meses</option>
              <option>Últimos 6 Meses</option>
            </select>
          </div>
          <div className="h-[350px] w-full">
            {isMounted && monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} fontVariant="small-caps" fontWeight="900" tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#52525b" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ backgroundColor: '#161618', border: '1px solid #1f1f23', borderRadius: '16px', fontSize: '12px', fontWeight: '900', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#8b5cf6' }}
                  />
                  <Bar dataKey="revenue" radius={[10, 10, 0, 0]} barSize={32}>
                    {monthlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
              <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">Carregando métricas...</p>
            </div>}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="flex-1 bg-background-card border border-border rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">OS Recentes</h3>
              <ArrowRight className="w-4 h-4 text-purple-500" />
            </div>
            <div className="space-y-4">
              {recentOS.length === 0 ? (
                <div className="py-10 text-center">
                  <Wrench className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Nenhuma atividade</p>
                </div>
              ) : recentOS.map((os, idx) => (
                <div key={idx} className="group flex items-center justify-between p-4 bg-background-main border border-border rounded-2xl hover:border-purple-500/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center font-black text-purple-500 text-[10px]">
                      #{os.id.slice(-3).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase truncate max-w-[120px]">
                        {os.mechanicName || "Mecânico"}
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                        {os.status === OSStatus.FINISHED ? 'Concluída' : 'Em Aberto'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-white">R$ {os.total?.toLocaleString('pt-BR') || '0,00'}</p>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase">
                      {os.createdAt?.toDate ? os.createdAt.toDate().toLocaleDateString('pt-BR') : '...'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {recentOS.length > 0 && (
              <button className="btn-premium-secondary w-full mt-6">
                Ver Todas as Ordens
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
