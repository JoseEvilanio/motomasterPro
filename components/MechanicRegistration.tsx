import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { t } from '../translations';
import { UserRole, EmploymentType } from '../types';
import { ICONS } from '../constants';
import { useStore } from '../services/store';

const MechanicRegistration: React.FC = () => {
    const { orgId } = useParams<{ orgId: string }>();
    const navigate = useNavigate();
    const { setUser } = useStore();
    const [loading, setLoading] = useState(false);
    const [orgName, setOrgName] = useState<string>('');

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        specialty: ''
    });

    useEffect(() => {
        // Optional: Fetch organization name to show "Register at [Workshop Name]"
        // This assumes there's a way to get org info. For now, we'll verify orgId exists? 
        // Or just generic "Register".
        // Let's try to fetch the owner's name or workshop name if possible, 
        // but user data is in 'users' or 'profiles'? 
        // 'clients' has ownerId, 'products' has ownerId. 
        // We don't have a 'workshops' collection, usually 'users' holds profile.
        // Let's just proceed.
    }, [orgId]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) {
            toast.error("Link inválido (Workshop ID ausente).");
            return;
        }

        const trimmedName = form.name.trim();
        const trimmedEmail = form.email.trim();
        const trimmedPhone = form.phone.trim();
        const trimmedPassword = form.password.trim();

        if (!trimmedName || !trimmedEmail || !trimmedPassword || !trimmedPhone) {
            toast.error(t('fill_all_fields'));
            return;
        }

        // Email validation regex (basic)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            toast.error("Por favor, insira um email válido.");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
            const user = userCredential.user;

            // 2. Update Profile
            await updateProfile(user, {
                displayName: trimmedName
            });

            // 3. Create Mechanic Record
            await addDoc(collection(db, 'mechanics'), {
                ownerId: orgId,
                userId: user.uid,
                name: trimmedName,
                email: trimmedEmail,
                phone: trimmedPhone,
                specialty: form.specialty.trim() || 'Geral',
                active: true,
                employmentType: EmploymentType.CLT, // Default, can be changed by owner
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 4. Force update local store to avoid App.tsx race condition
            // This prevents the App from seeing "ADMIN" initially because the mechanic doc didn't exist when Auth triggered
            setUser({
                id: user.uid,
                name: trimmedName,
                email: trimmedEmail,
                role: UserRole.MECHANIC
            });

            // "role: UserRole.ADMIN" in App.tsx line 41. 
            // We need to fix that! App.tsx forces ADMIN.

            toast.success("Cadastro realizado com sucesso!");
            navigate('/mechanic-dashboard');

        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error("Este email já está em uso.");
            } else if (error.code === 'auth/invalid-email') {
                toast.error("O email fornecido é inválido.");
            } else if (error.code === 'auth/weak-password') {
                toast.error("A senha é muito fraca (mínimo 6 caracteres).");
            } else {
                toast.error("Erro ao realizar cadastro.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
            <div className="bg-[#1c1c20] border border-[#27272a] w-full max-w-md rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] -mr-32 -mt-32 pointer-events-none" />

                <div className="mb-8 text-center relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4">
                        <ICONS.Wrench className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Junte-se à Equipe</h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">{orgName || "Cadastro de Mecânico"}</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4 relative z-10">
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-1">Nome Completo</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none transition-all font-semibold"
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-1">Telefone / WhatsApp</label>
                        <input
                            type="text"
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none transition-all"
                            placeholder="(00) 00000-0000"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-1">Especialidade (Opcional)</label>
                        <input
                            type="text"
                            value={form.specialty}
                            onChange={e => setForm({ ...form, specialty: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none transition-all"
                            placeholder="Ex: Elétrica, Motor..."
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-1">Email de Acesso</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none transition-all"
                            placeholder="email@exemplo.com"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 block mb-1">Senha</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-white focus:border-purple-500/50 outline-none transition-all"
                            placeholder="******"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-black uppercase text-xs tracking-[0.2em] py-4 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl mt-6 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        {loading ? "CADASTRANDO..." : "FINALIZAR CADASTRO"}
                    </button>
                </form>

                <p className="text-center text-[10px] text-zinc-600 mt-6">
                    Ao se cadastrar, você concorda em fazer parte da organização vinculada a este link.
                </p>
            </div>
        </div>
    );
};

export default MechanicRegistration;
