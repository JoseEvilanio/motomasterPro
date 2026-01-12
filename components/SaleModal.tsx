import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { User, Product, Sale, SaleStatus, SaleItem, Client, UserRole } from '../types';
import { ICONS } from '../constants';
import { t } from '../translations';
import {
    collection,
    onSnapshot,
    query,
    where,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc,
    increment
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface SaleModalProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
    sale: Sale | null;
}

const SaleModal: React.FC<SaleModalProps> = ({ user, isOpen, onClose, sale }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);

    const [items, setItems] = useState<SaleItem[]>([]);
    const [clientId, setClientId] = useState('');
    const [status, setStatus] = useState<SaleStatus>(SaleStatus.ORDER);
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [isInstallments, setIsInstallments] = useState(false);
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [barcodeInput, setBarcodeInput] = useState('');

    const [manualItem, setManualItem] = useState({ name: '', price: '', quantity: 1 });
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [showQuickClient, setShowQuickClient] = useState(false);
    const [quickClientName, setQuickClientName] = useState('');

    const barcodeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
        const qP = query(collection(db, 'products'), where('ownerId', '==', ownerId));
        const unsubscribeProducts = onSnapshot(qP, (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
            setLoadingItems(false);
        });

        const qC = query(collection(db, 'clients'), where('ownerId', '==', ownerId));
        const unsubscribeClients = onSnapshot(qC, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]);
        });

        if (sale) {
            setItems(sale.items);
            setClientId(sale.clientId || '');
            setStatus(sale.status);
            setGlobalDiscount(sale.totalDiscount);
            setPaymentMethod(sale.paymentMethod);
            setIsInstallments(sale.isInstallments);
            setInstallmentsCount(sale.installmentsCount || 1);
        }

        return () => {
            unsubscribeProducts();
            unsubscribeClients();
        };
    }, [user.id, user.ownerId, user.role, sale]);

    const handleBarcodeSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const product = products.find(p => p.sku === barcodeInput);
        if (product) {
            addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                discount: 0,
                type: 'PRODUCT'
            });
            setBarcodeInput('');
            toast.success(`${product.name} adicionado.`);
        } else {
            toast.error("Produto não encontrado por este código.");
        }
    };

    const addItem = (newItem: SaleItem) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === newItem.id && i.name === newItem.name);
            if (existing) {
                return prev.map(i => (i.id === newItem.id && i.name === newItem.name) ? { ...i, quantity: i.quantity + newItem.quantity } : i);
            }
            return [...prev, newItem];
        });
    };

    const updateItemQty = (index: number, delta: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i === index) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const updateItemDiscount = (index: number, discount: number) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, discount } : item));
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const subtotal = useMemo(() => items.reduce((acc, it) => acc + (it.price * it.quantity), 0), [items]);
    const itemsDiscount = useMemo(() => items.reduce((acc, it) => acc + (it.discount * it.quantity), 0), [items]);
    const total = useMemo(() => subtotal - itemsDiscount - globalDiscount, [subtotal, itemsDiscount, globalDiscount]);

    const handleQuickClientSave = async () => {
        if (!quickClientName) return;
        try {
            const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
            const docRef = await addDoc(collection(db, 'clients'), {
                ownerId: ownerId,
                name: quickClientName,
                phone: '',
                email: '',
                createdAt: serverTimestamp()
            });
            setClientId(docRef.id);
            setShowQuickClient(false);
            setQuickClientName('');
            toast.success("Cliente cadastrado e selecionado!");
        } catch (err) {
            toast.error("Erro ao cadastrar cliente.");
        }
    };

    const handleSaveSale = async () => {
        if (items.length === 0) {
            toast.error("O carrinho está vazio.");
            return;
        }

        setIsSubmitting(true);
        try {
            const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
            const payload = {
                ownerId,
                clientId,
                sellerId: user.id,
                items,
                subtotal,
                totalDiscount: itemsDiscount + globalDiscount,
                total,
                status,
                paymentMethod,
                isInstallments,
                installmentsCount,
                updatedAt: serverTimestamp()
            };

            if (sale) {
                await updateDoc(doc(db, 'sales', sale.id), payload);
                toast.success("Venda/Orçamento atualizado!");
            } else {
                const saleRef = await addDoc(collection(db, 'sales'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });

                // Se for finalizado, dá baixa no estoque
                if (status === SaleStatus.FINALIZED) {
                    for (const item of items) {
                        if (item.type === 'PRODUCT' && item.id !== 'manual') {
                            const productRef = doc(db, 'products', item.id);
                            await updateDoc(productRef, {
                                stock: increment(-item.quantity),
                                updatedAt: serverTimestamp()
                            });
                        }
                    }

                    // Lógica de Contas a Receber se for a prazo
                    if (isInstallments) {
                        await addDoc(collection(db, 'transactions'), {
                            ownerId: ownerId,
                            label: `Venda #${saleRef.id.slice(-4)} - ${clients.find(c => c.id === clientId)?.name || 'Consumidor'}`,
                            amount: total,
                            category: 'INCOME',
                            status: 'PENDING',
                            paymentMethod,
                            isInstallments: true,
                            installmentsCount,
                            date: serverTimestamp()
                        });
                    } else {
                        // Lógica de Transação paga na hora
                        await addDoc(collection(db, 'transactions'), {
                            ownerId: ownerId,
                            label: `Venda #${saleRef.id.slice(-4)}`,
                            amount: total,
                            category: 'INCOME',
                            status: 'PAID',
                            paymentMethod,
                            date: serverTimestamp()
                        });
                    }
                }
                toast.success("Venda registrada com sucesso!");
            }
            onClose();
        } catch (error) {
            console.error("Save sale error:", error);
            toast.error("Erro ao salvar venda.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-300">
            <div className="bg-background-card border border-border w-full max-w-6xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border bg-[#1c1c20]/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                            <ICONS.ShoppingBag className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                                    {sale ? "EDITAR VENDA" : "NOVA VENDA"}
                                </h2>
                                <div className="bg-zinc-800 p-1 rounded-xl border border-border flex">
                                    <button
                                        onClick={() => setStatus(SaleStatus.ORDER)}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${status === SaleStatus.ORDER ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        {t('order')}
                                    </button>
                                    <button
                                        onClick={() => setStatus(SaleStatus.QUOTE)}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${status === SaleStatus.QUOTE ? 'bg-amber-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        {t('quote')}
                                    </button>
                                    <button
                                        onClick={() => setStatus(SaleStatus.FINALIZED)}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${status === SaleStatus.FINALIZED ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        {t('finalize')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/10">
                        <ICONS.X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* Esquerda: Itens e Busca */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Barcode Search */}
                            <form onSubmit={handleBarcodeSearch} className="relative">
                                <ICONS.Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                <input
                                    ref={barcodeRef}
                                    type="text"
                                    placeholder={t('barcode')}
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    className="input-standard w-full pl-12 py-4"
                                />
                            </form>

                            {/* Item Search / Results integrated in a real POS would be here, but for now we have product catalog elsewhere or can add manual items */}
                            <button
                                onClick={() => setShowManualAdd(!showManualAdd)}
                                className="btn-premium-secondary py-4"
                            >
                                <ICONS.Plus className="w-4 h-4" /> {t('manual_item')}
                            </button>
                        </div>

                        {showManualAdd && (
                            <div className="p-4 bg-background-main border border-border rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-300">
                                <input
                                    placeholder="Nome do Item"
                                    value={manualItem.name}
                                    onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                                    className="input-standard text-xs col-span-2"
                                />
                                <input
                                    type="number"
                                    placeholder="Preço R$"
                                    value={manualItem.price}
                                    onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                                    className="input-standard text-xs"
                                />
                                <button
                                    onClick={() => {
                                        if (manualItem.name && manualItem.price) {
                                            addItem({
                                                id: 'manual',
                                                name: manualItem.name,
                                                price: parseFloat(manualItem.price),
                                                quantity: 1,
                                                discount: 0,
                                                type: 'PRODUCT'
                                            });
                                            setManualItem({ name: '', price: '', quantity: 1 });
                                            setShowManualAdd(false);
                                        }
                                    }}
                                    className="bg-white text-black rounded-xl font-black text-[10px] uppercase"
                                >
                                    Adicionar
                                </button>
                            </div>
                        )}

                        {/* Cart Table */}
                        <div className="flex-1 bg-background-main border border-border rounded-[2rem] overflow-hidden flex flex-col shadow-inner">
                            <div className="p-4 border-b border-border bg-black/20 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between">
                                <span>Produtos & Serviços</span>
                                <span>Itens: {items.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-background-main border-b border-border text-zinc-600 font-black uppercase text-[9px]">
                                        <tr>
                                            <th className="px-6 py-3">Descrição</th>
                                            <th className="px-6 py-3 text-center">Preço</th>
                                            <th className="px-6 py-3 text-center">Quant.</th>
                                            <th className="px-6 py-3 text-center">Desc. Un.</th>
                                            <th className="px-6 py-3 text-right">Subtotal</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {items.map((item, index) => (
                                            <tr key={index} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-white uppercase tracking-tight">{item.name}</p>
                                                    <span className="text-[9px] text-zinc-600 font-mono tracking-tighter">ID: {item.id.slice(0, 8)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-zinc-300 font-black">
                                                    R$ {item.price.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => updateItemQty(index, -1)} className="p-1.5 bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"><ICONS.Minus className="w-3 h-3" /></button>
                                                        <span className="w-8 text-center font-black text-white">{item.quantity}</span>
                                                        <button onClick={() => updateItemQty(index, 1)} className="p-1.5 bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"><ICONS.Plus className="w-3 h-3" /></button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="number"
                                                            className="w-16 bg-zinc-800/50 border border-border rounded-lg px-2 py-1 text-center font-black text-rose-500 text-[10px]"
                                                            value={item.discount || ''}
                                                            placeholder="0.00"
                                                            onChange={(e) => updateItemDiscount(index, parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className="font-black text-white text-sm">
                                                        R$ {((item.price - (item.discount || 0)) * item.quantity).toFixed(2)}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => removeItem(index)} className="p-2 text-zinc-700 hover:text-rose-500 transition-colors">
                                                        <ICONS.Trash className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-20 text-center opacity-20 flex flex-col items-center">
                                                    <ICONS.ShoppingBag className="w-12 h-12 mb-4" />
                                                    <p className="font-black uppercase tracking-[0.2em]">{t('cart_empty')}</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Direita: Checkout e Info */}
                    <div className="w-full lg:w-[400px] p-6 bg-[#1c1c20]/30 border-l border-border flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
                        {/* Cliente */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('client')}</label>
                                <button onClick={() => setShowQuickClient(true)} className="text-[9px] font-black text-purple-400 uppercase">+ {t('include')}</button>
                            </div>
                            {showQuickClient ? (
                                <div className="flex gap-2 animate-in slide-in-from-right-4 duration-300">
                                    <input
                                        value={quickClientName}
                                        onChange={(e) => setQuickClientName(e.target.value)}
                                        className="input-standard flex-1 text-xs"
                                        placeholder="Nome do Cliente"
                                    />
                                    <button onClick={handleQuickClientSave} className="p-3 bg-white text-black rounded-xl"><ICONS.Plus className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <select
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    className="input-standard w-full text-xs appearance-none"
                                >
                                    <option value="">Consumidor Final</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Resumo Financeiro */}
                        <div className="space-y-4 bg-background-main/50 p-6 rounded-[2rem] border border-border shadow-2xl">
                            <div className="flex justify-between text-[10px] font-black uppercase text-zinc-500">
                                <span>Subtotal</span>
                                <span>R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-black uppercase text-rose-500/80">
                                <span>Desconto nos Items</span>
                                <span>- R$ {itemsDiscount.toFixed(2)}</span>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('total_discount')}</label>
                                <input
                                    type="number"
                                    value={globalDiscount || ''}
                                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                                    className="bg-transparent border-b border-zinc-800 w-full py-1 text-sm font-black text-rose-500 outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="pt-4 mt-4 border-t border-border flex justify-between items-end">
                                <span className="text-xs font-black text-white uppercase tracking-[0.2em] mb-1">Total a Receber</span>
                                <span className="text-3xl font-black text-emerald-500 tracking-tighter">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Checkout Options */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('payment_method')}</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="input-standard w-full text-xs"
                                >
                                    <option value="Dinheiro">Dinheiro</option>
                                    <option value="Pix">Pix</option>
                                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                                    <option value="Cartão de Débito">Cartão de Débito</option>
                                    <option value="Boleto">Boleto</option>
                                </select>
                            </div>

                            <div className="p-4 bg-background-main/30 border border-border rounded-3xl space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded-lg bg-zinc-800 border-border text-purple-600 focus:ring-0"
                                        checked={isInstallments}
                                        onChange={(e) => setIsInstallments(e.target.checked)}
                                    />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-zinc-300 uppercase group-hover:text-white transition-colors">{t('installments')}</p>
                                        <p className="text-[8px] font-bold text-zinc-600 uppercase">Gerar contas a receber no financeiro</p>
                                    </div>
                                </label>

                                {isInstallments && (
                                    <div className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-300">
                                        <label className="text-[9px] font-black text-zinc-500 uppercase whitespace-nowrap">{t('installments_count')}:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="12"
                                            value={installmentsCount}
                                            onChange={(e) => setInstallmentsCount(parseInt(e.target.value) || 1)}
                                            className="input-standard py-2 px-3 text-center w-16"
                                        />
                                        <span className="text-[10px] text-zinc-400 font-bold tracking-tighter italic">
                                            {installmentsCount}x R$ {(total / installmentsCount).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-6 border-t border-border mt-auto">
                            <p className="text-[8px] font-bold text-zinc-600 uppercase mb-4 tracking-widest text-center italic">
                                {t('stock_deduction_info')}
                            </p>
                            <button
                                onClick={handleSaveSale}
                                disabled={isSubmitting || items.length === 0}
                                className="btn-premium-primary w-full py-5 text-sm font-black shadow-2xl shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-20"
                            >
                                {isSubmitting ? "PROCESSANDO..." : status === SaleStatus.QUOTE ? "SALVAR ORÇAMENTO" : "FINALIZAR E RECEBER"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleModal;
