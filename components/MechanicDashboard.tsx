import React, { useState, useEffect } from 'react';
import { User, OSStatus, Product } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { t } from '../translations';
import { ICONS } from '../constants';
import { toast } from 'sonner';

const MechanicDashboard: React.FC<{ user: User }> = ({ user }) => {
    const [openOS, setOpenOS] = useState<any[]>([]);
    const [myOS, setMyOS] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [searchProduct, setSearchProduct] = useState('');

    // Active OS being worked on
    const [activeWorkOS, setActiveWorkOS] = useState<any | null>(null);

    useEffect(() => {
        if (!user) return;

        // We need to find the OWNER ID this mechanic belongs to.
        // The user.id is the Auth User ID.
        // The mechanic record has ownerId.
        // We should probably store ownerId in user profile or fetch it.
        // For now, let's assume we search for the mechanic record linked to this user.

        const fetchMechanicData = async () => {
            const q = query(collection(db, 'mechanics'), where('userId', '==', user.id));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const mechanicData = snapshot.docs[0].data();
                const ownerId = mechanicData.ownerId;
                const mechanicId = snapshot.docs[0].id; // The ID in mechanics collection

                // Listen for OPEN OS (available to pick)
                const qOpen = query(
                    collection(db, 'service_orders'),
                    where('ownerId', '==', ownerId),
                    where('status', '==', OSStatus.OPEN)
                );

                const unsubscribeOpen = onSnapshot(qOpen, (snap) => {
                    setOpenOS(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    setLoading(false);
                });

                // Listen for MY OS (In Progress by me)
                const qMy = query(
                    collection(db, 'service_orders'),
                    where('ownerId', '==', ownerId),
                    where('mechanicId', '==', mechanicId),
                    where('status', 'in', [OSStatus.IN_PROGRESS, OSStatus.WAITING_PARTS])
                );

                const unsubscribeMy = onSnapshot(qMy, (snap) => {
                    setMyOS(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                });

                // Products for searching
                const qProducts = query(collection(db, 'products'), where('ownerId', '==', ownerId));
                const unsubscribeProducts = onSnapshot(qProducts, (snap) => {
                    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
                });

                return () => {
                    unsubscribeOpen();
                    unsubscribeMy();
                    unsubscribeProducts();
                };
            } else {
                setLoading(false);
                toast.error("Vínculo de mecânico não encontrado.");
            }
        };

        fetchMechanicData();
    }, [user]);

    const handleStartOS = async (os: any) => {
        try {
            // Find my mechanic ID again? Or store it? 
            // Repetition of query is inefficient but safe. 
            const q = query(collection(db, 'mechanics'), where('userId', '==', user.id));
            const snapshot = await getDocs(q);
            const mechanicId = snapshot.docs[0].id;
            const mechanicName = snapshot.docs[0].data().name;

            await updateDoc(doc(db, 'service_orders', os.id), {
                status: OSStatus.IN_PROGRESS,
                mechanicId: mechanicId,
                mechanicName: mechanicName,
                updatedAt: serverTimestamp()
            });
            toast.success("OS Iniciada!");
        } catch (error) {
            toast.error("Erro ao iniciar OS.");
        }
    };

    const handleFinishOS = async (os: any) => {
        try {
            await updateDoc(doc(db, 'service_orders', os.id), {
                status: OSStatus.FINISHED,
                updatedAt: serverTimestamp()
            });

            // 1. Create financial transaction
            // Mechanic data has ownerId
            const qMech = query(collection(db, 'mechanics'), where('userId', '==', user.id));
            const mechSnap = await getDocs(qMech);
            const ownerId = !mechSnap.empty ? mechSnap.docs[0].data().ownerId : user.ownerId;

            await addDoc(collection(db, 'transactions'), {
                ownerId: ownerId,
                osId: os.id,
                label: `OS #${os.osNumber || os.id.slice(-4)}`,
                amount: os.total || 0,
                category: 'INCOME',
                status: 'PAID',
                paymentMethod: 'CASH',
                date: serverTimestamp()
            });

            // 2. Deduct stock for products
            if (os.items && os.items.length > 0) {
                for (const item of os.items) {
                    if (item.type === 'PRODUCT') {
                        // Remove prefix if present
                        const cleanId = item.id.replace('PRODUCT_', '').replace('SERVICE_', '');
                        const productRef = doc(db, 'products', cleanId);
                        await updateDoc(productRef, {
                            stock: increment(-item.quantity),
                            updatedAt: serverTimestamp()
                        });
                    }
                }
            }

            setActiveWorkOS(null);
            toast.success("OS Finalizada, financeiro e estoque atualizados!");
        } catch (error) {
            console.error("Finish OS error:", error);
            toast.error("Erro ao finalizar OS.");
        }
    };

    const addProductToOS = async (product: Product) => {
        if (!activeWorkOS) return;

        const currentItems = activeWorkOS.items || [];
        const existing = currentItems.find((i: any) => i.id === product.id);

        let newItems;
        if (existing) {
            newItems = currentItems.map((i: any) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        } else {
            newItems = [...currentItems, {
                id: product.id,
                name: product.name,
                quantity: 1,
                price: product.price,
                type: 'PRODUCT'
            }];
        }

        const newTotal = newItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

        await updateDoc(doc(db, 'service_orders', activeWorkOS.id), {
            items: newItems,
            total: newTotal
        });
        toast.success("Produto adicionado!");
    };

    const removeProductFromOS = async (productId: string) => {
        if (!activeWorkOS) return;
        const newItems = (activeWorkOS.items || []).filter((i: any) => i.id !== productId);
        const newTotal = newItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
        await updateDoc(doc(db, 'service_orders', activeWorkOS.id), {
            items: newItems,
            total: newTotal
        });
        toast.success("Item removido!");
    };

    const updateProductQuantity = async (productId: string, delta: number) => {
        if (!activeWorkOS) return;
        const newItems = (activeWorkOS.items || []).map((i: any) => {
            if (i.id === productId) {
                return { ...i, quantity: Math.max(1, i.quantity + delta) };
            }
            return i;
        });
        const newTotal = newItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
        await updateDoc(doc(db, 'service_orders', activeWorkOS.id), {
            items: newItems,
            total: newTotal
        });
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchProduct.toLowerCase())
    );

    // Sync activeWorkOS with the latest data from myOS
    const syncedActiveOS = activeWorkOS ? (myOS.find(os => os.id === activeWorkOS.id) || activeWorkOS) : null;

    if (loading) return <div className="p-10 text-center text-zinc-500">Carregando painel...</div>;

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-6 pb-20">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter">Painel do Mecânico</h1>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Bem-vindo, {user.name}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* MY ACTIVE OS */}
                <section>
                    <h3 className="text-emerald-400 font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
                        <ICONS.Wrench className="w-4 h-4" /> Em Andamento ({myOS.length})
                    </h3>
                    <div className="space-y-4">
                        {myOS.length === 0 ? (
                            <div className="p-8 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-600 text-xs font-bold uppercase tracking-widest">
                                Você não tem serviços em andamento.
                            </div>
                        ) : (
                            myOS.map(os => (
                                <div key={os.id} className="bg-[#1c1c20] border border-emerald-500/20 rounded-2xl p-6 shadow-lg shadow-emerald-500/5 relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-lg">{os.description}</h4>
                                            <p className="text-zinc-500 text-xs uppercase font-bold tracking-wider mt-1">OS {os.osNumber ? `#${os.osNumber}` : `#${os.id.substring(0, 6).toUpperCase()}`}</p>
                                        </div>
                                        <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded-md uppercase border border-emerald-500/20">
                                            Em Andamento
                                        </span>
                                    </div>

                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={() => setActiveWorkOS(os)}
                                            className="flex-1 bg-white text-black font-black uppercase text-xs py-3 rounded-xl hover:bg-zinc-200 transition-colors"
                                        >
                                            Gerenciar Peças
                                        </button>
                                        <button
                                            onClick={() => handleFinishOS(os)}
                                            className="px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors"
                                            title="Finalizar Serviço"
                                        >
                                            <ICONS.CheckCircle2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* OPEN OS */}
                <section>
                    <h3 className="text-zinc-500 font-black uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
                        <ICONS.ClipboardList className="w-4 h-4" /> Disponíveis para Início ({openOS.length})
                    </h3>
                    <div className="space-y-4">
                        {openOS.length === 0 ? (
                            <div className="p-8 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-600 text-xs font-bold uppercase tracking-widest">
                                Nenhuma OS aguardando início.
                            </div>
                        ) : (
                            openOS.map(os => (
                                <div key={os.id} className="bg-[#161618] border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
                                    <div className="mb-4">
                                        <h4 className="font-bold text-zinc-300">{os.description}</h4>
                                        <p className="text-zinc-500 text-xs mt-1">Veículo: {os.osNumber ? `#${os.osNumber}` : `#${os.id.substring(0, 6).toUpperCase()}`}</p>
                                    </div>
                                    <button
                                        onClick={() => handleStartOS(os)}
                                        className="w-full bg-zinc-800 text-zinc-300 font-black uppercase text-xs py-3 rounded-xl hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
                                    >
                                        Assumir Serviço
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* MODAL FOR MANAGING OS */}
            {syncedActiveOS && (
                <div className="fixed inset-0 bg-black/95 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1c1c20] w-full max-w-2xl sm:rounded-[2.5rem] border border-zinc-800 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
                        <div className="p-8 border-b border-zinc-800/50 flex justify-between items-center bg-black/20">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Gerenciar OS {syncedActiveOS.osNumber ? `#${syncedActiveOS.osNumber}` : `#${syncedActiveOS.id.substring(0, 6).toUpperCase()}`}</h2>
                                <p className="text-purple-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Adicionar Peças e Serviços</p>
                            </div>
                            <button onClick={() => setActiveWorkOS(null)} className="p-3 text-zinc-500 hover:text-white bg-white/5 rounded-2xl border border-white/10 transition-all hover:scale-110"><ICONS.X className="w-6 h-6" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Add Product Search */}
                            <div className="mb-8">
                                <div className="relative">
                                    <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Buscar peça..."
                                        value={searchProduct}
                                        onChange={e => setSearchProduct(e.target.value)}
                                        className="w-full bg-black/50 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-sm focus:border-purple-500/50 outline-none transition-all"
                                    />
                                </div>
                                {searchProduct && (
                                    <div className="mt-2 bg-black border border-zinc-800 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                                        {filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => { addProductToOS(p); setSearchProduct(''); }}
                                                className="w-full text-left p-3 hover:bg-zinc-900 border-b border-zinc-800/50 flex justify-between items-center"
                                            >
                                                <span className="text-sm font-bold text-zinc-300">{p.name}</span>
                                                <span className="text-xs text-purple-400 font-mono">R$ {p.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Current Items */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Itens Utilizados</h4>
                                {!syncedActiveOS.items || syncedActiveOS.items.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-[2rem] text-zinc-700 text-[10px] uppercase font-black tracking-widest">Nenhum item adicionado</div>
                                ) : (
                                    syncedActiveOS.items.map((item: any, idx: number) => (
                                        <div key={idx} className="bg-black/40 p-4 rounded-2xl flex justify-between items-center border border-zinc-800/50 group hover:border-purple-500/30 transition-all">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <p className="font-bold text-sm text-white uppercase truncate">{item.name}</p>
                                                <p className="text-[10px] text-zinc-600 font-bold uppercase mt-0.5 whitespace-nowrap">R$ {item.price.toLocaleString('pt-BR')} cada</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 bg-zinc-800/50 p-1 rounded-xl border border-white/5">
                                                    <button
                                                        onClick={() => updateProductQuantity(item.id, -1)}
                                                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                                    >
                                                        <ICONS.Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="w-6 text-center text-xs font-black text-white">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateProductQuantity(item.id, 1)}
                                                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                                    >
                                                        <ICONS.Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="text-right min-w-[80px]">
                                                    <p className="text-sm font-black text-emerald-400">R$ {(item.price * item.quantity).toFixed(2).toLocaleString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => removeProductFromOS(item.id)}
                                                    className="p-2 text-zinc-600 hover:text-rose-500 bg-white/5 hover:bg-rose-500/10 rounded-xl border border-white/5 transition-all"
                                                >
                                                    <ICONS.Trash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="p-8 border-t border-zinc-800/50 bg-black/40">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Total Acumulado</span>
                                <span className="text-3xl font-black text-emerald-500 tracking-tighter">R$ {syncedActiveOS.total?.toFixed(2) || '0.00'}</span>
                            </div>
                            <button
                                onClick={() => setActiveWorkOS(null)}
                                className="w-full bg-white text-black font-black uppercase text-xs py-5 rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-xl shadow-black/20"
                            >
                                Fechar e Salvar OS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MechanicDashboard;
