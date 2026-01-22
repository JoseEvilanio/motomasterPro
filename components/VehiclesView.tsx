import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Bike,
  Search,
  Plus,
  Edit3,
  Trash2,
  User,
  Hash,
  Calendar,
  Palette,
  X
} from 'lucide-react';
import { Vehicle, User as UserType, UserRole } from '../types';
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
  deleteDoc,
  updateDoc,
  increment
} from 'firebase/firestore';

interface VehicleEntry extends Vehicle {
  createdAt?: any;
}

const VehiclesView: React.FC<{ user: UserType }> = ({ user }) => {
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleEntry | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<VehicleEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    clientId: '',
    brand: '',
    model: '',
    year: '',
    plate: '',
    color: ''
  });

  useEffect(() => {
    const ownerId = (user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN)
      ? user.id
      : user.ownerId;

    if (!ownerId) {
      setLoading(false);
      return;
    }

    const vRef = collection(db, 'vehicles');
    const vQuery = query(vRef, where('ownerId', '==', ownerId));

    const unsubscribeVehicles = onSnapshot(vQuery, (snapshot) => {
      const vData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VehicleEntry[];

      const sorted = vData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setVehicles(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Vehicles Sync Error:", error);
      toast.error("Erro ao sincronizar frota.");
      setLoading(false);
    });

    const cRef = collection(db, 'clients');
    const cQuery = query(cRef, where('ownerId', '==', ownerId));
    const unsubscribeClients = onSnapshot(cQuery, (snapshot) => {
      const cData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setClients(cData);
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeClients();
    };
  }, [user.id, user.ownerId, user.role]);

  const handleSaveVehicle = async () => {
    if (!formData.clientId || !formData.brand || !formData.model || !formData.plate) {
      toast.error("Preencha todos os campos obrigatórios da moto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ownerId: user.role === UserRole.ADMIN ? user.id : user.ownerId!,
        clientId: formData.clientId,
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year) || new Date().getFullYear(),
        plate: formData.plate.toUpperCase(),
        color: formData.color || 'N/A',
        updatedAt: serverTimestamp()
      };

      if (editingVehicle) {
        const vehicleDocRef = doc(db, 'vehicles', editingVehicle.id);
        if (editingVehicle.clientId !== formData.clientId) {
          await updateDoc(doc(db, 'clients', editingVehicle.clientId), { bikes: increment(-1) }).catch(() => { });
          await updateDoc(doc(db, 'clients', formData.clientId), { bikes: increment(1) }).catch(() => { });
        }
        await updateDoc(vehicleDocRef, payload);
        toast.success("Dados do veículo atualizados.");
      } else {
        await addDoc(collection(db, 'vehicles'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        const clientDocRef = doc(db, 'clients', formData.clientId);
        await updateDoc(clientDocRef, { bikes: increment(1) });
        toast.success("Nova moto cadastrada com sucesso!");
      }

      closeModal();
    } catch (error) {
      console.error("Save Vehicle Error:", error);
      toast.error("Erro ao salvar veículo no banco.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!vehicleToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'vehicles', vehicleToDelete.id));
      if (vehicleToDelete.clientId) {
        await updateDoc(doc(db, 'clients', vehicleToDelete.clientId), { bikes: increment(-1) }).catch(() => { });
      }
      toast.success("Registro removido do sistema.");
      setIsDeleteModalOpen(false);
      setVehicleToDelete(null);
    } catch (error) {
      console.error("Delete Vehicle Error:", error);
      toast.error("Erro ao excluir veículo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (vehicle: VehicleEntry) => {
    setEditingVehicle(vehicle);
    setFormData({
      clientId: vehicle.clientId,
      brand: vehicle.brand,
      model: vehicle.model,
      year: String(vehicle.year),
      plate: vehicle.plate,
      color: vehicle.color
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
    setFormData({ clientId: '', brand: '', model: '', year: '', plate: '', color: '' });
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente Removido';

  const filteredVehicles = vehicles.filter(v =>
    v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">FROTA DE MOTOS</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Gestão Técnica de Veículos</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-white text-black px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 shadow-xl active:scale-95 transition-all flex items-center gap-2"
        >
          <Bike className="w-4 h-4" /> Cadastrar Moto
        </button>
      </div>

      <div className="bg-background-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border bg-[#1c1c20]/30 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="relative w-full max-w-lg">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Pesquisar por modelo, marca ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background-main border border-border text-sm w-full pl-14 pr-6 py-4 rounded-[1.25rem] focus:border-purple-500/50 outline-none text-zinc-100 placeholder:text-zinc-600 transition-all font-medium"
            />
          </div>
          <div className="flex items-center gap-6 px-6 border-l border-border hidden md:flex">
            <div className="text-right">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Veículos</p>
              <p className="text-lg font-black text-white">{vehicles.length}</p>
            </div>
            <Bike className="w-8 h-8 text-zinc-800" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
              <tr>
                <th className="px-8 py-5 font-black uppercase tracking-widest">Veículo Details</th>
                <th className="px-8 py-5 font-black uppercase tracking-widest">Proprietário</th>
                <th className="px-8 py-5 font-black uppercase tracking-widest text-center">Placa / Ano</th>
                <th className="px-8 py-5 font-black uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center animate-pulse text-zinc-600 font-black uppercase tracking-[0.2em]">Sincronizando Frota...</td></tr>
              ) : filteredVehicles.length === 0 ? (
                <tr><td colSpan={4} className="p-32 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <Bike className="w-12 h-12 text-zinc-800" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Frota Vazia</p>
                  </div>
                </td></tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="group hover:bg-white/[0.01] transition-colors cursor-pointer">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-background-main border border-border flex items-center justify-center group-hover:border-purple-500/50 transition-colors">
                          <Bike className="w-6 h-6 text-zinc-500 group-hover:text-purple-500 transition-colors" />
                        </div>
                        <div>
                          <p className="font-black text-zinc-100 text-sm tracking-tight uppercase">{v.brand}</p>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{v.model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-zinc-400 group-hover:text-zinc-200 font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-zinc-600" />
                        {getClientName(v.clientId)}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center gap-3">
                        <span className="bg-background-main px-3 py-1.5 rounded-xl font-mono border border-border text-white text-[11px] font-black tracking-widest uppercase">
                          {v.plate}
                        </span>
                        <span className="text-zinc-600 font-black">|</span>
                        <span className="text-zinc-400 font-black text-[10px]">{v.year}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                        <button
                          onClick={() => openEditModal(v)}
                          className="bg-background-main border border-border p-3 rounded-xl text-zinc-500 hover:text-white hover:border-white/20 transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setVehicleToDelete(v); setIsDeleteModalOpen(true); }}
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
          <div className="bg-background-card border border-border w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 blur-3xl rounded-full -mr-20 -mt-20"></div>

            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">{editingVehicle ? "EDITAR VEÍCULO" : "NOVO VEÍCULO"}</h2>
              <button onClick={closeModal} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                  <User className="w-3 h-3 text-purple-500" /> Proprietário Vínculo
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500 outline-none transition-colors font-medium appearance-none"
                >
                  <option value="">Selecione o Cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <Bike className="w-3 h-3 text-purple-500" /> Marca
                  </label>
                  <input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500 transition-colors outline-none font-medium" placeholder="Honda, BMW..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Modelo</label>
                  <input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500 transition-colors outline-none font-medium" placeholder="Hornet 600..." />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <Hash className="w-3 h-3 text-purple-500" /> Placa
                  </label>
                  <input value={formData.plate} onChange={(e) => setFormData({ ...formData, plate: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white uppercase focus:border-purple-500 transition-colors outline-none font-black tracking-widest" placeholder="ABC1D23" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-purple-500" /> Ano
                  </label>
                  <input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-4 py-4 text-sm text-white focus:border-purple-500 transition-colors outline-none font-medium text-center" placeholder="2024" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                  <Palette className="w-3 h-3 text-purple-500" /> Cor / Observações
                </label>
                <input value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500 transition-colors outline-none font-medium" placeholder="Preta Metálica..." />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={closeModal} className="flex-1 text-zinc-500 py-4 text-xs font-black uppercase tracking-widest hover:text-white transition-colors">Voltar</button>
                <button
                  onClick={handleSaveVehicle}
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
            <h3 className="text-white font-black text-xl uppercase tracking-widest mb-4">REMOVER VEÍCULO?</h3>
            <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-10 px-4">Esta ação apagará permanentemente o registro da moto e desvinculará do cliente.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={executeDelete}
                disabled={isSubmitting}
                className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "REMOVENDO..." : "CONFIRMAR EXCLUSÃO"}
              </button>
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-zinc-400 transition-colors">Abortar Operação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehiclesView;
