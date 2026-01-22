import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { User, Product, UserRole } from '../types';
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

interface InventoryListProps {
  user: User;
}

const InventoryList: React.FC<InventoryListProps> = ({ user }) => {
  const [inventoryList, setInventoryList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    costPrice: '',
    stock: '',
    minStock: '',
    imageUrl: ''
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
      collection(db, 'products'),
      where('ownerId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
      setInventoryList(sorted);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar estoque privado:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.id, user.ownerId, user.role]);

  const handleSaveItem = async () => {
    const { name, sku, price, costPrice, stock, minStock } = formData;

    if (!name || !sku || !price || !costPrice || !stock || !minStock) {
      toast.error(t('fill_all_fields'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Use the Base64 preview directly as the imageUrl
      const finalImageUrl = imagePreview || formData.imageUrl;

      const payload = {
        name,
        sku,
        price: parseFloat(price),
        costPrice: parseFloat(costPrice),
        stock: parseInt(stock),
        minStock: parseInt(minStock),
        imageUrl: finalImageUrl,
        ownerId: user.role === UserRole.ADMIN ? user.id : user.ownerId!,
        updatedAt: serverTimestamp()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'products', editingItem.id), payload);
        toast.success("Produto atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success("Novo item adicionado ao estoque!");
      }
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast.error("Erro ao salvar no banco de dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingItem(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      price: String(product.price),
      costPrice: String(product.costPrice || ''),
      stock: String(product.stock),
      minStock: String(product.minStock),
      imageUrl: product.imageUrl || ''
    });
    setImagePreview(product.imageUrl || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ name: '', sku: '', price: '', costPrice: '', stock: '', minStock: '', imageUrl: '' });
    setImageFile(null);
    setImagePreview(null);
  };

  const confirmDelete = (product: Product) => {
    setItemToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'products', itemToDelete.id));
      toast.success("Item removido permanentemente.");
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro ao remover item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportXML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const xmlString = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        let items = Array.from(xmlDoc.getElementsByTagName("det") || xmlDoc.getElementsByTagName("item"));

        let count = 0;
        for (const item of items) {
          const name = item.getElementsByTagName("xProd")[0]?.textContent;
          const sku = item.getElementsByTagName("cProd")[0]?.textContent;
          const price = item.getElementsByTagName("vUnCom")[0]?.textContent;
          const qty = item.getElementsByTagName("qCom")[0]?.textContent;

          if (name && sku) {
            await addDoc(collection(db, 'products'), {
              name, sku,
              price: parseFloat(price || "0"),
              costPrice: parseFloat(price || "0"), // Assuming cost = sale price if importing via XML for now
              stock: parseInt(qty || "0"),
              minStock: 5,
              ownerId: user.role === UserRole.ADMIN ? user.id : user.ownerId!,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            count++;
          }
        }
        toast.success(`${count} itens importados com sucesso.`);
      } catch (err) { toast.error("Falha ao processar arquivo XML."); }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const filteredItems = inventoryList.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      <input type="file" ref={fileInputRef} onChange={handleImportXML} accept=".xml" className="hidden" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-main">{t('inventory_mgt')}</h2>
          <p className="text-secondary">Peças & Suprimentos</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-premium-secondary flex-1 sm:flex-none"
          >
            <ICONS.Box className="w-4 h-4 text-zinc-500 group-hover:text-purple-400" /> XML
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-premium-primary flex-1 sm:flex-none"
          >
            {t('add_item')}
          </button>
        </div>
      </div>

      <div className="card-premium">
        <div className="p-4 border-b border-border flex justify-between items-center bg-[#1c1c20]/30">
          <div className="relative w-full max-w-md">
            <ICONS.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-sm w-full pl-11 py-2 focus:outline-none text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Descrição do Produto</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">SKU / Ref</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Custo</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Preço Venda</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">Estoque</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center animate-pulse text-zinc-600 font-black">Sincronizando estoque...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-zinc-600 italic">Nenhum produto cadastrado na sua oficina.</td></tr>
              ) : (
                filteredItems.map((product) => (
                  <tr key={product.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-background-main border border-border flex items-center justify-center group-hover:border-purple-500/50 transition-colors overflow-hidden">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ICONS.Box className="w-5 h-5 text-zinc-500 group-hover:text-purple-500 transition-colors" />
                          )}
                        </div>
                        <span className="font-bold text-zinc-100 text-sm tracking-tight">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-zinc-500 font-mono font-bold">{product.sku}</td>
                    <td className="px-6 py-4 text-center text-zinc-400 font-bold">R$ {(product.costPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-center text-zinc-100 font-black">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${product.stock <= product.minStock ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                        {product.stock} un
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditModal(product)} className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"><ICONS.Edit className="w-4 h-4" /></button>
                        <button onClick={() => confirmDelete(product)} className="p-2.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"><ICONS.Trash className="w-4 h-4" /></button>
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
            <h2 className="text-xl font-black text-white mb-8 tracking-tight uppercase">{editingItem ? "EDITAR PRODUTO" : "ADICIONAR PRODUTO"}</h2>

            <div className="mb-6 flex flex-col items-center gap-4">
              <div
                onClick={() => productImageInputRef.current?.click()}
                className="w-32 h-32 rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/50 transition-all overflow-hidden bg-background-main group relative"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ICONS.Edit className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <ICONS.Image className="w-8 h-8 text-zinc-500 mb-2 group-hover:text-purple-500 transition-colors" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Foto do Produto</span>
                  </>
                )}
              </div>
              <input
                type="file"
                ref={productImageInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setImagePreview(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Nome do Produto</label>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-standard w-full" placeholder="Ex: Óleo Motul 5100" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">SKU / Referência</label>
                <input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="input-standard w-full" placeholder="REF-000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Preço de Custo R$</label>
                  <input type="number" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-4 py-4 text-sm text-white focus:border-purple-500 outline-none transition-colors" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Preço de Venda R$</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-4 py-4 text-sm text-white focus:border-purple-500 outline-none transition-colors" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Estoque</label>
                  <input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} className="w-full bg-background-main border border-border rounded-2xl px-4 py-4 text-sm text-white focus:border-purple-500 outline-none transition-colors" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-1">Mínimo</label>
                  <input type="number" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: e.target.value })} className="input-standard w-full px-4" placeholder="5" />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button onClick={closeModal} className="flex-1 text-zinc-500 py-4 text-xs font-black uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
                <button onClick={handleSaveItem} disabled={isSubmitting} className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">Confirmar</button>
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
            <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-2">Excluir Produto?</h3>
            <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-8 px-4">Esta ação é irreversível e removerá o item do inventário permanentemente.</p>
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

export default InventoryList;
