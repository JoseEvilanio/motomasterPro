import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { User, UserRole } from '../types';
import { ICONS } from '../constants';
import { t } from '../translations';
import { generateFinancialReport } from '../services/geminiService';
import { db } from '../services/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';

interface Transaction {
  id: string;
  ownerId: string;
  label: string;
  category: 'INCOME' | 'EXPENSE';
  amount: number;
  date: any;
  status: 'PAID' | 'PENDING';
  paymentMethod?: string;
}

const FinancialView: React.FC<{ user: User }> = ({ user }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [formData, setFormData] = useState({
    label: '',
    category: 'INCOME' as 'INCOME' | 'EXPENSE',
    amount: '',
    status: 'PAID' as 'PAID' | 'PENDING',
    paymentMethod: 'Pix'
  });

  useEffect(() => {
    const ownerId = (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN)
      ? user.id
      : user.ownerId;

    if (!ownerId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('ownerId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      const sorted = data.sort((a, b) => {
        const dateA = a.date?.seconds || 0;
        const dateB = b.date?.seconds || 0;
        return dateB - dateA;
      });
      setTransactions(sorted);
      setLoading(false);
    }, (err) => {
      console.error("Financial access error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.id, user.ownerId, user.role]);

  const rawStats = useMemo(() => {
    let revenue = 0; let costs = 0;
    transactions.forEach(tx => {
      if (tx.status === 'PAID') {
        if (tx.category === 'INCOME') revenue += tx.amount;
        else costs += tx.amount;
      }
    });
    return { revenue, costs, profit: revenue - costs };
  }, [transactions]);

  const stats = useMemo(() => {
    return {
      revenue: `R$ ${rawStats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      costs: `R$ ${rawStats.costs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      profit: `R$ ${rawStats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    };
  }, [rawStats]);

  const handleSaveTransaction = async () => {
    if (!formData.label || !formData.amount) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        ownerId: (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN) ? user.id : user.ownerId!,
        date: editingTransaction?.date || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), payload);
        toast.success("Transação atualizada.");
      } else {
        await addDoc(collection(db, 'transactions'), payload);
        toast.success("Lançamento realizado com sucesso.");
      }
      closeFormModal();
    } catch (error) {
      console.error("Financial save error:", error);
      toast.error("Erro ao salvar transação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportContent(null);
    setIsReportModalOpen(true);
    try {
      const result = await generateFinancialReport(stats, transactions.slice(0, 10));
      setReportContent(result);
      if (result) toast.success("Relatório gerado pela IA!");
      else toast.error("Falha ao gerar relatório.");
    } catch (error) {
      toast.error("Erro na comunicação com a IA.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingTransaction(null);
    setFormData({ label: '', category: 'INCOME', amount: '', status: 'PAID', paymentMethod: 'Pix' });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-main">Fluxo Financeiro</h2>
          <p className="text-secondary">Controle de caixa & IA</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleGenerateReport}
            className="btn-premium-secondary flex-1 sm:flex-none"
          >
            ✨ Relatório IA
          </button>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="btn-premium-primary flex-1 sm:flex-none"
          >
            <ICONS.Plus className="w-3.5 h-3.5" /> Lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Receita Total', value: stats.revenue, color: 'text-emerald-500', icon: <ICONS.Plus className="w-4 h-4" /> },
          { label: 'Custos Operacionais', value: stats.costs, color: 'text-rose-500', icon: <ICONS.Trash className="w-4 h-4" /> },
          { label: 'Lucro Líquido', value: stats.profit, color: 'text-purple-500', icon: <ICONS.Chart className="w-4 h-4" /> }
        ].map((s, i) => (
          <div key={i} className="bg-background-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{s.label}</p>
              <div className="p-2 bg-background-main rounded-lg border border-border">{s.icon}</div>
            </div>
            <h3 className={`text-2xl font-black ${s.color} tracking-tight`}>{s.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-background-card border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center animate-pulse text-zinc-600">Buscando transações...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center text-zinc-600 italic">Nenhuma movimentação financeira encontrada.</td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 text-zinc-500 font-mono text-[10px]">
                      {tx.date?.toDate ? tx.date.toDate().toLocaleDateString('pt-BR') : 'Agora'}
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-100">{tx.label}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black ${tx.category === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                        {tx.category === 'INCOME' ? 'ENTRADA' : 'SAÍDA'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-black ${tx.category === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {tx.category === 'INCOME' ? '+ ' : '- '}R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-background-card border border-border w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-8 tracking-tight uppercase">NOVO LANÇAMENTO</h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Descrição</label>
                <input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} className="input-standard w-full" placeholder="Ex: Peças para OS #1234" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Categoria</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as any })} className="input-standard w-full">
                    <option value="INCOME">Receita (+)</option>
                    <option value="EXPENSE">Despesa (-)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Valor R$</label>
                  <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="input-standard w-full" placeholder="0,00" />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={closeFormModal} className="btn-premium-secondary flex-1">Cancelar</button>
                <button onClick={handleSaveTransaction} disabled={isSubmitting} className="btn-premium-primary flex-1">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-background-card border border-border w-full max-w-2xl rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-black text-xl tracking-tight uppercase flex items-center gap-3">
                <span className="text-purple-500">✨</span> ANÁLISE DO CFO (IA)
              </h2>
              <button onClick={() => setIsReportModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-background-main/30 rounded-2xl border border-border/50">
              {isGeneratingReport ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                  <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest animate-pulse">Consultando oráculo financeiro...</p>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  {reportContent ? (
                    <ReactMarkdown>{reportContent}</ReactMarkdown>
                  ) : (
                    <p className="text-rose-500 text-center font-bold">Falha ao carregar o relatório. Tente novamente.</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsReportModalOpen(false)}
              className="mt-6 w-full py-4 bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all"
            >
              Fechar Análise
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialView;
