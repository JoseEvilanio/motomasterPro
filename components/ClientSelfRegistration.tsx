import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { toast } from 'sonner';
import { ICONS } from '../constants';

const ClientSelfRegistration: React.FC = () => {
    const [searchParams] = useSearchParams();
    const clientId = searchParams.get('client');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [clientData, setClientData] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchClient = async () => {
            if (!clientId) {
                toast.error("Link de convite inválido.");
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, 'clients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClientData(docSnap.data());
                } else {
                    toast.error("Cliente não encontrado.");
                }
            } catch (e) {
                toast.error("Erro ao carregar convite.");
            } finally {
                setLoading(false);
            }
        };
        fetchClient();
    }, [clientId]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }
        if (password.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, clientData.email, password);
            const user = userCredential.user;

            // 2. Update profile name
            await updateProfile(user, { displayName: clientData.name });

            // 3. Link client record with userId
            await updateDoc(doc(db, 'clients', clientId!), {
                userId: user.uid,
                updatedAt: new Date()
            });

            toast.success("Cadastro finalizado com sucesso!");
            navigate('/');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erro ao criar conta.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
            <span className="text-zinc-500 font-black uppercase tracking-widest text-[10px] animate-pulse">Autenticando Convite...</span>
        </div>
    );

    if (!clientData) return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 text-center p-6">
            <div className="card-premium p-10 max-w-sm border-red-500/20 bg-red-500/5">
                <ICONS.AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-white font-black uppercase tracking-tighter text-xl mb-2">Link de Convite Inválido</h2>
                <p className="text-zinc-500 text-xs italic">O código de acesso fornecido não foi encontrado ou expirou. Entre em contato com a oficina para solicitar um novo link.</p>
                <button onClick={() => navigate('/')} className="mt-6 w-full py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20">Voltar</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md card-premium p-10 bg-[#1c1c20]/60 backdrop-blur-2xl shadow-2xl border-white/5 animate-in zoom-in-95 duration-500">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/20 shadow-lg shadow-purple-500/10">
                        <ICONS.UserPlus className="w-8 h-8 text-purple-500" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter italic bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">Finalizar Cadastro</h1>
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <span className="h-px bg-zinc-800 flex-1"></span>
                        <p className="text-purple-500 text-xs font-black uppercase tracking-widest">{clientData.name}</p>
                        <span className="h-px bg-zinc-800 flex-1"></span>
                    </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Email Cadastrado</label>
                        <input
                            type="email"
                            value={clientData.email}
                            disabled
                            className="input-standard w-full cursor-not-allowed opacity-40 font-bold border-zinc-800 bg-zinc-900/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Nova Senha</label>
                        <input
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-standard w-full focus:border-purple-500/50"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Confirmar Senha</label>
                        <input
                            type="password"
                            placeholder="Repita a senha para validar"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input-standard w-full focus:border-purple-500/50"
                            required
                        />
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <p className="text-[9px] text-zinc-500 font-medium italic lowercase leading-tight">Ao ativar seu acesso, você poderá visualize apenas seus pedidos de serviço e informações relacionadas à sua oficina.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-premium-primary w-full py-4 text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-purple-500/20 active:scale-[0.98] transition-all hover:bg-purple-500 hover:shadow-purple-500/40"
                    >
                        {isSubmitting ? "CONSTRUINDO ACESSO..." : "ATIVAR MINHA CONTA"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ClientSelfRegistration;
