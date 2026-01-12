import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  X,
  Phone,
  Mail,
  LayoutGrid,
  Bike,
  Palette,
  Calendar,
  Hash
} from 'lucide-react';
import { t } from '../translations';
import { db } from '../services/firebase';
import { User, UserRole } from '../types';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
  increment
} from 'firebase/firestore';

interface ClientEntry {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  taxId: string;
  status: string;
  bikes: number;
  lastService: string;
  color: string;
  createdAt?: any;
}

const ClientList: React.FC<{ user: User }> = ({ user }) => {
  const [clientList, setClientList] = useState<ClientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientEntry | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    // Vehicle fields (optional during creation)
    hasVehicle: false,
    brand: '',
    model: '',
    plate: '',
    year: '',
    color: ''
  });

  const formatTaxId = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").substring(0, 14);
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").substring(0, 18);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3").substring(0, 14);
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3").substring(0, 15);
  };

  useEffect(() => {
    const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
    const q = query(
      collection(db, 'clients'),
      where('ownerId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClientEntry[];

      const sorted = data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });

      setClientList(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Clients Error:", error);
      toast.error("Falha ao sincronizar clientes.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.id, user.ownerId, user.role]);

  const handleCreateOrUpdateClient = async () => {
    if (!formData.name || !formData.phone) {
      toast.error("Nome e Telefone são obrigatórios.");
      return;
    }

    // If vehicle toggle is on, validate vehicle fields
    if (!editingClient && formData.hasVehicle) {
      if (!formData.brand || !formData.model || !formData.plate) {
        toast.error("Preencha os dados da moto ou desative a opção de veículo.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          taxId: formData.taxId,
          updatedAt: serverTimestamp()
        });
        toast.success("Perfil do cliente atualizado!");
      } else {
        const colors = ['bg-blue-400', 'bg-purple-400', 'bg-green-400', 'bg-rose-400', 'bg-emerald-400', 'bg-amber-400'];
        const clientPayload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          taxId: formData.taxId,
          ownerId: user.role === UserRole.ADMIN ? user.id : user.ownerId!,
          status: 'Active',
          bikes: formData.hasVehicle ? 1 : 0,
          lastService: 'Sem serviços',
          color: colors[Math.floor(Math.random() * colors.length)],
          createdAt: serverTimestamp()
        };

        const clientRef = await addDoc(collection(db, 'clients'), clientPayload);

        // Register Vehicle if toggled
        if (formData.hasVehicle) {
          const vehiclePayload = {
            ownerId: user.role === UserRole.ADMIN ? user.id : user.ownerId!,
            clientId: clientRef.id,
            brand: formData.brand,
            model: formData.model,
            year: formData.year ? parseInt(formData.year) : new Date().getFullYear(),
            plate: formData.plate.toUpperCase(),
            color: formData.color || 'N/A',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          await addDoc(collection(db, 'vehicles'), vehiclePayload);
        }

        toast.success("Cliente cadastrado com sucesso!");
      }
      closeAndReset();
    } catch (error: any) {
      console.error("Save Client Error:", error);
      toast.error("Erro ao salvar dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!clientToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'clients', clientToDelete.id));
      toast.success("Cliente removido permanentemente.");
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (error: any) {
      toast.error("Erro ao excluir registro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAndReset = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({
      name: '', email: '', phone: '', taxId: '',
      hasVehicle: false,
      brand: '', model: '', plate: '', year: '', color: ''
    });
  };

  const filteredClients = clientList.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-main">MEUS CLIENTES</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <p className="text-secondary">Base de Dados Conectada</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-premium-primary"
        >
          <UserPlus className="w-4 h-4" /> Novo Cadastro
        </button>
      </div>

      <div className="card-premium">
        <div className="p-6 border-b border-border bg-[#1c1c20]/30 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Pesquisar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background-main border border-border text-sm w-full pl-14 pr-6 py-4 rounded-[1.25rem] focus:border-purple-500/50 outline-none text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-4 px-6 border-l border-border hidden md:flex">
            <div className="text-right">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Total</p>
              <p className="text-lg font-black text-white">{clientList.length}</p>
            </div>
            <LayoutGrid className="w-8 h-8 text-zinc-800" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
              <tr>
                <th className="px-8 py-5 font-black uppercase tracking-widest">Nome Completo</th>
                <th className="px-8 py-5 font-black uppercase tracking-widest">Informações de Contato</th>
                <th className="px-8 py-5 font-black uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 font-black uppercase tracking-widest text-right">Mecânica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center animate-pulse text-zinc-600 font-black uppercase tracking-[0.2em]">Sincronizando Registros...</td></tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Users className="w-12 h-12 text-zinc-800" />
                      <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Nenhum cliente encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="group hover:bg-white/[0.01] transition-colors cursor-pointer">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${client.color} flex items-center justify-center font-black text-white text-lg shadow-lg`}>
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-black text-zinc-100 text-sm tracking-tight block uppercase">{client.name}</span>
                          <span className="text-[9px] font-black text-zinc-600 tracking-widest uppercase">Membro desde 2024</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          <Mail className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="font-medium">{client.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          <Phone className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="font-medium">{client.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter border border-emerald-500/20">
                        Ativo
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const inviteLink = `${window.location.origin}/portal/registrar?client=${client.id}`;
                            navigator.clipboard.writeText(inviteLink);
                            toast.success("Link de convite para " + client.name + " copiado!");
                          }}
                          className="bg-background-main border border-border p-3 rounded-xl text-zinc-500 hover:text-purple-500 hover:border-purple-500/20 transition-all"
                          title="Gerar Link de Acesso do Cliente"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClient(client);
                            setFormData({
                              name: client.name,
                              email: client.email,
                              phone: client.phone,
                              taxId: client.taxId || '',
                              hasVehicle: false,
                              brand: '', model: '', plate: '', year: '', color: ''
                            });
                            setIsModalOpen(true);
                          }}
                          className="bg-background-main border border-border p-3 rounded-xl text-zinc-500 hover:text-white hover:border-white/20 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setClientToDelete(client); setIsDeleteModalOpen(true); }}
                          className="bg-background-main border border-border p-3 rounded-xl text-zinc-500 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
          <div className="bg-background-card border border-border w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full -mr-20 -mt-20"></div>

            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">{editingClient ? "EDIÇÃO DE PERFIL" : "NOVO CLIENTE"}</h2>
              <button onClick={closeAndReset} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Nome Completo</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-standard w-full"
                    placeholder="Nome do cliente..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Telefone de Contato</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    className="input-standard w-full"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Email Corporativo / Pessoal</label>
                  <input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-standard w-full"
                    placeholder="exemplo@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">CPF / CNPJ</label>
                  <input
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: formatTaxId(e.target.value) })}
                    className="input-standard w-full"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              {!editingClient && (
                <div className="pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Bike className="w-5 h-5 text-purple-500" />
                      <span className="text-sm font-black text-white uppercase tracking-widest">Adicionar Veículo Agora?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.hasVehicle}
                        onChange={(e) => setFormData({ ...formData, hasVehicle: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {formData.hasVehicle && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                            <Bike className="w-3 h-3 text-purple-500" /> Marca
                          </label>
                          <input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="input-standard w-full" placeholder="Honda, BMW..." />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Modelo</label>
                          <input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="input-standard w-full" placeholder="Hornet 600..." />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                            <Hash className="w-3 h-3 text-purple-500" /> Placa
                          </label>
                          <input value={formData.plate} onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })} className="input-standard w-full uppercase" placeholder="ABC1D23" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-purple-500" /> Ano
                          </label>
                          <input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} className="input-standard w-full text-center" placeholder="2024" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                          <Palette className="w-3 h-3 text-purple-500" /> Cor
                        </label>
                        <input value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="input-standard w-full" placeholder="Preta..." />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-8">
                <button onClick={closeAndReset} className="flex-1 text-zinc-500 py-4 text-xs font-black uppercase tracking-widest hover:text-white transition-colors">Voltar</button>
                <button
                  onClick={handleCreateOrUpdateClient}
                  disabled={isSubmitting}
                  className="flex-[2] bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "SALVANDO..." : "CONFIRMAR REGISTRO"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-background-card border border-rose-500/20 p-10 rounded-[2.5rem] max-w-sm w-full shadow-2xl text-center">
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
              <Trash2 className="w-10 h-10 text-rose-500" />
            </div>
            <h3 className="text-white font-black text-xl uppercase tracking-widest mb-4">REMOVER CLIENTE?</h3>
            <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-10">Esta ação é irreversível e apagará todos os vínculos do cliente com sua oficina.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={executeDelete}
                disabled={isSubmitting}
                className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "REMOVENDO..." : "CONFIRMAR EXCLUSÃO"}
              </button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-zinc-400 transition-colors">Manter Registro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;
