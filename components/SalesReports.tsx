import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { ICONS } from '../constants';
import { t } from '../translations';
import { Sale, SaleStatus } from '../types';

interface SalesReportsProps {
    user: any;
    isOpen: boolean;
    onClose: () => void;
    sales: Sale[];
}

const SalesReports: React.FC<SalesReportsProps> = ({ isOpen, onClose, sales }) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [reportType, setReportType] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const dateMatch = (!dateRange.start || sale.createdAt?.toDate() >= new Date(dateRange.start)) &&
                (!dateRange.end || sale.createdAt?.toDate() <= new Date(dateRange.end));
            const statusMatch = statusFilter === 'ALL' || sale.status === statusFilter;
            return dateMatch && statusMatch;
        });
    }, [sales, dateRange, statusFilter]);

    const stats = useMemo(() => {
        const totalRevenue = filteredSales.filter(s => s.status === SaleStatus.FINALIZED).reduce((acc, s) => acc + s.total, 0);
        const totalQuotes = filteredSales.filter(s => s.status === SaleStatus.QUOTE).length;
        const itemsSold = filteredSales.reduce((acc, s) => acc + s.items.length, 0);
        return { totalRevenue, totalQuotes, itemsSold };
    }, [filteredSales]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[70] flex items-center justify-center p-4 lg:p-12 animate-in zoom-in-95 duration-300">
            <div className="bg-background-card border border-border w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] shadow-[0_0_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-10 border-b border-border bg-gradient-to-r from-zinc-900 to-black/20 flex justify-between items-center">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 shadow-inner">
                            <ICONS.Chart className="w-8 h-8 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t('sale_reports')}</h2>
                            <p className="text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase mt-1">Inteligência de Vendas & Performance</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-zinc-500 hover:text-white transition-all">
                        <ICONS.X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-10 bg-black/20 grid grid-cols-1 md:grid-cols-4 gap-8 border-b border-border">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('start_date')}</label>
                        <input
                            type="date"
                            className="input-standard w-full text-xs font-mono"
                            value={dateRange.start}
                            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('end_date')}</label>
                        <input
                            type="date"
                            className="input-standard w-full text-xs font-mono"
                            value={dateRange.end}
                            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('status')}</label>
                        <select
                            className="input-standard w-full text-xs"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">Todos os Status</option>
                            <option value={SaleStatus.QUOTE}>Orçamentos</option>
                            <option value={SaleStatus.ORDER}>Pedidos</option>
                            <option value={SaleStatus.FINALIZED}>Finalizadas</option>
                            <option value={SaleStatus.CANCELLED}>Canceladas</option>
                        </select>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Tipo de Visão</label>
                        <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-border">
                            <button
                                onClick={() => setReportType('SUMMARY')}
                                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'SUMMARY' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-zinc-500'}`}
                            >
                                {t('summary')}
                            </button>
                            <button
                                onClick={() => setReportType('DETAILED')}
                                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${reportType === 'DETAILED' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-zinc-500'}`}
                            >
                                {t('detailed')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="card-premium p-8 border-emerald-500/20 bg-emerald-500/[0.02]">
                            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mb-4">Receita Líquida (Pagos)</p>
                            <p className="text-3xl font-black text-white tracking-tighter">R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="card-premium p-8 border-amber-500/20 bg-amber-500/[0.02]">
                            <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest mb-4">Orçamentos Pendentes</p>
                            <p className="text-3xl font-black text-white tracking-tighter">{stats.totalQuotes}</p>
                        </div>
                        <div className="card-premium p-8 border-zinc-500/20 bg-zinc-500/[0.02]">
                            <p className="text-[10px] font-black text-zinc-500/60 uppercase tracking-widest mb-4">Itens Movimentados</p>
                            <p className="text-3xl font-black text-white tracking-tighter">{stats.itemsSold}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-2">Histórico Filtrado</h3>
                        <div className="bg-[#141417]/50 border border-border rounded-[2.5rem] overflow-hidden shadow-inner">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-black/20 text-zinc-600 font-black uppercase text-[9px] border-b border-border">
                                    <tr>
                                        <th className="px-8 py-5">Venda / Data</th>
                                        <th className="px-8 py-5">Status</th>
                                        {reportType === 'DETAILED' && <th className="px-8 py-5">Resumo de Itens</th>}
                                        <th className="px-8 py-5 text-right">Valor R$</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filteredSales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-white/[0.01]">
                                            <td className="px-8 py-5 flex flex-col gap-1">
                                                <span className="font-bold text-zinc-200">#{(sale.id || '').toUpperCase().slice(-8)}</span>
                                                <span className="text-[9px] font-mono text-zinc-600 italic">
                                                    {sale.createdAt?.toDate().toLocaleDateString('pt-BR')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${sale.status === SaleStatus.FINALIZED ? 'bg-emerald-500/10 text-emerald-500' :
                                                    sale.status === SaleStatus.ORDER ? 'bg-blue-500/10 text-blue-500' :
                                                        'bg-zinc-800 text-zinc-500'
                                                    }`}>
                                                    {t(sale.status.toLowerCase() as any)}
                                                </span>
                                            </td>
                                            {reportType === 'DETAILED' && (
                                                <td className="px-8 py-5 max-w-xs">
                                                    <p className="truncate text-zinc-500 text-[10px]">
                                                        {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                                    </p>
                                                </td>
                                            )}
                                            <td className="px-8 py-5 text-right">
                                                <span className="font-black text-white">R$ {sale.total.toFixed(2)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-10 border-t border-border bg-black/40 flex justify-end gap-4">
                    <button className="btn-premium-secondary px-10 py-4 text-[10px]" onClick={onClose}>FECHAR</button>
                    <button
                        className="btn-premium-primary px-10 py-4 text-[10px]"
                        onClick={() => toast.success("Exportação iniciada...")}
                    >
                        <ICONS.Printer className="w-4 h-4" /> EXPORTAR RELATÓRIO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesReports;
