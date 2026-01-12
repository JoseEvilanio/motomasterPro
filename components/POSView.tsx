import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Box,
  DollarSign,
  CheckCircle2,
  Receipt,
  X,
  CreditCard
} from 'lucide-react';
import { User, Product, UserRole } from '../types';
import { issueFiscalNote } from '../services/fiscalService';
import { db } from '../services/firebase';
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

interface CartItem extends Product {
  quantity: number;
}

const POSView: React.FC<{ user: User }> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [shouldIssueNfce, setShouldIssueNfce] = useState(false);

  useEffect(() => {
    const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
    const q = query(collection(db, 'products'), where('ownerId', '==', ownerId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(data.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (error) => {
      console.error("POS Sync Error:", error);
      toast.error("Erro ao sincronizar inventário do PDV.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.id, user.ownerId, user.role]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.warning("Produto sem estoque disponível.");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.warning("Limite de estoque atingido para este item.");
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`${product.name} adicionado ao carrinho`);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        const product = products.find(p => p.id === id);
        if (newQty > 0 && product && newQty <= product.stock) {
          return { ...item, quantity: newQty };
        }
      }
      return item;
    }));
  };

  const subtotal = useMemo(() => cart.reduce((acc, it) => acc + (it.price * it.quantity), 0), [cart]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      let fiscalData = null;
      if (shouldIssueNfce) {
        fiscalData = await issueFiscalNote({
          items: cart,
          total: subtotal,
          payment: paymentMethod,
          client: 'Consumidor Final'
        }, 'NFCE');
      }

      const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId!;
      await addDoc(collection(db, 'transactions'), {
        ownerId: ownerId,
        label: `Venda Direta PDV - ${cart.length} itens`,
        category: 'INCOME',
        amount: subtotal,
        status: 'PAID',
        paymentMethod,
        fiscalStatus: fiscalData ? 'AUTHORIZED' : 'NONE',
        danfeUrl: fiscalData?.danfeUrl || null,
        date: serverTimestamp(),
        seller: user.name
      });

      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        await updateDoc(productRef, {
          stock: increment(-item.quantity),
          updatedAt: serverTimestamp()
        });
      }

      setCart([]);
      setShowMobileCart(false);
      toast.success(shouldIssueNfce ? "Venda realizada e NFC-e emitida!" : "Venda concluída com sucesso!");

      if (fiscalData?.danfeUrl) {
        window.open(fiscalData.danfeUrl, '_blank');
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(`Erro no checkout: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[calc(100vh-160px)] animate-in fade-in duration-700">
      <div className="flex-1 flex flex-col space-y-6 min-w-0">
        <div>
          <h2 className="text-main">PONTO DE VENDA</h2>
          <p className="text-secondary mt-1">Vendas Rápidas & Checkout</p>
        </div>

        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome ou código SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-standard w-full pl-14 py-5"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 bg-background-card border border-border rounded-3xl animate-pulse" />
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <Box className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-600 font-black uppercase tracking-widest text-[10px]">Estoque Indisponível</p>
              </div>
            ) : filteredProducts.map(p => {
              const inStock = p.stock > 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={!inStock}
                  className={`relative flex flex-col p-5 bg-background-card border border-border rounded-[2rem] text-left hover:border-purple-500/30 transition-all group active:scale-[0.97] ${!inStock ? 'opacity-40 grayscale cursor-not-allowed' : ''} shadow-sm overflow-hidden`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-background-main rounded-2xl flex items-center justify-center border border-border group-hover:border-purple-500/30 transition-all">
                      <Box className="w-6 h-6 text-zinc-500 group-hover:text-purple-500 transition-colors" />
                    </div>
                    {!inStock ? (
                      <span className="text-[9px] font-black text-rose-500 uppercase bg-rose-500/10 px-2 py-1 rounded-full">Esgotado</span>
                    ) : p.stock <= p.minStock && (
                      <span className="text-[9px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-1 rounded-full">Low Stock</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-tighter truncate leading-tight">{p.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-black tracking-widest uppercase">{p.sku}</p>
                  </div>

                  <div className="mt-6 pt-4 flex justify-between items-center border-t border-border/50">
                    <span className="text-lg font-black text-white tracking-tighter">R$ {p.price.toFixed(2)}</span>
                    <div className="bg-background-main px-3 py-1.5 rounded-xl border border-border">
                      <span className="text-[10px] font-black text-zinc-400 uppercase">{p.stock} <span className="text-[8px] text-zinc-600">UN</span></span>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-6 right-6 bg-white text-black p-4 rounded-full shadow-[0_20px_40px_-10px_rgba(255,255,255,0.4)] z-40 animate-bounce"
        >
          <ShoppingBag className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-background-main">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className={`
        fixed lg:static inset-0 lg:inset-auto z-50 lg:z-0 lg:w-[450px] flex flex-col bg-background-card border-l border-border lg:rounded-[3rem] overflow-hidden shadow-[0_0_100px_-20px_rgba(0,0,0,0.5)]
        transition-transform duration-500 ease-out lg:translate-x-0
        ${showMobileCart ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-8 border-b border-border flex justify-between items-center bg-[#1c1c20]/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-widest uppercase leading-none">Checkout</h3>
              <p className="text-[9px] font-black text-zinc-500 mt-1 uppercase tracking-widest">Resumo do Carrinho</p>
            </div>
          </div>
          <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2 bg-background-main border border-border rounded-xl text-zinc-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 py-20 opacity-30 grayscale text-center">
              <ShoppingBag className="w-16 h-16 text-zinc-800" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Carrinho Vazio</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="group bg-background-main border border-border rounded-[1.5rem] p-4 flex items-center gap-4 hover:border-white/10 transition-all">
                <div className="w-12 h-12 bg-background-card rounded-xl flex items-center justify-center border border-border font-black text-[10px] text-zinc-600">
                  {item.quantity}x
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-black text-white uppercase truncate tracking-tight">{item.name}</h5>
                  <p className="text-[10px] font-black text-purple-500 mt-0.5 tracking-tighter">R$ {(item.price * item.quantity).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1 bg-background-card border border-border rounded-xl p-1">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-2 text-zinc-500 hover:text-white transition-colors"><Minus className="w-3 h-3" /></button>
                  <span className="text-xs font-black min-w-[24px] text-center text-white">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-2 text-zinc-500 hover:text-white transition-colors"><Plus className="w-3 h-3" /></button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="p-2.5 text-zinc-700 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-8 border-t border-border space-y-6 bg-background-main/50 backdrop-blur-2xl">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subtotal Acumulado</span>
              <span className="text-sm font-black text-zinc-300 tracking-tighter">R$ {subtotal.toFixed(2)}</span>
            </div>

            <div className="p-6 bg-background-card border border-border rounded-3xl flex justify-between items-center shadow-inner">
              <span className="text-xs font-black text-white uppercase tracking-[0.2em]">Total Final</span>
              <span className="text-2xl font-black text-emerald-500 tracking-tighter">R$ {subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('Pix')}
                className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'Pix' ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-background-card border-border text-zinc-500 hover:text-zinc-300'}`}
              >
                PIX Instantâneo
              </button>
              <button
                onClick={() => setPaymentMethod('Cartão')}
                className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'Cartão' ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-background-card border-border text-zinc-500 hover:text-zinc-300'}`}
              >
                Cartão Créd/Déb
              </button>
            </div>

            <label className="flex items-center gap-3 p-4 bg-background-card/50 rounded-2xl border border-border cursor-pointer group hover:bg-background-card transition-colors">
              <input
                type="checkbox"
                checked={shouldIssueNfce}
                onChange={(e) => setShouldIssueNfce(e.target.checked)}
                className="w-5 h-5 rounded-lg border-border bg-background-main text-purple-600 focus:ring-purple-500/20 cursor-pointer"
              />
              <div className="flex-1">
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-zinc-500" /> Emitir NFC-e Automática
                </p>
                <p className="text-[8px] font-bold text-zinc-600 uppercase mt-0.5">Válido para Sefaz Estadual</p>
              </div>
            </label>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing}
            className="w-full relative group overflow-hidden bg-white text-black font-black text-sm py-5 rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_25px_60px_-10px_rgba(255,255,255,0.3)] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                FINALIZAR E RECEBER
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSView;
