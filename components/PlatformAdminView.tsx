import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, WorkshopSettings, UserRole } from '../types';
import { ICONS } from '../constants';
import { t } from '../translations';
import { toast } from 'sonner';

interface PlatformAdminViewProps {
    user: User;
}

const PlatformAdminView: React.FC<PlatformAdminViewProps> = () => {
    const [usersList, setUsersList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [exportingId, setExportingId] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [settings, setSettings] = useState<WorkshopSettings[]>([]);
    const [rawUsers, setRawUsers] = useState<any[]>([]);

    useEffect(() => {
        setLoading(true);

        // Listener for users
        const unsubscribeUsers = onSnapshot(collection(db, 'users'),
            (snapshot) => {
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRawUsers(usersData);
                setLoading(false);
            },
            (error) => {
                console.error("Error listening to users:", error);
                toast.error("Erro ao sincronizar usuários.");
            }
        );

        // Listener for settings
        const unsubscribeSettings = onSnapshot(collection(db, 'settings'),
            (snapshot) => {
                const settingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WorkshopSettings[];
                setSettings(settingsData);
            },
            (error) => {
                console.error("Error listening to settings:", error);
            }
        );

        return () => {
            unsubscribeUsers();
            unsubscribeSettings();
        };
    }, []);

    useEffect(() => {
        // Combine data whenever rawUsers or settings change
        const combined = rawUsers.map(u => {
            const workshop = settings.find(s => s.ownerId === u.id || (u.role === UserRole.MECHANIC && s.ownerId === u.ownerId));
            return {
                ...u,
                workshop: workshop || null
            };
        });

        // Sort by last login or name
        const sorted = combined.sort((a, b) => {
            const dateA = a.lastLogin?.toDate?.() || new Date(0);
            const dateB = b.lastLogin?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });

        setUsersList(sorted);
    }, [rawUsers, settings]);

    const filteredUsers = usersList.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.workshop?.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleStatus = async (userItem: any) => {
        const newStatus = userItem.isActive === false ? true : false;
        setExportingId(userItem.id); // Re-use exportingId for loading state

        try {
            // Update user document
            await setDoc(doc(db, 'users', userItem.id), { isActive: newStatus }, { merge: true });

            // If it's an admin, update the settings document too to block the whole workshop
            if (userItem.role === UserRole.ADMIN) {
                const settingsQuery = query(collection(db, 'settings'), where('ownerId', '==', userItem.id));
                const settingsSnap = await getDocs(settingsQuery);
                if (!settingsSnap.empty) {
                    await setDoc(doc(db, 'settings', settingsSnap.docs[0].id), { isActive: newStatus }, { merge: true });
                }
            }

            toast.success(`Usuário ${newStatus ? 'desbloqueado' : 'bloqueado'} com sucesso!`);
        } catch (error) {
            console.error("Error toggling user status:", error);
            toast.error("Erro ao alterar status do usuário.");
        } finally {
            setExportingId(null);
        }
    };

    const handleExportBackup = async (user: any) => {
        const ownerId = user.role === UserRole.ADMIN ? user.id : user.ownerId;
        if (!ownerId) {
            toast.error("Usuário não possui ID de proprietário para backup.");
            return;
        }

        const businessName = user.workshop?.businessName || user.name;
        setExportingId(user.id);
        toast.info(`Iniciando backup de ${businessName}...`);

        try {
            const collectionsToExport = [
                'products',
                'clients',
                'vehicles',
                'services',
                'os',
                'sales',
                'transactions',
                'mechanics',
                'settings'
            ];

            const backupData: any = {
                exportedAt: new Date().toISOString(),
                workshop: businessName,
                ownerId: ownerId,
                data: {}
            };

            for (const colName of collectionsToExport) {
                const q = query(collection(db, colName), where('ownerId', '==', ownerId));
                const snapshot = await getDocs(q);
                backupData.data[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            // Create and download the JSON file
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success("Backup concluído com sucesso!");
        } catch (error) {
            console.error("Error exporting backup:", error);
            toast.error("Erro ao gerar backup.");
        } finally {
            setExportingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Administração da Plataforma</h2>
                        <p className="text-zinc-500 text-sm">Gerencie todas as oficinas e realize backups de segurança.</p>
                    </div>
                    <div className="bg-purple-600/10 border border-purple-500/20 px-3 py-1 rounded-full">
                        <span className="text-purple-500 text-[10px] font-black uppercase tracking-widest">{usersList.length} Usuários</span>
                    </div>
                </div>

                <div className="relative group min-w-[300px]">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-purple-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Pesquisar usuários, e-mails ou oficinas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1c1c20] border border-border rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all font-medium"
                    />
                </div>
            </div>

            <div className="card-premium overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[800px]">
                        <thead className="bg-[#1c1c20]/50 text-zinc-500 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider">Usuário</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider">Perfil</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider">Oficina / Status</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider">Último Acesso</th>
                                <th className="px-6 py-4 text-right uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-zinc-600 font-black animate-pulse uppercase tracking-widest">
                                        Carregando Usuários...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-zinc-600 italic">
                                        {searchTerm ? 'Nenhum usuário encontrado para esta pesquisa.' : 'Nenhum usuário sincronizado na plataforma.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((userItem) => (
                                    <tr key={userItem.id} className="hover:bg-white/[0.01] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:bg-purple-600 group-hover:text-white transition-all">
                                                    <span className="font-black text-lg">{userItem.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-zinc-100 text-sm tracking-tight">{userItem.name}</div>
                                                    <div className="text-[10px] text-zinc-500 lowercase">{userItem.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${userItem.role === UserRole.PLATFORM_ADMIN ? 'bg-amber-500/10 text-amber-500' : userItem.role === UserRole.MECHANIC ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-500/10 text-zinc-400'}`}>
                                                {userItem.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-400 font-medium">
                                            {userItem.workshop ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-zinc-100 font-bold">{userItem.workshop.businessName}</span>
                                                    <span className="text-[10px] text-zinc-500">{userItem.workshop.taxId}</span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600 italic">Oficina não configurada</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500 font-mono text-[10px]">
                                            {userItem.lastLogin?.toDate ? userItem.lastLogin.toDate().toLocaleString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleStatus(userItem)}
                                                    disabled={exportingId === userItem.id}
                                                    title={userItem.isActive === false ? "Desbloquear Acesso" : "Bloquear Acesso"}
                                                    className={`
                                                      p-2 rounded-xl border transition-all active:scale-95
                                                      ${userItem.isActive === false
                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                                                            : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'}
                                                    `}
                                                >
                                                    {userItem.isActive === false
                                                        ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /><line x1="12" x2="12" y1="15" y2="17" /></svg>
                                                        : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><line x1="12" x2="12" y1="15" y2="17" /></svg>
                                                    }
                                                </button>

                                                <button
                                                    onClick={() => handleExportBackup(userItem)}
                                                    disabled={exportingId === userItem.id || (!userItem.workshop && userItem.role !== UserRole.ADMIN)}
                                                    className={`
                                                      inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                                      ${(exportingId === userItem.id || (!userItem.workshop && userItem.role !== UserRole.ADMIN))
                                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                                                            : 'bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-lg'}
                                                    `}
                                                >
                                                    {exportingId === userItem.id ? (
                                                        <>
                                                            <div className="w-3 h-3 border-2 border-zinc-500/20 border-t-zinc-500 rounded-full animate-spin"></div>
                                                            ...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                                            Backup
                                                        </>
                                                    )}
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
        </div>
    );
};

export default PlatformAdminView;
