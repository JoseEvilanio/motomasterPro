import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { OSStatus, ServiceOrder } from '../types';
import { ICONS } from '../constants';
import { t } from '../translations';
import { toast } from 'sonner';

const WorkshopBranding: React.FC<{ ownerId: string }> = ({ ownerId }) => {
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const q = query(collection(db, 'settings'), where('ownerId', '==', ownerId));
            const snap = await getDocs(q);
            if (!snap.empty) {
                setSettings(snap.docs[0].data());
            }
        };
        fetchSettings();
    }, [ownerId]);

    if (!settings) return <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">MotoMaster Pro</p>;

    return (
        <div className="flex items-center gap-2">
            {settings.logoUrl && (
                <img src={settings.logoUrl} alt="Logo" className="w-4 h-4 object-contain rounded-sm" />
            )}
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest leading-none">
                {settings.businessName}
            </p>
        </div>
    );
};

const CustomerPortal: React.FC = () => {
    const [plate, setPlate] = useState('');
    const [taxId, setTaxId] = useState('');
    const [osNumberSearch, setOsNumberSearch] = useState('');
    const [searchMode, setSearchMode] = useState<'VEHICLE' | 'OS_NUMBER'>('VEHICLE');
    const [loading, setLoading] = useState(false);
    const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchParams] = useSearchParams();
    const { workshopId } = useParams<{ workshopId?: string }>();
    const navigate = useNavigate();
    const searchTriggered = useRef(false);
    const [workshopSettings, setWorkshopSettings] = useState<any>(null);
    const [workshopNotFound, setWorkshopNotFound] = useState(false);

    // Load workshop settings if workshopId is provided
    useEffect(() => {
        if (!workshopId) return;

        const loadWorkshopSettings = async () => {
            try {
                const q = query(collection(db, 'settings'), where('ownerId', '==', workshopId));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setWorkshopSettings(snap.docs[0].data());
                    setWorkshopNotFound(false);
                } else {
                    setWorkshopNotFound(true);
                    toast.error("Oficina não encontrada.");
                }
            } catch (error) {
                console.error("Error loading workshop:", error);
                setWorkshopNotFound(true);
            }
        };

        loadWorkshopSettings();
    }, [workshopId]);

    // Function moved outside to be reusable
    const performSearch = async (mode: 'VEHICLE' | 'OS_NUMBER', queryVal: string, extraVal?: string) => {
        setLoading(true);
        setHasSearched(true);
        try {
            if (mode === 'OS_NUMBER') {
                const results: ServiceOrder[] = [];
                const searchVal = queryVal.trim();
                const isNumeric = /^\d+$/.test(searchVal);

                // 1. Try search by osNumber field (String and Number versions for safety)
                // CRITICAL: Filter by ownerId if workshopId is provided for multi-tenant isolation
                const baseQuery = workshopId
                    ? [where('ownerId', '==', workshopId), where('osNumber', '==', searchVal)]
                    : [where('osNumber', '==', searchVal)];

                const queries = [
                    getDocs(query(collection(db, 'service_orders'), ...baseQuery))
                ];

                if (isNumeric) {
                    const numericQuery = workshopId
                        ? [where('ownerId', '==', workshopId), where('osNumber', '==', Number(searchVal))]
                        : [where('osNumber', '==', Number(searchVal))];
                    queries.push(getDocs(query(collection(db, 'service_orders'), ...numericQuery)));
                }

                const snapshots = await Promise.all(queries);
                snapshots.forEach(snap => {
                    snap.forEach(docSnap => {
                        if (!results.find(r => r.id === docSnap.id)) {
                            results.push({ id: docSnap.id, ...docSnap.data() } as ServiceOrder);
                        }
                    });
                });

                // 2. Fallback: Search by doc ID (ID exact match or technical ID)
                if (results.length === 0) {
                    // Try fetch by direct ID (exact match)
                    const directSnap = await getDoc(doc(db, 'service_orders', searchVal));
                    if (directSnap.exists()) {
                        const data = directSnap.data();
                        // Verify ownerId if workshopId is provided
                        if (!workshopId || data.ownerId === workshopId) {
                            results.push({ id: directSnap.id, ...data } as ServiceOrder);
                        }
                    } else {
                        // Try fetch by ID in upper case
                        const directSnapUpper = await getDoc(doc(db, 'service_orders', searchVal.toUpperCase()));
                        if (directSnapUpper.exists()) {
                            const data = directSnapUpper.data();
                            // Verify ownerId if workshopId is provided
                            if (!workshopId || data.ownerId === workshopId) {
                                results.push({ id: directSnapUpper.id, ...data } as ServiceOrder);
                            }
                        }
                    }
                }

                setServiceOrders(results);
            } else {
                // Normalize search input (remove formatting for robust lookup)
                const normalizedSearch = (extraVal || '').replace(/\D/g, '');

                // 1. Find vehicles (try both formats: ABC1234 and ABC-1234)
                const cleanPlate = queryVal.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                const formattedPlate = cleanPlate.length === 7
                    ? `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}`
                    : cleanPlate;

                // CRITICAL: Filter by ownerId if workshopId is provided for multi-tenant isolation
                const vehicleQueryConstraints = workshopId
                    ? [where('ownerId', '==', workshopId), where('plate', 'in', [cleanPlate, formattedPlate])]
                    : [where('plate', 'in', [cleanPlate, formattedPlate])];

                const vehiclesQuery = query(collection(db, 'vehicles'), ...vehicleQueryConstraints);
                const vehiclesSnapshot = await getDocs(vehiclesQuery);

                if (vehiclesSnapshot.empty) {
                    setServiceOrders([]);
                    setLoading(false);
                    return;
                }

                const foundVehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const orderResults: ServiceOrder[] = [];

                for (const vehicle of foundVehicles) {
                    // 2. Find client for this vehicle
                    const clientId = (vehicle as any).clientId;
                    if (!clientId) continue;

                    const clientSnap = await getDoc(doc(db, 'clients', clientId));
                    if (!clientSnap.exists()) continue;
                    const clientData = clientSnap.data();

                    const dbTaxId = (clientData.taxId || '').replace(/\D/g, '');
                    const dbPhone = (clientData.phone || '').replace(/\D/g, '');

                    if (dbTaxId === normalizedSearch || dbPhone === normalizedSearch || clientData.taxId === extraVal || clientData.phone === extraVal) {
                        // 3. Query OS by vehicleId (and ownerId if workshopId provided)
                        const osQueryConstraints = workshopId
                            ? [where('ownerId', '==', workshopId), where('vehicleId', '==', vehicle.id)]
                            : [where('vehicleId', '==', vehicle.id)];

                        const osQuery = query(
                            collection(db, 'service_orders'),
                            ...osQueryConstraints
                        );
                        const osSnapshot = await getDocs(osQuery);
                        osSnapshot.forEach(docSnap => {
                            const data = docSnap.data();
                            // Double check clientId in memory for absolute safety
                            if (data.clientId === clientId) {
                                orderResults.push({ id: docSnap.id, ...data } as ServiceOrder);
                            }
                        });
                    }
                }
                orderResults.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
                setServiceOrders(orderResults);
            }
        } catch (error) {
            console.error("Error searching OS:", error);
            toast.error("Erro ao carregar informações.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-search from URL param
    useEffect(() => {
        const osFromUrl = searchParams.get('os');
        if (osFromUrl && !searchTriggered.current) {
            searchTriggered.current = true;
            setSearchMode('OS_NUMBER');
            setOsNumberSearch(osFromUrl);
            performSearch('OS_NUMBER', osFromUrl);
        }
    }, [searchParams]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (searchMode === 'VEHICLE') {
            if (!plate || !taxId) {
                toast.error(t('fill_all_fields'));
                return;
            }
            performSearch('VEHICLE', plate, taxId);
        } else {
            if (!osNumberSearch) {
                toast.error("Informe o número da OS");
                return;
            }
            performSearch('OS_NUMBER', osNumberSearch);
        }
    };

    const getStatusColor = (status: OSStatus) => {
        switch (status) {
            case OSStatus.FINISHED: return 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5';
            case OSStatus.IN_PROGRESS: return 'border-amber-500/30 text-amber-500 bg-amber-500/5';
            case OSStatus.OPEN: return 'border-blue-500/30 text-blue-500 bg-blue-500/5';
            case OSStatus.WAITING_PARTS: return 'border-purple-500/30 text-purple-500 bg-purple-500/5';
            case OSStatus.CANCELLED: return 'border-rose-500/30 text-rose-500 bg-rose-500/5';
            default: return 'border-zinc-700 text-zinc-500';
        }
    };

    // Show error if workshop not found
    if (workshopNotFound) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-rose-500/20">
                        <ICONS.Search className="w-10 h-10 text-rose-500" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Oficina Não Encontrada</h1>
                    <p className="text-zinc-500 text-sm mb-8">O link que você acessou não corresponde a nenhuma oficina cadastrada.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="btn-premium-secondary"
                    >
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col items-center mb-10 text-center">
                    {/* Workshop Logo or Default Icon */}
                    {workshopSettings?.logoUrl ? (
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center shadow-2xl mb-6 border border-white/10 p-2">
                            <img src={workshopSettings.logoUrl} alt={workshopSettings.businessName} className="w-full h-full object-contain rounded-xl" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl mb-6 shadow-purple-500/20">
                            <ICONS.Bike className="w-8 h-8 text-white" />
                        </div>
                    )}

                    {/* Workshop Name or Default Title */}
                    {workshopSettings?.businessName ? (
                        <>
                            <h1 className="text-3xl font-black tracking-tighter sm:text-4xl bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent uppercase italic mb-2">
                                {workshopSettings.businessName}
                            </h1>
                            <h2 className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">{t('os_status_tracking')}</h2>
                        </>
                    ) : (
                        <>
                            <h1 className="text-4xl font-black tracking-tighter sm:text-5xl bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent uppercase italic">
                                MOTO<span className="text-purple-500">MASTER</span> PRO
                            </h1>
                            <h2 className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em] mt-4">{t('os_status_tracking')}</h2>
                        </>
                    )}
                    <p className="text-zinc-400 mt-2 text-sm">{t('track_your_service')}</p>
                </div>

                <div className="card-premium p-8 bg-[#1c1c20]/40 backdrop-blur-xl border border-white/5 shadow-2xl overflow-visible relative">
                    <div className="flex gap-2 mb-8 bg-black/40 p-1 rounded-2xl border border-white/5">
                        <button
                            onClick={() => { setSearchMode('VEHICLE'); setHasSearched(false); setServiceOrders([]); }}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${searchMode === 'VEHICLE' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Veículo
                        </button>
                        <button
                            onClick={() => { setSearchMode('OS_NUMBER'); setHasSearched(false); setServiceOrders([]); }}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${searchMode === 'OS_NUMBER' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Número da OS
                        </button>
                    </div>

                    <form onSubmit={handleSearch} className="space-y-6">
                        {searchMode === 'VEHICLE' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('plate')}</label>
                                    <input
                                        type="text"
                                        placeholder="ABC-1234"
                                        value={plate}
                                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                                        className="input-standard w-full text-center text-lg font-black tracking-widest"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">CPF ou Telefone</label>
                                    <input
                                        type="text"
                                        placeholder="CPF ou Telefone"
                                        value={taxId}
                                        onChange={(e) => setTaxId(e.target.value)}
                                        className="input-standard w-full text-center text-lg font-black tracking-widest"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">Número da OS (6 dígitos)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 123456"
                                    value={osNumberSearch}
                                    onChange={(e) => setOsNumberSearch(e.target.value.toUpperCase().slice(0, 10))}
                                    className="input-standard w-full text-center text-3xl font-black tracking-[0.5em] py-6"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-premium-primary w-full py-4 text-sm tracking-[0.2em] font-black uppercase shadow-xl hover:shadow-purple-500/10 active:scale-95 transition-all"
                        >
                            {loading ? "BUSCANDO..." : t('search_os')}
                        </button>
                    </form>

                    {hasSearched && !loading && (
                        <div className="mt-10 animate-in fade-in duration-500">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-px bg-zinc-800 flex-1"></div>
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Resultados</span>
                                <div className="h-px bg-zinc-800 flex-1"></div>
                            </div>

                            {serviceOrders.length > 0 ? (
                                <div className="space-y-4">
                                    {serviceOrders.map((os) => (
                                        <div key={os.id} className="bg-background-main/30 border border-white/5 rounded-2xl p-6 transition-all hover:border-purple-500/20 active:scale-[0.98]">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <WorkshopBranding ownerId={os.ownerId} />
                                                    <h3 className="text-white font-black text-lg mt-1">{os.osNumber ? `#${os.osNumber}` : `#${os.id.substring(0, 6).toUpperCase()}`}</h3>
                                                </div>
                                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-tighter border ${getStatusColor(os.status)}`}>
                                                    {t(os.status.toLowerCase() as any)}
                                                </span>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="bg-white/5 p-4 rounded-xl">
                                                    <p className="text-[9px] font-black text-zinc-500 uppercase mb-1">Descrição do Serviço</p>
                                                    <p className="text-zinc-300 text-sm italic line-clamp-2 leading-relaxed">&ldquo;{os.description}&rdquo;</p>
                                                </div>

                                                {/* Items List */}
                                                {os.items && os.items.length > 0 && (
                                                    <div className="bg-black/20 rounded-xl overflow-hidden border border-white/5">
                                                        <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                                            <span className="text-[10px] font-black text-zinc-500 uppercase">Item / Serviço</span>
                                                            <span className="text-[10px] font-black text-zinc-500 uppercase">Total</span>
                                                        </div>
                                                        <div className="divide-y divide-white/5">
                                                            {os.items.map((item, idx) => (
                                                                <div key={idx} className="px-4 py-3 flex justify-between items-center text-sm">
                                                                    <div>
                                                                        <div className="text-zinc-300 font-medium">{item.name}</div>
                                                                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.quantity}x {item.type === 'PRODUCT' ? 'Produto' : 'Serviço'}</div>
                                                                    </div>
                                                                    <div className="text-zinc-400 font-mono">R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 px-1 pt-2 border-t border-white/5">
                                                    <span>Atualizado em {os.updatedAt?.toDate().toLocaleDateString()}</span>
                                                    <span className="text-purple-500 font-black text-sm">TOTAL R$ {os.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </div>

                                                {/* Approval Actions */}
                                                {os.status === OSStatus.OPEN && (
                                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm("Deseja recusar este orçamento?")) return;
                                                                try {
                                                                    await updateDoc(doc(db, 'service_orders', os.id), {
                                                                        status: OSStatus.REJECTED,
                                                                        updatedAt: serverTimestamp(),
                                                                        statusNotes: 'Orçamento recusado pelo cliente via portal.'
                                                                    });
                                                                    toast.success("Orçamento recusado.");
                                                                    handleSearch({ preventDefault: () => { } } as any); // Refresh
                                                                } catch (e) {
                                                                    toast.error("Erro ao atualizar.");
                                                                }
                                                            }}
                                                            className="py-3 rounded-xl bg-red-500/10 text-red-500 font-black text-xs uppercase hover:bg-red-500/20 transition-colors border border-red-500/20"
                                                        >
                                                            Recusar
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm("Deseja aprovar este orçamento?")) return;
                                                                try {
                                                                    await updateDoc(doc(db, 'service_orders', os.id), {
                                                                        status: OSStatus.APPROVED,
                                                                        updatedAt: serverTimestamp(),
                                                                        statusNotes: 'Orçamento aprovado pelo cliente via portal.'
                                                                    });
                                                                    toast.success("Orçamento aprovado com sucesso!");
                                                                    handleSearch({ preventDefault: () => { } } as any); // Refresh
                                                                } catch (e) {
                                                                    toast.error("Erro ao atualizar.");
                                                                }
                                                            }}
                                                            className="py-3 rounded-xl bg-emerald-500/10 text-emerald-500 font-black text-xs uppercase hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 shadow-lg shadow-emerald-500/10"
                                                        >
                                                            Aprovar Orçamento
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-zinc-800/50">
                                    <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                                        <ICONS.Search className="w-5 h-5 text-zinc-500" />
                                    </div>
                                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">{t('os_not_found')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="mt-8 mx-auto flex items-center gap-2 text-zinc-600 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest group"
                >
                    <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('back_to_login')}
                </button>
            </div>
        </div>
    );
};

export default CustomerPortal;
