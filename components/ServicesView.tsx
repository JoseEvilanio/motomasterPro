import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { User, Service, UserRole } from '../types';
import { ICONS } from '../constants';
import { t } from '../translations';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    serverTimestamp,
    doc,
    deleteDoc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface ServicesViewProps {
    user: User;
}

const ServicesView: React.FC<ServicesViewProps> = ({ user }) => {
    const [servicesList, setServicesList] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        estimatedTime: ''
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
            collection(db, 'services'),
            where('ownerId', '==', ownerId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Service[];
            const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
            setServicesList(sorted);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar serviços:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user.id, user.ownerId, user.role]);

    const handleSaveService = async () => {
        const { name, price } = formData;

        if (!name || !price) {
            toast.error(t('fill_all_fields'));
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                price: parseFloat(price),
                ownerId: (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN) ? user.id : user.ownerId!,
                updatedAt: serverTimestamp()
            };

            if (editingService) {
                await updateDoc(doc(db, 'services', editingService.id), payload);
                toast.success("Serviço atualizado com sucesso!");
            } else {
                await addDoc(collection(db, 'services'), {
                    ...payload,
                    createdAt: serverTimestamp()
                });
                toast.success("Novo serviço adicionado ao catálogo!");
            }
            closeModal();
        } catch (error) {
            console.error("Erro ao salvar serviço:", error);
            toast.error("Erro ao salvar no banco de dados.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (service: Service) => {
        setEditingService(service);
        setFormData({
            name: service.name,
            description: service.description || '',
            price: String(service.price),
            category: service.category || '',
            estimatedTime: service.estimatedTime || ''
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
        setFormData({ name: '', description: '', price: '', category: '', estimatedTime: '' });
    };

    const confirmDelete = (service: Service) => {
        setServiceToDelete(service);
        setIsDeleteModalOpen(true);
    };

    const executeDelete = async () => {
        if (!serviceToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, 'services', serviceToDelete.id));
            toast.success("Serviço removido permanentemente.");
            setIsDeleteModalOpen(false);
            setServiceToDelete(null);
        } catch (error) {
            console.error("Erro ao deletar:", error);
            toast.error("Erro ao remover serviço.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredServices = servicesList.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-main">{t('services')}</h2>
                    <p className="text-secondary">Catálogo de Mão de Obra & Procedimentos</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn-premium-primary w-full sm:w-auto"
                >
                    {t('add_service')}
                </button>
            </div>

            <div className="card-premium">
                <div className="p-4 border-b border-border flex justify-between items-center bg-[#1c1c20]/30">
                    <div className="relative w-full max-w-md">
                        <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Pesquisar serviços..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent text-sm w-full pl-11 py-2 focus:outline-none text-zinc-100 placeholder:text-zinc-600"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[600px]">
                        <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider">Descrição do Serviço</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Categoria</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Tempo Est.</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Valor R$</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={5} className="p-10 text-center animate-pulse text-zinc-600 font-black">Sincronizando catálogo...</td></tr>
                            ) : filteredServices.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-20 text-center text-zinc-600 italic">Nenhum serviço cadastrado.</td></tr>
                            ) : (
                                filteredServices.map((service) => (
                                    <tr key={service.id} className="hover:bg-white/[0.01] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-background-main border border-border flex items-center justify-center group-hover:border-purple-500/50 transition-colors">
                                                    <ICONS.Wrench className="w-5 h-5 text-zinc-500 group-hover:text-purple-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-zinc-100 text-sm tracking-tight">{service.name}</p>
                                                    {service.description && <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">{service.description}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400 font-bold uppercase text-[9px]">
                                                {service.category || "Geral"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-zinc-500 font-mono font-bold">{service.estimatedTime || "---"}</td>
                                        <td className="px-6 py-4 text-center text-zinc-100 font-black">R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEditModal(service)} className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"><ICONS.Edit className="w-4 h-4" /></button>
                                                <button onClick={() => confirmDelete(service)} className="p-2.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"><ICONS.Trash className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-background-card border border-border w-full max-w-md rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-xl font-black text-white mb-8 tracking-tight uppercase">{editingService ? "EDITAR SERVIÇO" : "ADICIONAR SERVIÇO"}</h2>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Nome do Serviço</label>
                                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-standard w-full" placeholder="Ex: Troca de Óleo e Filtro" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Descrição Detalhada</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input-standard w-full h-24 resize-none py-3"
                                    placeholder="Descreva os procedimentos incluídos..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Valor (Mão de Obra)</label>
                                    <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="input-standard w-full" placeholder="0.00" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Tempo Est. (Minutos)</label>
                                    <input type="text" value={formData.estimatedTime} onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })} className="input-standard w-full" placeholder="Ex: 45 min" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Categoria</label>
                                <input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-standard w-full" placeholder="Ex: Motor, Elétrica, Geral" />
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button onClick={closeModal} className="flex-1 text-zinc-500 py-4 text-xs font-black uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
                                <button onClick={handleSaveService} disabled={isSubmitting} className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-background-card border border-rose-500/20 p-8 rounded-3xl max-w-xs w-full shadow-[0_0_50px_-12px_rgba(244,63,94,0.2)] text-center">
                        <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                            <ICONS.Trash className="w-10 h-10 text-rose-500" />
                        </div>
                        <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-2">Excluir Serviço?</h3>
                        <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-8 px-4">Esta ação removerá o serviço do catálogo permanentemente.</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={executeDelete}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? "Removendo..." : "Confirmar Exclusão"}
                            </button>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-3 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-zinc-300 transition-colors">Voltar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesView;
