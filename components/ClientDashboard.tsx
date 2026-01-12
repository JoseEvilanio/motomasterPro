import React, { useState, useEffect } from 'react';
import { User, OSStatus, ServiceOrder, Vehicle } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { t } from '../translations';
import { ICONS } from '../constants';

const ClientDashboard: React.FC<{ user: User }> = ({ user }) => {
    const [myOS, setMyOS] = useState<ServiceOrder[]>([]);
    const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || user.role !== 'CLIENT' || !user.clientId) return;

        // Listen for Client's Service Orders
        const qOS = query(
            collection(db, 'service_orders'),
            where('clientId', '==', user.clientId)
        );

        const unsubscribeOS = onSnapshot(qOS, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrder));
            // Sort by recently updated
            data.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setMyOS(data);
            setLoading(false);
        });

        // Listen for Client's Vehicles
        const qVehicles = query(
            collection(db, 'vehicles'),
            where('clientId', '==', user.clientId)
        );

        const unsubscribeVehicles = onSnapshot(qVehicles, (snap) => {
            setMyVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
        });

        return () => {
            unsubscribeOS();
            unsubscribeVehicles();
        };
    }, [user]);

    const getStatusColor = (status: OSStatus) => {
        switch (status) {
            case OSStatus.FINISHED: return 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5';
            case OSStatus.IN_PROGRESS: return 'border-amber-500/30 text-amber-500 bg-amber-500/5';
            case OSStatus.OPEN: return 'border-blue-500/30 text-blue-500 bg-blue-500/5';
            case OSStatus.WAITING_PARTS: return 'border-purple-500/30 text-purple-500 bg-purple-500/5';
            default: return 'border-zinc-700 text-zinc-500';
        }
    };

    if (loading) return <div className="p-10 text-center text-zinc-500 font-black uppercase tracking-widest animate-pulse italic">Carregando seus pedidos...</div>;

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-6 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                <div className="animate-in slide-in-from-left-4 duration-500">
                    <h1 className="text-3xl font-black uppercase tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic">
                        ÁREA DO <span className="text-purple-500">CLIENTE</span>
                    </h1>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">Bem-vindo, {user.name}</p>
                </div>
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 shadow-2xl shadow-purple-500/5 animate-in slide-in-from-right-4 duration-500">
                    <ICONS.Bike className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-black uppercase tracking-widest">{myVehicles.length} Veículos Registrados</span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LIST OF SERVICE ORDERS */}
                <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h3 className="text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 mb-4">
                        <ICONS.ClipboardList className="w-4 h-4 text-purple-500" /> Meus Serviços ({myOS.length})
                    </h3>

                    {myOS.length === 0 ? (
                        <div className="card-premium p-16 text-center text-zinc-600 bg-[#1c1c20]/20">
                            <ICONS.Search className="w-12 h-12 mx-auto mb-4 opacity-5" />
                            <p className="font-black uppercase tracking-[0.3em] text-[10px]">Nenhum serviço encontrado até o momento</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {myOS.map(os => (
                                <div key={os.id} className="card-premium p-8 group transition-all hover:border-purple-500/20 bg-[#1c1c20]/40 backdrop-blur-xl hover:shadow-2xl hover:shadow-purple-500/5">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Protocolo OS {os.osNumber ? `#${os.osNumber}` : `#${os.id.slice(-6).toUpperCase()}`}</span>
                                            <h4 className="font-black text-white text-xl mt-1 italic tracking-tight uppercase group-hover:text-purple-400 transition-colors">{os.description}</h4>
                                        </div>
                                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all group-hover:scale-105 ${getStatusColor(os.status)}`}>
                                            {t(os.status.toLowerCase() as any)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-8 border-t border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-purple-500/10 transition-colors">
                                                <ICONS.Bike className="w-5 h-5 text-zinc-500 group-hover:text-purple-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Equipamento</p>
                                                <p className="text-sm font-black text-zinc-300 uppercase italic">
                                                    {myVehicles.find(v => v.id === os.vehicleId)?.model || 'Identificando...'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 text-right">
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Valor do Investimento</p>
                                                <p className="text-2xl font-black text-white italic tracking-tighter">R$ {os.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* SIDEBAR: VEHICLES */}
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
                    <h3 className="text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 mb-4">
                        <ICONS.Bike className="w-4 h-4 text-purple-500" /> Minhas Motos
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {myVehicles.map(vehicle => (
                            <div key={vehicle.id} className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/[0.08] transition-all hover:border-purple-500/20 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20 group-hover:scale-110 transition-transform">
                                        <ICONS.Bike className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm uppercase italic tracking-tight">{vehicle.brand} {vehicle.model}</h4>
                                        <p className="text-[10px] font-black text-zinc-500 tracking-[0.2em] mt-1 group-hover:text-zinc-300 transition-colors">{vehicle.plate}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/10 rounded-[2rem] p-8 mt-10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-3xl rounded-full -mr-12 -mt-12 transition-all group-hover:bg-purple-500/20"></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-3 text-purple-400">Canal de Suporte</h4>
                        <p className="text-zinc-500 text-xs leading-relaxed italic font-medium">Alguma dúvida sobre o seu serviço? Nosso time está pronto para ajudar via WhatsApp.</p>
                        <button className="w-full mt-6 bg-white/5 border border-white/5 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95 shadow-xl">
                            Falar com a Oficina
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;
