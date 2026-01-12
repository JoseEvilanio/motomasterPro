import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { User, Sale, SaleStatus, UserRole } from '../types';
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
    deleteDoc,
    orderBy,
    increment
} from 'firebase/firestore';
import { db } from '../services/firebase';
import SaleModal from './SaleModal.tsx';
import SalesReports from './SalesReports.tsx';
import SalePrintPreview from './SalePrintPreview.tsx';

interface SalesManagementProps {
    user: User;
}

const SalesManagement: React.FC<SalesManagementProps> = ({ user }) => {
    const [salesList, setSalesList] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [printData, setPrintData] = useState<{ sale: Sale; type: 'THERMAL' | 'DOT_MATRIX' | 'LASER' } | null>(null);
    const [clients, setClients] = useState<any[]>([]);

    useEffect(() => {
        const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
        const qSales = query(
            collection(db, 'sales'),
            where('ownerId', '==', ownerId)
        );

        const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
            const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
            // Ordenação client-side para evitar a necessidade de índice composto no Firestore
            const sortedSales = sales.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
            setSalesList(sortedSales);
            setLoading(false);
        }, (error) => {
            console.error("Sales Sync Error:", error);
            setLoading(false);
        });

        const unsubscribeClients = onSnapshot(collection(db, 'clients'), (snap) => {
            setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubscribeSales();
            unsubscribeClients();
        };
    }, [user.id, user.ownerId, user.role]);

    const handlePrintRequest = (sale: Sale, type: 'THERMAL' | 'DOT_MATRIX' | 'LASER') => {
        setPrintData({ sale, type });
    };

    const handleCreateSale = () => {
        setEditingSale(null);
        setIsSaleModalOpen(true);
    };

    const handleEditSale = (sale: Sale) => {
        if (sale.status === SaleStatus.FINALIZED) {
            toast.error("Vendas finalizadas não podem ser alteradas.");
            return;
        }
        setEditingSale(sale);
        setIsSaleModalOpen(true);
    };

    const handleFinalizeSale = async (sale: Sale) => {
        try {
            await updateDoc(doc(db, 'sales', sale.id), {
                status: SaleStatus.FINALIZED,
                updatedAt: serverTimestamp()
            });

            // Stock deduction logic
            for (const item of sale.items) {
                if (item.type === 'PRODUCT' && item.id !== 'manual') {
                    const productRef = doc(db, 'products', item.id);
                    await updateDoc(productRef, {
                        stock: increment(-item.quantity),
                        updatedAt: serverTimestamp()
                    });
                }
            }

            const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
            // Financial transaction
            await addDoc(collection(db, 'transactions'), {
                ownerId: ownerId,
                label: `Venda #${sale.id.slice(-4)} (Refinalizada)`,
                amount: sale.total,
                category: 'INCOME',
                status: sale.isInstallments ? 'PENDING' : 'PAID',
                paymentMethod: sale.paymentMethod,
                date: serverTimestamp()
            });

            toast.success("Venda finalizada e estoque atualizado!");
        } catch (err) {
            toast.error("Erro ao finalizar venda.");
        }
    };

    const handleCancelSale = async (saleId: string) => {
        try {
            await updateDoc(doc(db, 'sales', saleId), {
                status: SaleStatus.CANCELLED,
                updatedAt: serverTimestamp()
            });
            toast.success("Venda cancelada.");
        } catch (err) {
            toast.error("Erro ao cancelar venda.");
        }
    };

    const filteredSales = salesList.filter(s =>
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-main">{t('sales_mgt')}</h2>
                    <p className="text-secondary">{t('sales_mgt_desc')}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => setIsReportsModalOpen(true)} className="btn-premium-secondary flex-1 sm:flex-none">
                        <ICONS.Chart className="w-4 h-4" /> {t('sale_reports')}
                    </button>
                    <button onClick={handleCreateSale} className="btn-premium-primary flex-1 sm:flex-none">
                        <ICONS.Plus className="w-4 h-4" /> {t('new_sale')}
                    </button>
                </div>
            </div>

            <div className="card-premium">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#1c1c20]/30">
                    <div className="relative w-full max-w-md">
                        <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder={t('search_sales')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent text-sm w-full pl-11 py-2 focus:outline-none text-zinc-100 placeholder:text-zinc-600"
                        />
                    </div>

                    <div className="flex gap-2 text-[10px] font-black uppercase text-zinc-500">
                        <span className="px-2 py-1 bg-zinc-800 rounded-lg border border-border">Total: {salesList.length}</span>
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
                            R$ {salesList.filter(s => s.status === SaleStatus.FINALIZED).reduce((acc, s) => acc + s.total, 0).toLocaleString('pt-BR')}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[800px]">
                        <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border font-black uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">ID / Data</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Itens</th>
                                <th className="px-6 py-4 text-center">Pagamento</th>
                                <th className="px-6 py-4 text-right">Total R$</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={6} className="p-20 text-center animate-pulse text-zinc-600 font-black">Sincronizando banco de dados...</td></tr>
                            ) : filteredSales.length === 0 ? (
                                <tr><td colSpan={6} className="p-20 text-center text-zinc-600 italic">Nenhuma venda ou orçamento encontrado.</td></tr>
                            ) : (
                                filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-white/[0.01] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-zinc-100 text-sm tracking-tight mb-1">#{sale.id.slice(-6).toUpperCase()}</span>
                                                <span className="text-[10px] text-zinc-500 font-mono italic">
                                                    {sale.createdAt?.toDate().toLocaleDateString('pt-BR')} {sale.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${sale.status === SaleStatus.FINALIZED ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                sale.status === SaleStatus.ORDER ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                    sale.status === SaleStatus.QUOTE ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        'bg-zinc-800 text-zinc-500 border-border'
                                                }`}>
                                                {t(sale.status.toLowerCase() as any)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-zinc-400 font-bold">{sale.items.length}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-zinc-100 font-black text-[10px] uppercase">{sale.paymentMethod}</span>
                                                {sale.isInstallments && <span className="text-[8px] text-purple-400 font-black mt-0.5">{sale.installmentsCount}x PARCELADO</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-zinc-100 font-black text-sm">R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                {sale.totalDiscount > 0 && <span className="text-[8px] text-rose-500 font-black tracking-tighter">DESC: R$ {sale.totalDiscount.toFixed(2)}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {sale.status !== SaleStatus.FINALIZED && (
                                                    <button onClick={() => handleFinalizeSale(sale)} className="p-2 text-emerald-500 hover:text-white hover:bg-emerald-500/20 rounded-lg transition-all" title={t('finalize')}><ICONS.CheckCircle2 className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => handleEditSale(sale)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all" title={t('alter')}><ICONS.Edit className="w-4 h-4" /></button>

                                                <div className="relative group/print">
                                                    <button className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"><ICONS.Printer className="w-4 h-4" /></button>
                                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/print:flex flex-col bg-background-card border border-border rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                        <button onClick={() => handlePrintRequest(sale, 'THERMAL')} className="px-4 py-2 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white text-right border-b border-border">Cupom Térmico</button>
                                                        <button onClick={() => handlePrintRequest(sale, 'DOT_MATRIX')} className="px-4 py-2 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white text-right border-b border-border">Matricial 80 Col</button>
                                                        <button onClick={() => handlePrintRequest(sale, 'LASER')} className="px-4 py-2 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white text-right">Jato Tinta / Laser</button>
                                                    </div>
                                                </div>

                                                <button onClick={() => handleCancelSale(sale.id)} className="p-2 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" title={t('cancel')}><ICONS.X className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isSaleModalOpen && (
                <SaleModal
                    user={user}
                    isOpen={isSaleModalOpen}
                    onClose={() => setIsSaleModalOpen(false)}
                    sale={editingSale}
                />
            )}

            {isReportsModalOpen && (
                <SalesReports
                    user={user}
                    isOpen={isReportsModalOpen}
                    onClose={() => setIsReportsModalOpen(false)}
                    sales={salesList}
                />
            )}

            {printData && (
                <SalePrintPreview
                    sale={printData.sale}
                    client={clients.find(c => c.id === printData.sale.clientId)}
                    user={user}
                    type={printData.type}
                    onClose={() => setPrintData(null)}
                />
            )}
        </div>
    );
};

export default SalesManagement;
