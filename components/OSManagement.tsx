import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../services/store';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { User, OSStatus, Product, Service, FiscalStatus, UserRole } from '../types';
import { ICONS } from '../constants';
import { getAIAssistance } from '../services/geminiService';
import { t } from '../translations';
import { db } from '../services/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  increment
} from 'firebase/firestore';

interface OSItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  type: 'PRODUCT' | 'SERVICE';
  ncm?: string;
}

interface ServiceOrderEntry {
  id: string;
  ownerId: string;
  clientId: string;
  vehicleId: string;
  status: OSStatus;
  fiscalStatus: FiscalStatus;
  danfeUrl?: string;
  description: string;
  dependsOnOSId?: string;
  items: OSItem[];
  bodyLines: string[];
  total: number;
  mechanicId: string;
  printCount?: number;
  lastPrintedAt?: any;
  statusNotes?: string;
  osNumber?: string;
  createdAt: any;
  mechanicName?: string;
}

const OSManagement: React.FC<{ user: User }> = ({ user }) => {
  const [osList, setOsList] = useState<ServiceOrderEntry[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeOS, setActiveOS] = useState<ServiceOrderEntry | null>(null);
  const [aiDiagnostic, setAiDiagnostic] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    vehicleId: '',
    description: '',
    dependsOnOSId: '',
    status: OSStatus.OPEN as OSStatus,
    mechanicId: '',
    bodyLines: Array(9).fill(''),
    items: [] as OSItem[],
    statusNotes: ''
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  const [mechanics, setMechanics] = useState<any[]>([]);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [quickClientData, setQuickClientData] = useState({ name: '', phone: '', email: '' });
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [printPreviewOS, setPrintPreviewOS] = useState<ServiceOrderEntry | null>(null);
  const { workshopSettings } = useStore();

  useEffect(() => {
    const ownerId = (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN)
      ? user.id
      : user.ownerId;

    if (!ownerId) return;

    const qMechanics = query(collection(db, 'mechanics'), where('ownerId', '==', ownerId));
    const unsubscribeMechanics = onSnapshot(qMechanics, (snapshot) => {
      setMechanics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeMechanics();
  }, [user.id, user.ownerId, user.role]);

  useEffect(() => {
    const ownerId = (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN)
      ? user.id
      : user.ownerId;

    if (!ownerId) {
      setLoading(false);
      return;
    }

    const qOS = query(collection(db, 'service_orders'), where('ownerId', '==', ownerId));
    const unsubscribeOS = onSnapshot(qOS, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ServiceOrderEntry[];
      const sorted = data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOsList(sorted);
      setLoading(false);
    });

    const qClients = query(collection(db, 'clients'), where('ownerId', '==', ownerId));
    const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qVehicles = query(collection(db, 'vehicles'), where('ownerId', '==', ownerId));
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qProducts = query(collection(db, 'products'), where('ownerId', '==', ownerId));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    });

    const qServices = query(collection(db, 'services'), where('ownerId', '==', ownerId));
    const unsubscribeServices = onSnapshot(qServices, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]);
    });

    return () => {
      unsubscribeOS();
      unsubscribeClients();
      unsubscribeVehicles();
      unsubscribeProducts();
      unsubscribeServices();
    };
  }, [user.id, user.ownerId, user.role]);

  const filteredVehicles = useMemo(() => {
    if (!formData.clientId) return [];
    return vehicles.filter(v => v.clientId === formData.clientId);
  }, [formData.clientId, vehicles]);

  const osTotal = useMemo(() => {
    return formData.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
  }, [formData.items]);

  const filteredItems = useMemo(() => {
    if (!itemSearch) return [];
    const prodHits = products.filter(p =>
      p.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(itemSearch.toLowerCase())
    ).map(p => ({ ...p, type: 'PRODUCT' as const }));

    const servHits = services.filter(s =>
      s.name.toLowerCase().includes(itemSearch.toLowerCase())
    ).map(s => ({ ...s, sku: 'SERVICE', type: 'SERVICE' as const }));

    return [...prodHits, ...servHits];
  }, [itemSearch, products, services]);

  const addItemToOS = (item: any) => {
    // We use a prefixed ID to avoid collisions between Products and Services
    const uniqueId = `${item.type}_${item.id}`;

    setFormData(prev => {
      const existing = prev.items.find(it => it.id === uniqueId);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(it => it.id === uniqueId ? { ...it, quantity: it.quantity + 1 } : it)
        };
      } else {
        return {
          ...prev,
          items: [...prev.items, {
            id: uniqueId,
            name: item.name,
            price: item.price,
            quantity: 1,
            type: item.type
          }]
        };
      }
    });
    setItemSearch('');
  };

  const removeItemFromOS = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(it => it.id !== id)
    }));
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(it => {
        if (it.id === id) {
          const newQty = Math.max(1, it.quantity + delta);
          return { ...it, quantity: newQty };
        }
        return it;
      })
    }));
  };

  const handleAiConsult = async () => {
    if (!activeOS) return;
    setIsAiLoading(true);
    setAiDiagnostic(null);
    try {
      const bike = vehicles.find(v => v.id === activeOS.vehicleId);
      const bikeInfo = bike ? `${bike.brand} ${bike.model}` : "Moto Desconhecida";
      const result = await getAIAssistance(activeOS.description, bikeInfo);
      setAiDiagnostic(result || "Nenhuma recomendação gerada.");
      toast.success("Diagnóstico de IA concluído!");
    } catch (err) {
      setAiDiagnostic("Erro ao processar diagnóstico.");
      toast.error("Erro ao consultar IA.");
    }
    finally { setIsAiLoading(false); }
  };

  const handleQuickClientSave = async () => {
    if (!quickClientData.name || !quickClientData.phone) {
      toast.error(t('fill_all_fields'));
      return;
    }
    try {
      const ownerId = (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN) ? user.id : user.ownerId!;
      const docRef = await addDoc(collection(db, 'clients'), {
        ...quickClientData,
        ownerId: ownerId,
        createdAt: serverTimestamp()
      });
      setFormData(prev => ({ ...prev, clientId: docRef.id }));
      setShowQuickClientModal(false);
      setQuickClientData({ name: '', phone: '', email: '' });
      toast.success(t('client_registered'));
    } catch (error) {
      toast.error("Erro ao cadastrar cliente");
    }
  };

  const generateOSNumber = async () => {
    let isUnique = false;
    let number = '';
    while (!isUnique) {
      number = Math.floor(100000 + Math.random() * 900000).toString();
      const q = query(collection(db, 'service_orders'), where('osNumber', '==', number));
      const snap = await getDocs(q);
      if (snap.empty) isUnique = true;
    }
    return number;
  };

  const processOSBilling = async (osId: string, osData: any) => {
    const ownerId = (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN) ? user.id : user.ownerId!;

    // 1. Create financial transaction
    await addDoc(collection(db, 'transactions'), {
      ownerId,
      osId: osId,
      label: `OS #${osData.osNumber || osId.slice(-4)} - ${getClientName(osData.clientId)}`,
      amount: osData.total || 0,
      category: 'INCOME',
      status: 'PAID',
      paymentMethod: 'CASH', // Default for now
      date: serverTimestamp()
    });

    // 2. Deduct stock for products
    if (osData.items && osData.items.length > 0) {
      for (const item of osData.items) {
        if (item.type === 'PRODUCT') {
          // Remove prefix if present (from previous fix)
          const cleanId = item.id.replace('PRODUCT_', '').replace('SERVICE_', '');
          const productRef = doc(db, 'products', cleanId);
          await updateDoc(productRef, {
            stock: increment(-item.quantity),
            updatedAt: serverTimestamp()
          });
        }
      }
    }
  };

  const updateOSStatus = async (osId: string, newStatus: OSStatus) => {
    try {
      const osRef = doc(db, 'service_orders', osId);
      const currentOS = osList.find(os => os.id === osId);

      // Prevent duplicate billing if already billed
      const isFinishing = (newStatus === OSStatus.FINISHED || newStatus === OSStatus.DELIVERED);
      const wasFinished = (currentOS?.status === OSStatus.FINISHED || currentOS?.status === OSStatus.DELIVERED);

      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (isFinishing && !currentOS?.osNumber) {
        updateData.osNumber = await generateOSNumber();
      }

      await updateDoc(osRef, updateData);

      // Trigger billing if finalizing for the first time
      if (isFinishing && !wasFinished) {
        const fullOSData = { ...currentOS, ...updateData };
        await processOSBilling(osId, fullOSData);
        toast.success("Financeiro e estoque atualizados!");
      }

      toast.success(t('status_updated' as any));
    } catch (error) {
      console.error("Update status error:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleSaveOS = async () => {
    if (!formData.clientId || !formData.vehicleId || !formData.description) {
      toast.error(t('fill_all_fields'));
      return;
    }

    setIsSubmitting(true);
    try {
      let finalOSNumber = activeOS?.osNumber || null;

      // Generate OS Number if it doesn't exist yet (for new OS or status update)
      if (!finalOSNumber) {
        finalOSNumber = await generateOSNumber();
      }

      const payload = {
        ...formData,
        osNumber: finalOSNumber,
        ownerId: (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN) ? user.id : user.ownerId!,
        fiscalStatus: activeOS?.fiscalStatus || 'NONE',
        total: osTotal,
        updatedAt: serverTimestamp(),
        mechanicName: mechanics.find(m => m.id === formData.mechanicId)?.name || user.name
      };

      if (activeOS) {
        await updateDoc(doc(db, 'service_orders', activeOS.id), payload);

        // Check if finalizing from edit modal
        const isFinishing = (payload.status === OSStatus.FINISHED || payload.status === OSStatus.DELIVERED);
        const wasFinished = (activeOS.status === OSStatus.FINISHED || activeOS.status === OSStatus.DELIVERED);

        if (isFinishing && !wasFinished) {
          await processOSBilling(activeOS.id, payload);
          toast.success("Financeiro e estoque atualizados!");
        }

        toast.success("Ordem de Serviço atualizada!");
      } else {
        const docRef = await addDoc(collection(db, 'service_orders'), {
          ...payload,
          createdAt: serverTimestamp()
        });

        // If created already as finished (rare but possible)
        if (payload.status === OSStatus.FINISHED || payload.status === OSStatus.DELIVERED) {
          await processOSBilling(docRef.id, payload);
          toast.success("Financeiro e estoque atualizados!");
        }

        toast.success("Nova Ordem de Serviço criada!");
      }

      setIsModalOpen(false);
      setActiveOS(null);
      setFormData({
        clientId: '',
        vehicleId: '',
        description: '',
        dependsOnOSId: '',
        status: OSStatus.OPEN,
        mechanicId: '',
        bodyLines: Array(9).fill(''),
        items: [],
        statusNotes: ''
      });
    } catch (error) {
      console.error("Erro ao salvar OS:", error);
      toast.error("Erro ao salvar dados.");
    }
    finally { setIsSubmitting(false); }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || '...';
  const getVehicleInfo = (id: string) => {
    const v = vehicles.find(v => v.id === id);
    return v ? `${v.brand} ${v.model}` : '...';
  };

  return (
    <div className="space-y-6 relative h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-main">{t('os')}</h2>
          <p className="text-secondary">Gestão Técnica & IA</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReportsModal(true)}
            className="btn-premium-secondary"
          >
            📊 {t('report_os')}
          </button>
          <button
            onClick={() => { setActiveOS(null); setIsModalOpen(true); }}
            className="btn-premium-primary"
          >
            + {t('new_os_title')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 card-premium">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Número</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Veículo / Cliente</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={3} className="p-10 text-center animate-pulse text-zinc-500">Sincronizando Ordens...</td></tr>
                ) : osList.length === 0 ? (
                  <tr><td colSpan={3} className="p-20 text-center text-zinc-600">Nenhuma OS em sua oficina.</td></tr>
                ) : (
                  osList.map((os) => (
                    <tr
                      key={os.id}
                      onClick={() => { setActiveOS(os); setAiDiagnostic(null); }}
                      className={`group hover:bg-white/[0.02] cursor-pointer transition-colors ${activeOS?.id === os.id ? 'bg-purple-500/10' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-[10px] font-black bg-zinc-800 px-2 py-1 rounded text-purple-400">
                          {os.osNumber ? `#${os.osNumber}` : `#${os.id.substring(0, 6).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-zinc-100 uppercase">{getVehicleInfo(os.vehicleId)}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase">{getClientName(os.clientId)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <select
                          value={os.status}
                          onChange={(e) => updateOSStatus(os.id, e.target.value as OSStatus)}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-tighter border bg-transparent outline-none cursor-pointer ${os.status === OSStatus.FINISHED || os.status === OSStatus.DELIVERED
                            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                            : os.status === OSStatus.APPROVED
                              ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' // Same green for Approved
                              : os.status === OSStatus.REJECTED
                                ? 'border-red-500/30 text-red-500 bg-red-500/5'
                                : os.status === OSStatus.IN_PROGRESS
                                  ? 'border-amber-500/30 text-amber-500 bg-amber-500/5'
                                  : 'border-zinc-700 text-zinc-500'
                            }`}
                        >
                          {Object.values(OSStatus).map(s => (
                            <option key={s} value={s} className="bg-zinc-900">{t(s.toLowerCase() as any)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-white">R$ {os.total.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {activeOS ? (
            <div className="bg-background-card border border-border rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-white font-black text-lg">Ordem {activeOS.osNumber ? `#${activeOS.osNumber}` : `#${activeOS.id.substring(0, 6).toUpperCase()}`}</h3>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{getVehicleInfo(activeOS.vehicleId)}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl">
                  <p className="text-[9px] font-bold text-purple-400 uppercase leading-none mb-1">Total</p>
                  <p className="text-lg font-black text-purple-500">R$ {activeOS.total.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-background-main/50 p-4 rounded-2xl border border-border">
                  <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">Relato do Cliente</p>
                  <p className="text-zinc-300 text-xs italic">{activeOS.description}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAiConsult}
                    disabled={isAiLoading}
                    className="flex-1 relative group overflow-hidden bg-gradient-to-r from-purple-600 to-indigo-600 p-px rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="bg-background-card group-hover:bg-transparent transition-colors py-3 rounded-[11px] flex items-center justify-center gap-2">
                      <span className="text-[10px] font-black text-white tracking-widest">
                        {isAiLoading ? "PROCESSANDO..." : "✨ IA"}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setPrintPreviewOS(activeOS)}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all active:scale-95 flex items-center justify-center"
                  >
                    <ICONS.Printer className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setFormData({
                        clientId: activeOS.clientId,
                        vehicleId: activeOS.vehicleId,
                        description: activeOS.description,
                        dependsOnOSId: activeOS.dependsOnOSId || '',
                        status: activeOS.status,
                        mechanicId: activeOS.mechanicId || '',
                        bodyLines: activeOS.bodyLines || Array(9).fill(''),
                        items: activeOS.items || [],
                        statusNotes: activeOS.statusNotes || ''
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all active:scale-95 flex items-center justify-center"
                  >
                    <ICONS.Edit className="w-5 h-5" />
                  </button>
                </div>

                {aiDiagnostic && (
                  <div className="prose prose-invert prose-xs max-w-none bg-background-main/30 p-5 rounded-2xl border border-border/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <ReactMarkdown>{aiDiagnostic}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-2xl">
              <div className="w-12 h-12 bg-border rounded-full flex items-center justify-center mb-4">
                <ICONS.Wrench className="w-6 h-6 text-zinc-600" />
              </div>
              <h4 className="text-zinc-400 font-bold text-xs uppercase tracking-[0.2em]">Selecione uma OS</h4>
              <p className="text-zinc-600 text-[10px] mt-2 max-w-[200px]">Clique em uma ordem para ver detalhes e recomendações de IA.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-background-card border border-border w-full max-w-2xl rounded-3xl p-8 shadow-[0_0_50px_-12px_rgba(139,92,246,0.3)] max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-white font-black text-xl tracking-tight uppercase">{activeOS ? 'EDITAR ORDEM' : 'CADASTRAR SERVIÇO'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <ICONS.X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('client')}</label>
                  <select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="input-standard w-full"
                  >
                    <option value="">{t('select_client')}</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickClientModal(true)}
                  className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                >
                  <ICONS.Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('vehicle')}</label>
                <select
                  value={formData.vehicleId}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  disabled={!formData.clientId}
                  className="input-standard w-full disabled:opacity-50"
                >
                  <option value="">{t('select_vehicle' as any)}</option>
                  {filteredVehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('mechanic')}</label>
                <select
                  value={formData.mechanicId}
                  onChange={(e) => setFormData({ ...formData, mechanicId: e.target.value })}
                  className="input-standard w-full"
                >
                  <option value="">{t('select_mechanic')}</option>
                  {mechanics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('status')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OSStatus })}
                  className="input-standard w-full"
                >
                  {Object.values(OSStatus).map(s => (
                    <option key={s} value={s}>{t(s.toLowerCase() as any)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('status_notes')}</label>
                <input
                  type="text"
                  value={formData.statusNotes}
                  onChange={(e) => setFormData({ ...formData, statusNotes: e.target.value })}
                  className="input-standard w-full py-2 text-xs"
                  placeholder="Observação rápida sobre o status..."
                />
              </div>
            </div>

            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-standard w-full h-24 resize-none text-sm"
                placeholder="Resumo do problema..."
              />
            </div>

            <div className="space-y-3 mb-8">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">{t('os_body_lines')}</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {formData.bodyLines.map((line, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-zinc-600">{idx + 1}</span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) => {
                        const newLines = [...formData.bodyLines];
                        newLines[idx] = e.target.value;
                        setFormData({ ...formData, bodyLines: newLines });
                      }}
                      className="input-standard w-full pl-7 py-2 text-xs"
                      placeholder={`${t('body_line')} ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">ITENS DA ORDEM (PEÇAS & SERVIÇOS)</label>

              <div className="relative">
                <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar item para adicionar..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="input-standard w-full pl-10 py-3 text-sm"
                />
                {filteredItems.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-background-card border border-border rounded-2xl shadow-2xl z-[70] max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addItemToOS(item)}
                        className="w-full p-4 flex justify-between items-center hover:bg-white/[0.05] transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-bold text-white uppercase">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${item.type === 'SERVICE' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                              {item.type}
                            </span>
                            <p className="text-[10px] text-zinc-500 font-mono">{item.sku}</p>
                          </div>
                        </div>
                        <p className="font-black text-emerald-400">R$ {item.price.toLocaleString('pt-BR')}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {formData.items.length === 0 ? (
                  <p className="text-center py-6 text-zinc-600 text-[10px] font-black uppercase tracking-widest border border-dashed border-border rounded-2xl">Nenhum item adicionado</p>
                ) : (
                  formData.items.map(item => (
                    <div key={item.id} className="bg-background-main border border-border p-3 rounded-2xl flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white uppercase truncate">{item.name}</p>
                        <p className="text-[10px] text-purple-400 font-black">R$ {item.price.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-background-card border border-border rounded-xl p-1">
                        <button type="button" onClick={() => updateItemQuantity(item.id, -1)} className="p-1 px-2 text-zinc-400 hover:text-white transition-colors">-</button>
                        <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                        <button type="button" onClick={() => updateItemQuantity(item.id, 1)} className="p-1 px-2 text-zinc-400 hover:text-white transition-colors">+</button>
                      </div>
                      <button type="button" onClick={() => removeItemFromOS(item.id)} className="p-2 text-zinc-600 hover:text-rose-500 transition-colors">
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Total dos Itens</span>
                <span className="text-lg font-black text-purple-500">R$ {osTotal.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-premium-secondary flex-1"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveOS}
                disabled={isSubmitting}
                className="btn-premium-primary flex-[2]"
              >
                {isSubmitting ? "..." : t('save_changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickClientModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-background-card border border-border w-full max-w-md rounded-3xl p-8">
            <h3 className="text-white font-black text-xl mb-6 uppercase tracking-tighter">{t('quick_client_registration')}</h3>
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase">{t('name')}</label>
                <input
                  type="text"
                  value={quickClientData.name}
                  onChange={(e) => setQuickClientData({ ...quickClientData, name: e.target.value })}
                  className="input-standard w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase">{t('phone')}</label>
                <input
                  type="text"
                  value={quickClientData.phone}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length > 11) v = v.slice(0, 11);
                    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                    if (v.length > 9) v = `${v.slice(0, 10)}-${v.slice(10)}`;
                    setQuickClientData({ ...quickClientData, phone: v });
                  }}
                  className="input-standard w-full"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase">{t('email')}</label>
                <input
                  type="email"
                  value={quickClientData.email}
                  onChange={(e) => setQuickClientData({ ...quickClientData, email: e.target.value })}
                  className="input-standard w-full"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowQuickClientModal(false)} className="btn-premium-secondary flex-1">
                {t('cancel')}
              </button>
              <button onClick={handleQuickClientSave} className="btn-premium-primary flex-1">
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportsModal && (
        <OSReports onClose={() => setShowReportsModal(false)} osList={osList} mechanics={mechanics} clients={clients} />
      )}

      {printPreviewOS && (
        <OSPrintPreview
          os={printPreviewOS}
          onClose={() => setPrintPreviewOS(null)}
          client={clients.find(c => c.id === printPreviewOS.clientId)}
          vehicle={vehicles.find(v => v.id === printPreviewOS.vehicleId)}
          mechanic={mechanics.find(m => m.id === printPreviewOS.mechanicId)}
          workshopSettings={workshopSettings}
        />
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const OSReports: React.FC<{ onClose: () => void, osList: any[], mechanics: any[], clients: any[] }> = ({ onClose, osList, mechanics, clients }) => {
  const [reportType, setReportType] = useState<'MECHANIC' | 'CLIENT' | 'STATUS'>('STATUS');

  const reportData = useMemo(() => {
    const data: Record<string, { count: number, total: number, name: string }> = {};
    osList.forEach(os => {
      let key = '';
      let name = '';
      if (reportType === 'MECHANIC') {
        key = os.mechanicId || 'unassigned';
        name = mechanics.find(m => m.id === key)?.name || 'Mecânico não definido';
      } else if (reportType === 'CLIENT') {
        key = os.clientId;
        name = clients.find(c => c.id === key)?.name || 'Cliente não encontrado';
      } else {
        key = os.status;
        name = t(os.status.toLowerCase() as any);
      }

      if (!data[key]) data[key] = { count: 0, total: 0, name };
      data[key].count++;
      data[key].total += os.total || 0;
    });
    return Object.values(data);
  }, [osList, reportType, mechanics, clients]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background-card border border-border w-full max-w-4xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-white font-black text-2xl tracking-tighter uppercase">{t('report_os')}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <ICONS.X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          {(['STATUS', 'MECHANIC', 'CLIENT'] as const).map(type => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-6 py-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${reportType === type ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              {t(`by_${type.toLowerCase()}` as any)}
            </button>
          ))}
        </div>

        <div className="card-premium overflow-hidden border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">{t(reportType.toLowerCase() as any)}</th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-center">{t('total_os')}</th>
                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right">{t('total_value')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportData.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                  <td className="px-6 py-4 text-center text-zinc-400 font-mono">{item.count}</td>
                  <td className="px-6 py-4 text-right font-black text-emerald-400">R$ {item.total.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const OSPrintPreview: React.FC<{ os: any, client: any, vehicle: any, mechanic: any, workshopSettings: any, onClose: () => void }> = ({ os, client, vehicle, mechanic, workshopSettings, onClose }) => {
  const handlePrint = async () => {
    window.print();
    if (os.id) {
      try {
        await updateDoc(doc(db, 'service_orders', os.id), {
          printCount: (os.printCount || 0) + 1,
          lastPrintedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Print update error:", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-full flex flex-col bg-white overflow-hidden rounded-3xl shadow-2xl">
        <div className="flex justify-between items-center p-6 bg-zinc-100 border-b no-print">
          <h2 className="text-zinc-900 font-black text-xl uppercase tracking-tighter">{t('print_preview')}</h2>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-6 py-2 bg-zinc-200 text-zinc-700 rounded-xl font-bold hover:bg-zinc-300 transition-colors">
              {t('close')}
            </button>
            <button onClick={handlePrint} className="px-8 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30">
              <ICONS.Printer className="w-4 h-4" />
              {t('print_os')}
            </button>
          </div>
        </div>

        <div id="printable-os" className="flex-1 overflow-y-auto p-12 text-zinc-900 bg-white">
          <div className="flex justify-between items-start mb-10 border-b-4 border-zinc-900 pb-6">
            <div className="flex items-center gap-6">
              {workshopSettings?.logoUrl && (
                <img src={workshopSettings.logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
              )}
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-1 text-zinc-900">
                  {workshopSettings?.businessName || 'MOTO MASTER PRO'}
                </h1>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
                  {workshopSettings?.taxId ? `CNPJ/CPF: ${workshopSettings.taxId}` : 'WORKSHOP MANAGEMENT SYSTEM'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black text-zinc-900">ORDEM DE SERVIÇO</h2>
              <p className="text-zinc-500 font-bold text-sm"># {os.osNumber || os.id.substring(0, 6).toUpperCase()}</p>
              <p className="text-zinc-500 font-bold text-xs mt-1">{os.createdAt?.seconds ? new Date(os.createdAt.seconds * 1000).toLocaleDateString() : '---'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-10">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 mb-2 border-b pb-1">DADOS DO CLIENTE</h3>
              <p className="font-extrabold text-lg text-zinc-900">{client?.name || '---'}</p>
              <p className="text-zinc-600 font-medium">{client?.phone || '---'}</p>
              <p className="text-zinc-600 font-medium">{client?.email || '---'}</p>
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 mb-2 border-b pb-1">DADOS DO VEÍCULO</h3>
              <p className="font-extrabold text-lg text-zinc-900">{vehicle?.brand} {vehicle?.model}</p>
              <p className="text-zinc-600 font-bold tracking-widest text-xs uppercase">{vehicle?.plate} | {vehicle?.color} | {vehicle?.year}</p>
            </div>
          </div>

          <div className="mb-10 p-6 bg-zinc-50 rounded-2xl border-2 border-zinc-100">
            <h3 className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 mb-4">CORPO DA ORDEM DE SERVIÇO</h3>
            <div className="grid grid-cols-1 gap-2">
              {os.bodyLines && os.bodyLines.map((line: string, idx: number) => (
                <div key={idx} className="flex gap-4 border-b border-zinc-200 pb-1">
                  <span className="text-[10px] font-black text-zinc-300 w-4">{idx + 1}</span>
                  <p className="text-sm font-medium text-zinc-700">{line || '__________________________________________________________________'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-[10px] font-black uppercase tracking-tighter text-zinc-400 mb-4 text-center w-full border-b pb-2">PEÇAS & SERVIÇOS</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400 text-[10px] font-black uppercase">
                <tr className="border-b-2 border-zinc-900">
                  <th className="py-2">DESCRIÇÃO</th>
                  <th className="py-2 text-center">QTDE</th>
                  <th className="py-2 text-right">UNITÁRIO</th>
                  <th className="py-2 text-right">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {os.items?.length > 0 ? os.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-3 font-bold uppercase text-zinc-800">{item.name}</td>
                    <td className="py-3 text-center font-bold text-zinc-700">{item.quantity}</td>
                    <td className="py-3 text-right text-zinc-600">R$ {item.price.toLocaleString('pt-BR')}</td>
                    <td className="py-3 text-right font-black text-zinc-900">R$ {(item.price * item.quantity).toLocaleString('pt-BR')}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-300 italic">Nenhum item adicionado</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-4 border-zinc-900">
                  <td colSpan={3} className="py-4 text-right font-black uppercase text-xl text-zinc-900">TOTAL DA OS</td>
                  <td className="py-4 text-right font-black text-2xl text-zinc-900">R$ {os.total.toLocaleString('pt-BR')}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-20 mt-32">
            <div className="text-center pt-4 border-t-2 border-zinc-900">
              <p className="font-black uppercase text-[10px] tracking-widest text-zinc-900">{client?.name || 'ASSINATURA DO CLIENTE'}</p>
            </div>
            <div className="text-center pt-4 border-t-2 border-zinc-900">
              <p className="font-black uppercase text-[10px] tracking-widest text-zinc-900">{mechanic?.name || 'ASSINATURA DO RESPONSÁVEL'}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-os, #printable-os * { visibility: visible; }
          #printable-os {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            padding: 15mm !important;
            background: white !important;
            color: black !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default OSManagement;
