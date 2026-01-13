import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2,
  CreditCard,
  Cpu,
  Upload,
  ShieldCheck,
  Save,
  X,
  Lock,
  MessageSquare,
  Bot,
  User as UserIcon,
  Bell,
  Globe,
  Database,
  Users,
  Search,
  Plus,
  Trash2,
  Phone,
  Mail,
  Wrench,
  DollarSign,
  Percent
} from 'lucide-react';
import { User, Mechanic, EmploymentType, WorkshopSettings } from '../types';
import { t } from '../translations';
import { db } from '../services/firebase';
import { useStore } from '../services/store';
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

const SettingsView: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'IDENTITY' | 'FISCAL' | 'AUTOMATION' | 'TEAM'>('IDENTITY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loadingMechanics, setLoadingMechanics] = useState(true);
  const [isMechanicModalOpen, setIsMechanicModalOpen] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<Mechanic | null>(null);
  const [mechanicSearch, setMechanicSearch] = useState('');

  const [mechanicForm, setMechanicForm] = useState({
    name: '',
    phone: '',
    email: '',
    specialty: '',
    employmentType: EmploymentType.CLT,
    baseSalary: '',
    commissionRate: '',
    active: true
  });

  const [settings, setSettings] = useState<WorkshopSettings>({
    ownerId: user.id,
    businessName: 'MotoMaster Pro',
    taxId: '',
    email: user.email,
    fiscal: {
      environment: 'HOMOLOGATION',
      taxRegime: 'SIMPLES',
      stateTaxId: '',
      municipalTaxId: '',
      hasCertificate: false
    },
    automation: {
      whatsapp: true,
      aiEngine: true,
      smartReports: false,
      cloudSync: true
    },
    updatedAt: null
  });

  const { workshopSettings } = useStore();

  React.useEffect(() => {
    if (workshopSettings && !isSubmitting) {
      setSettings(workshopSettings as WorkshopSettings);
    }
  }, [workshopSettings]);

  // Fetch mechanics
  React.useEffect(() => {
    if (activeTab !== 'TEAM') return;

    const q = query(
      collection(db, 'mechanics'),
      where('ownerId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Mechanic[];
      setMechanics(items.sort((a, b) => a.name.localeCompare(b.name)));
      setLoadingMechanics(false);
    });

    return () => unsubscribe();
  }, [user.id, activeTab]);

  const handleSaveMechanic = async () => {
    if (!mechanicForm.name || !mechanicForm.phone) {
      toast.error(t('fill_all_fields'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...mechanicForm,
        ownerId: user.id,
        baseSalary: mechanicForm.baseSalary ? parseFloat(mechanicForm.baseSalary) : 0,
        commissionRate: mechanicForm.commissionRate ? parseFloat(mechanicForm.commissionRate) : 0,
        updatedAt: serverTimestamp()
      };

      if (editingMechanic) {
        await updateDoc(doc(db, 'mechanics', editingMechanic.id), payload);
        toast.success("Mecânico atualizado!");
      } else {
        await addDoc(collection(db, 'mechanics'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        toast.success("Mecânico adicionado!");
      }
      setIsMechanicModalOpen(false);
      resetMechanicForm();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar mecânico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetMechanicForm = () => {
    setMechanicForm({
      name: '',
      phone: '',
      email: '',
      specialty: '',
      employmentType: EmploymentType.CLT,
      baseSalary: '',
      commissionRate: '',
      active: true
    });
    setEditingMechanic(null);
  };

  const openEditMechanic = (mechanic: Mechanic) => {
    setEditingMechanic(mechanic);
    setMechanicForm({
      name: mechanic.name,
      phone: mechanic.phone,
      email: mechanic.email || '',
      specialty: mechanic.specialty || '',
      employmentType: mechanic.employmentType,
      baseSalary: String(mechanic.baseSalary || ''),
      commissionRate: String(mechanic.commissionRate || ''),
      active: mechanic.active
    });
    setIsMechanicModalOpen(true);
  };

  const handleDeleteMechanic = async (id: string) => {
    if (!confirm("Deseja realmente excluir este mecânico?")) return;
    try {
      await deleteDoc(doc(db, 'mechanics', id));
      toast.success("Mecânico removido.");
    } catch (error) {
      toast.error("Erro ao remover.");
    }
  };

  const formatTaxId = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").substring(0, 14);
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").substring(0, 18);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Imagem muito grande! Máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...settings,
        ownerId: user.id,
        updatedAt: serverTimestamp()
      };

      if (settings.id) {
        await updateDoc(doc(db, 'settings', settings.id), payload);
      } else {
        await addDoc(collection(db, 'settings'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      toast.success(t('save_changes') + "!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: { duration: 0.2 }
    }
  };

  const tabs = [
    { id: 'IDENTITY', label: t('workshop_identity'), icon: Building2, color: 'text-purple-500' },
    { id: 'FISCAL', label: t('fiscal_settings'), icon: CreditCard, color: 'text-emerald-500' },
    { id: 'TEAM', label: t('team'), icon: Users, color: 'text-orange-500' },
    { id: 'AUTOMATION', label: t('automation_api'), icon: Cpu, color: 'text-blue-500' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-secondary">{t('settings')}</span>
          </div>
          <h2 className="text-main leading-none">
            {t('sys_settings')}
          </h2>
          <p className="text-zinc-500 text-[10px] font-medium max-w-md">
            {t('sys_settings_desc')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-premium-secondary h-12 px-6">
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="btn-premium-primary h-12 px-8"
          >
            {isSubmitting ? (
              <>
                <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>SALVANDO...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>{t('save_changes')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-background-card/50 p-2 rounded-3xl border border-border w-fit backdrop-blur-md">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 relative group ${activeTab === tab.id
              ? 'text-white'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-background-main border border-border/50 rounded-2xl shadow-lg shadow-black/20"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative flex items-center gap-3 z-10">
              <tab.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeTab === tab.id ? tab.color : 'opacity-40'}`} />
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === 'IDENTITY' && (
            <motion.section
              key="identity"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-background-card border border-border rounded-[2.5rem] p-8 md:p-12 shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[100px] -mr-48 -mt-48 transition-opacity pointer-events-none" />

              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">
                    {t('workshop_identity')}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Perfil Público e Social</p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-16 items-start">
                <div className="flex flex-col items-center gap-4 group">
                  <div className="relative w-40 h-40 bg-background-main border-2 border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center text-zinc-600 hover:border-purple-500/50 hover:bg-purple-500/[0.02] cursor-pointer transition-all duration-300 overflow-hidden">
                    {settings.logoUrl ? (
                      <>
                        <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover p-2 rounded-[2rem]" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                          <Upload className="w-6 h-6 text-white mb-2" />
                          <span className="text-[10px] text-white font-black uppercase">Alterar Logo</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mb-2 opacity-50 group-hover:opacity-100 transition-all group-hover:scale-110 group-hover:text-purple-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('upload_logo')}</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleLogoUpload} />
                  </div>
                  {settings.logoUrl && (
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, logoUrl: '' }))}
                      className="text-[10px] font-bold text-rose-500 uppercase hover:text-rose-400 transition-colors"
                    >
                      Remover Logo
                    </button>
                  )}
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-center px-4">Tamanho recomendado: 512x512px. PNG ou SVG.</p>
                </div>

                <div className="flex-1 w-full space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <Globe className="w-3 h-3" /> {t('business_name')}
                      </label>
                      <input
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none font-semibold"
                        value={settings.businessName}
                        onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <ShieldCheck className="w-3 h-3" /> {t('tax_id')}
                      </label>
                      <input
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none font-mono tracking-wider"
                        value={settings.taxId}
                        onChange={(e) => setSettings({ ...settings, taxId: formatTaxId(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-1">
                        <MessageSquare className="w-3 h-3" /> E-mail de Contato
                      </label>
                      <input
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-purple-500/50 transition-all outline-none font-medium"
                        value={settings.email}
                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        type="email"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-background-main/50 border border-border rounded-[2rem] flex items-start gap-5">
                    <div className="p-3 bg-zinc-900 rounded-2xl border border-border/50">
                      <Lock className="w-6 h-6 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-zinc-200 uppercase tracking-widest mb-1">{t('security')}</p>
                      <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                        Suas informações cadastrais são criptografadas e protegidas pelo Google Cloud Firestore (Multi-tenancy isolation). Dados sensíveis nunca são expostos em logs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'FISCAL' && (
            <motion.section
              key="fiscal"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-background-card border border-border rounded-[2.5rem] p-8 md:p-12 shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[100px] -mr-48 -mt-48 pointer-events-none" />

              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">
                    {t('fiscal_ops')}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">NFe, NFCe e Emissões Fiscais</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t('fiscal_env')}</label>
                    <div className="relative group">
                      <select
                        value={settings.fiscal.environment}
                        onChange={(e) => setSettings({ ...settings, fiscal: { ...settings.fiscal, environment: e.target.value as any } })}
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500/50 transition-all outline-none font-black uppercase tracking-[0.15em] appearance-none cursor-pointer"
                      >
                        <option value="HOMOLOGATION">{t('homolog_env')}</option>
                        <option value="PRODUCTION">{t('prod_env')}</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                        <Globe className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t('regime_tributario')}</label>
                    <select
                      value={settings.fiscal.taxRegime}
                      onChange={(e) => setSettings({ ...settings, fiscal: { ...settings.fiscal, taxRegime: e.target.value as any } })}
                      className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500/50 transition-all outline-none font-bold appearance-none cursor-pointer"
                    >
                      <option value="SIMPLES">Simples Nacional (ME/EPP)</option>
                      <option value="NORMAL">Lucro Real ou Presumido</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t('ie')}</label>
                    <input
                      value={settings.fiscal.stateTaxId}
                      onChange={(e) => setSettings({ ...settings, fiscal: { ...settings.fiscal, stateTaxId: e.target.value } })}
                      className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500/50 transition-all outline-none font-mono tracking-widest"
                      placeholder="000.000.000.000"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t('im')}</label>
                    <input
                      value={settings.fiscal.municipalTaxId}
                      onChange={(e) => setSettings({ ...settings, fiscal: { ...settings.fiscal, municipalTaxId: e.target.value } })}
                      className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500/50 transition-all outline-none font-mono tracking-widest"
                      placeholder="000000-0"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-10 border-t border-border/50">
                <label className="text-[10px] font-black text-zinc-400 uppercase mb-6 block tracking-[0.2em] px-2">{t('digital_cert')} (NFe/NFCe)</label>
                <div className="group relative p-10 border-2 border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center gap-6 hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition-all duration-300 cursor-pointer bg-background-main/20">
                  <div className="w-16 h-16 bg-background-card rounded-[1.25rem] border border-border flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-300 shadow-lg">
                    <ShieldCheck className="w-8 h-8 text-zinc-600 group-hover:text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-white uppercase tracking-widest mb-1">{t('cert_sync')}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Suporte para arquivos .P12 e .PFX</p>
                  </div>
                  <div className="flex items-center gap-2 bg-rose-500/10 text-rose-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-500/20 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                    {t('cert_status')}: {t('not_configured')}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {activeTab === 'TEAM' && (
            <motion.section
              key="team"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-background-card border border-border rounded-[2.5rem] p-8 md:p-12 shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 blur-[100px] -mr-48 -mt-48 pointer-events-none" />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">
                      {t('team')}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Gestão de Mecânicos e Especialistas</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    resetMechanicForm();
                    setIsMechanicModalOpen(true);
                  }}
                  className="btn-premium-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('add_mechanic')}
                </button>
              </div>

              {/* Invite Link Section */}
              <div className="mb-8 p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/20 rounded-full">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-black uppercase tracking-wide text-sm">Link de Convite para Mecânicos</h4>
                    <p className="text-zinc-400 text-xs mt-1">Compartilhe este link para que os mecânicos se cadastrem na sua oficina.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-zinc-300 text-xs font-mono truncate max-w-[250px] select-all">
                    {`${window.location.origin}/join/${user.id}`}
                  </div>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/join/${user.id}`;

                      const copyFallback = () => {
                        try {
                          const textArea = document.createElement("textarea");
                          textArea.value = link;
                          // Avoid scrolling to bottom
                          textArea.style.top = "0";
                          textArea.style.left = "0";
                          textArea.style.position = "fixed";
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          const successful = document.execCommand('copy');
                          document.body.removeChild(textArea);
                          if (successful) {
                            toast.success("Link copiado!");
                          } else {
                            throw new Error("Fallback failed");
                          }
                        } catch (err) {
                          toast.error("Não foi possível copiar automaticamente. Por favor, selecione e copie o link ao lado.");
                        }
                      };

                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(link)
                          .then(() => toast.success("Link copiado!"))
                          .catch(() => copyFallback());
                      } else {
                        copyFallback();
                      }
                    }}
                    className="p-3 bg-white text-black rounded-xl hover:bg-zinc-200 transition-colors font-bold text-xs uppercase tracking-wider active:scale-95"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquisar mecânico..."
                  value={mechanicSearch}
                  onChange={(e) => setMechanicSearch(e.target.value)}
                  className="w-full bg-background-main border border-border rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingMechanics ? (
                  <div className="col-span-full py-20 text-center animate-pulse text-zinc-600 font-black uppercase tracking-widest text-xs">Carregando Equipe...</div>
                ) : mechanics.filter(m => m.name.toLowerCase().includes(mechanicSearch.toLowerCase())).length === 0 ? (
                  <div className="col-span-full py-20 text-center text-zinc-600 italic text-xs">Nenhum mecânico encontrado.</div>
                ) : (
                  mechanics.filter(m => m.name.toLowerCase().includes(mechanicSearch.toLowerCase())).map((mechanic) => (
                    <motion.div
                      key={mechanic.id}
                      whileHover={{ y: -4 }}
                      className="bg-background-main/30 border border-border rounded-[2rem] p-6 hover:border-orange-500/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-background-card border border-border flex items-center justify-center group-hover:bg-orange-500/10 group-hover:border-orange-500/20 transition-all">
                          <Wrench className="w-6 h-6 text-zinc-500 group-hover:text-orange-500" />
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditMechanic(mechanic)} className="p-2 text-zinc-500 hover:text-white transition-colors"><Plus className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteMechanic(mechanic.id)} className="p-2 text-zinc-500 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <h4 className="font-black text-white uppercase tracking-tight mb-1">{mechanic.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-4 tracking-wider">{mechanic.specialty || 'Mecânico Geral'}</p>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase">
                          <Phone className="w-3 h-3 opacity-50" /> {mechanic.phone}
                        </div>
                        {mechanic.email && (
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase truncate">
                            <Mail className="w-3 h-3 opacity-50" /> {mechanic.email}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-6 border-t border-border/50 flex items-center justify-between">
                        <div className="px-3 py-1 bg-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400">
                          {t(mechanic.employmentType.toLowerCase() as any)}
                        </div>
                        <span className={`w-2 h-2 rounded-full ${mechanic.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-500'}`} />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.section>
          )}

          {isMechanicModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-background-card border border-border w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />

                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">{editingMechanic ? t('edit_mechanic') : t('add_mechanic')}</h2>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Informações Profissionais e Contratação</p>
                  </div>
                  <button onClick={() => setIsMechanicModalOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('name')}</label>
                      <input
                        value={mechanicForm.name}
                        onChange={(e) => setMechanicForm({ ...mechanicForm, name: e.target.value })}
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-semibold"
                        placeholder="Nome Completo"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('phone')}</label>
                        <input
                          value={mechanicForm.phone}
                          onChange={(e) => setMechanicForm({ ...mechanicForm, phone: e.target.value })}
                          className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-mono"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('specialty')}</label>
                        <input
                          value={mechanicForm.specialty}
                          onChange={(e) => setMechanicForm({ ...mechanicForm, specialty: e.target.value })}
                          className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all"
                          placeholder="Ex: Motorista"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('email')}</label>
                      <input
                        value={mechanicForm.email}
                        onChange={(e) => setMechanicForm({ ...mechanicForm, email: e.target.value })}
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all"
                        placeholder="email@exemplo.com"
                        type="email"
                      />
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div className="space-y-6 p-8 bg-background-main/30 rounded-[2.5rem] border border-border/50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 tracking-widest">{t('employment_type')}</label>
                      <select
                        value={mechanicForm.employmentType}
                        onChange={(e) => setMechanicForm({ ...mechanicForm, employmentType: e.target.value as EmploymentType })}
                        className="w-full bg-background-main border border-border rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-black uppercase tracking-widest appearance-none cursor-pointer"
                      >
                        <option value={EmploymentType.CLT}>{t('clt')}</option>
                        <option value={EmploymentType.COMMISSION}>{t('commission')}</option>
                        <option value={EmploymentType.CLT_COMMISSION}>{t('clt_commission')}</option>
                      </select>
                    </div>

                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      {(mechanicForm.employmentType === EmploymentType.CLT || mechanicForm.employmentType === EmploymentType.CLT_COMMISSION) && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-orange-500/70 uppercase ml-1 tracking-widest flex items-center gap-2">
                            <DollarSign className="w-3 h-3" /> {t('base_salary')}
                          </label>
                          <input
                            value={mechanicForm.baseSalary}
                            onChange={(e) => setMechanicForm({ ...mechanicForm, baseSalary: e.target.value })}
                            className="w-full bg-background-main border border-orange-500/20 rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-black"
                            placeholder="0.00"
                            type="number"
                          />
                        </div>
                      )}

                      {(mechanicForm.employmentType === EmploymentType.COMMISSION || mechanicForm.employmentType === EmploymentType.CLT_COMMISSION) && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-orange-500/70 uppercase ml-1 tracking-widest flex items-center gap-2">
                            <Percent className="w-3 h-3" /> {t('commission_rate')}
                          </label>
                          <input
                            value={mechanicForm.commissionRate}
                            onChange={(e) => setMechanicForm({ ...mechanicForm, commissionRate: e.target.value })}
                            className="w-full bg-background-main border border-orange-500/20 rounded-2xl px-6 py-4 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-black"
                            placeholder="0"
                            type="number"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status da Conta</span>
                      <button
                        onClick={() => setMechanicForm({ ...mechanicForm, active: !mechanicForm.active })}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 flex items-center px-1 ${mechanicForm.active ? 'bg-emerald-600' : 'bg-zinc-800'}`}
                      >
                        <motion.div
                          animate={{ x: mechanicForm.active ? 24 : 0 }}
                          className="w-4 h-4 bg-white rounded-full shadow-md"
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-12 pt-10 border-t border-border/50">
                  <button onClick={() => setIsMechanicModalOpen(false)} className="flex-1 text-zinc-500 py-5 text-xs font-black uppercase tracking-[0.2em] hover:text-white transition-colors">Cancelar</button>
                  <button
                    onClick={handleSaveMechanic}
                    disabled={isSubmitting}
                    className="flex-[2] bg-white text-black py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Confirmar Cadastro</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === 'AUTOMATION' && (
            <motion.section
              key="automation"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-background-card border border-border rounded-[2.5rem] p-8 md:p-12 shadow-sm relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[100px] -mr-48 -mt-48 pointer-events-none" />

              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">
                    {t('automation_api')}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('automation_desc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { id: 'whatsapp', label: t('whatsapp_notif'), desc: "Disparo automático de links DANFE e recibos de pagamento", active: settings.automation.whatsapp, icon: MessageSquare, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
                  { id: 'aiEngine', label: t('ai_engine'), desc: "Classificação inteligente de NCM e diagnóstico sugerido por IA", active: settings.automation.aiEngine, icon: Bot, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
                  { id: 'smartReports', label: t('smart_reports'), desc: "Análise preditiva de faturamento e níveis de estoque crítico", active: settings.automation.smartReports, icon: Cpu, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
                  { id: 'cloudSync', label: t('cloud_sync'), desc: "Backup incremental em tempo real em servidores multi-região", active: settings.automation.cloudSync, icon: Database, color: 'text-zinc-500', bgColor: 'bg-zinc-500/10' },
                ].map((opt) => (
                  <motion.div
                    key={opt.id}
                    whileHover={{ scale: 1.01, y: -2 }}
                    onClick={() => setSettings({
                      ...settings,
                      automation: {
                        ...settings.automation,
                        [opt.id]: !opt.active
                      }
                    })}
                    className="group flex items-center justify-between p-7 rounded-[2.25rem] border border-border bg-background-main/30 hover:bg-background-main hover:border-white/5 transition-all cursor-pointer relative overflow-hidden shadow-sm"
                  >
                    {opt.active && (
                      <div className={`absolute top-0 right-0 w-32 h-32 ${opt.bgColor} blur-[40px] opacity-20 -mr-16 -mt-16 pointer-events-none`} />
                    )}
                    <div className="flex items-center gap-6 relative z-10">
                      <div className={`p-4 rounded-2xl bg-background-card border border-border group-hover:border-current/20 transition-all ${opt.active ? opt.color : 'text-zinc-700'}`}>
                        <opt.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className={`text-xs font-black uppercase tracking-tight mb-1 ${opt.active ? 'text-zinc-100' : 'text-zinc-500'}`}>{opt.label}</p>
                        <p className="text-[10px] text-zinc-500 font-bold max-w-[200px] leading-relaxed uppercase opacity-70">{opt.desc}</p>
                      </div>
                    </div>
                    <button className={`w-14 h-7 rounded-full relative transition-all duration-300 shadow-inner flex items-center px-1.5 ${opt.active ? 'bg-purple-600 shadow-purple-900/20' : 'bg-zinc-800'}`}>
                      <motion.div
                        animate={{ x: opt.active ? 24 : 0 }}
                        className="w-4 h-4 bg-white rounded-full shadow-md z-10"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="mt-12 p-8 bg-zinc-900/50 border border-border/50 rounded-[2rem] flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-800 rounded-2xl text-zinc-400">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-widest mb-1">API de Integração</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Documentação disponível para desenvolvedores</p>
                  </div>
                </div>
                <button className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-border/50">
                  Acessar Docs
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SettingsView;
