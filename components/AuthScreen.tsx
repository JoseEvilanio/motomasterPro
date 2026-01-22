import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, UserRole } from '../types';
import { APP_NAME, ICONS } from '../constants';
import { t } from '../translations';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, ArrowRight, Bike, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [isResetFlow, setIsResetFlow] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      setIsResetFlow(true);
      setResetCode(oobCode);
      setLoading(true);

      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setResetEmail(email);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Invalid reset code:", error);
          alert("O link de redefinição de senha é inválido ou já expirou. Por favor, solicite um novo.");
          setIsResetFlow(false);
          setLoading(false);
        });
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isResetFlow) {
        if (newPassword !== confirmNewPassword) {
          alert("As senhas não coincidem!");
          setLoading(false);
          return;
        }
        await confirmPasswordReset(auth, resetCode, newPassword);
        alert("Senha redefinida com sucesso! Agora você pode fazer login com sua nova senha.");
        setIsResetFlow(false);
        setIsLogin(true);
        setNewPassword('');
        setConfirmNewPassword('');
      } else if (isForgot) {
        // Validação Profissional: Verificar se o e-mail existe no banco
        const settingsQuery = query(collection(db, 'settings'), where('email', '==', email));
        const mechanicsQuery = query(collection(db, 'mechanics'), where('email', '==', email));

        let settingsSnap, mechanicsSnap;

        try {
          [settingsSnap, mechanicsSnap] = await Promise.all([
            getDocs(settingsQuery),
            getDocs(mechanicsQuery)
          ]);
        } catch (queryError: any) {
          console.error("Firestore Permission Error:", queryError);
          if (queryError.code === 'permission-denied') {
            alert("Erro de permissão: Para verificar se o e-mail existe, as regras de segurança do seu Firebase Firestore precisam permitir a leitura pública limitada das coleções 'settings' e 'mechanics'.");
          } else {
            alert("Erro ao verificar e-mail no banco de dados.");
          }
          setLoading(false);
          return;
        }

        if (settingsSnap.empty && mechanicsSnap.empty) {
          alert("Este e-mail não foi encontrado em nossa base de dados. Por favor, verifique se o digitou corretamente.");
          setLoading(false);
          return;
        }

        await sendPasswordResetEmail(auth, email);
        alert("E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.");
        setIsForgot(false);
        setIsLogin(true);
      } else if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userData = {
          id: userCredential.user.uid,
          name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
          email: userCredential.user.email || '',
          role: UserRole.ADMIN,
          lastLogin: serverTimestamp()
        };

        // Sync to users collection
        await setDoc(doc(db, 'users', userData.id), userData, { merge: true });

        onLogin(userData);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userData = {
          id: userCredential.user.uid,
          name: name || email.split('@')[0],
          email: userCredential.user.email || '',
          role: UserRole.ADMIN,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        };

        // Sync to users collection
        await setDoc(doc(db, 'users', userData.id), userData, { merge: true });

        onLogin(userData);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      let errorMessage = "Ocorreu um erro na autenticação.";
      if (error.code === 'auth/wrong-password') errorMessage = "Senha incorreta.";
      if (error.code === 'auth/user-not-found') errorMessage = "E-mail não cadastrado.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "Este e-mail já está em uso.";
      if (error.code === 'auth/weak-password') errorMessage = "A senha é muito fraca.";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[440px] z-10"
      >
        <div className="text-center space-y-4 mb-10">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="w-16 h-16 bg-white rounded-[1.5rem] mx-auto flex items-center justify-center shadow-2xl shadow-white/5 group bg-gradient-to-br from-white to-zinc-200"
          >
            <Bike className="w-9 h-9 text-black" />
          </motion.div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{APP_NAME}</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Expert Auto & Moto Care</p>
          </div>
        </div>

        <div className="bg-background-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-10 shadow-3xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

          <div className="flex items-center gap-3 mb-10">
            <div className={`p-2 rounded-lg ${isResetFlow ? 'bg-emerald-500/10' : isForgot ? 'bg-orange-500/10' : isLogin ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
              {isResetFlow ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : isForgot ? <Mail className="w-5 h-5 text-orange-400" /> : isLogin ? <LogIn className="w-5 h-5 text-purple-400" /> : <UserPlus className="w-5 h-5 text-blue-400" />}
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase">
              {isResetFlow ? "Nova Senha" : isForgot ? "Recuperar Senha" : isLogin ? t('login_title') : t('register_title')}
            </h2>
          </div>

          <form className="space-y-6" onSubmit={handleAuth}>
            {isResetFlow ? (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl mb-6">
                  <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> E-mail Verificado
                  </p>
                  <p className="text-xs text-zinc-300 font-medium">{resetEmail}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-background-main/50 border border-border rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/5 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-background-main/50 border border-border rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/5 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden"
                >
                  <div className="absolute inset-0 bg-emerald-500 group-hover:bg-emerald-600 transition-colors" />
                  <div className="relative h-14 flex items-center justify-center gap-3 text-white text-[10px] font-black uppercase tracking-widest">
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Atualizar Senha</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsResetFlow(false); setIsLogin(true); navigate('/auth'); }}
                  className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors block w-full text-center mt-4"
                >
                  Cancelar e Voltar
                </button>
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  {!isLogin && !isForgot && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                        <UserIcon className="w-3 h-3" /> {t('name')}
                      </label>
                      <input
                        type="text"
                        required={!isLogin && !isForgot}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background-main/50 border border-border rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/5 transition-all font-medium"
                        placeholder="Seu Nome Completo"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {isForgot ? (
                    <motion.div
                      key="forgot"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4"
                    >
                      <p className="text-zinc-400 text-xs text-center px-4">
                        Insira seu e-mail para receber as instruções de recuperação de senha.
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background-main/50 border border-border rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/5 transition-all font-medium"
                    placeholder="nome@oficina.com"
                  />
                </div>

                <AnimatePresence mode="wait">
                  {!isForgot && (
                    <motion.div
                      key="password-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                          <Lock className="w-3 h-3" /> {t('password')}
                        </label>
                      </div>
                      <input
                        type="password"
                        required={!isForgot}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-background-main/50 border border-border rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/5 transition-all font-medium"
                        placeholder="••••••••"
                      />
                      {isLogin && (
                        <div className="flex justify-end pr-2">
                          <button
                            type="button"
                            onClick={() => setIsForgot(true)}
                            className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                          >
                            Esqueceu a senha?
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full overflow-hidden"
                >
                  <div className={`absolute inset-0 ${isForgot ? 'bg-orange-500 group-hover:bg-orange-600' : 'bg-white group-hover:bg-zinc-200'} transition-colors`} />
                  <div className={`relative h-14 flex items-center justify-center gap-3 ${isForgot ? 'text-white' : 'text-black'} text-[10px] font-black uppercase tracking-widest`}>
                    {loading ? (
                      <div className={`w-4 h-4 border-2 ${isForgot ? 'border-white/20 border-t-white' : 'border-black/20 border-t-black'} rounded-full animate-spin`}></div>
                    ) : (
                      <>
                        <span>{isForgot ? "Enviar Recuperação" : isLogin ? t('sign_in') : t('get_started')}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </button>

                <div className="mt-10 pt-8 border-t border-border/50 text-center space-y-4">
                  {isForgot ? (
                    <button
                      type="button"
                      onClick={() => setIsForgot(false)}
                      className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors block w-full"
                    >
                      Voltar para o login
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors block w-full"
                    >
                      {isLogin ? "Não possui conta?" : "Já possui conta?"}
                      <span className={`ml-2 ${isLogin ? 'text-purple-400' : 'text-blue-400'}`}>
                        {isLogin ? t('register_title') : t('sign_in')}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate('/consultar')}
                    className="group flex items-center justify-center gap-2 w-full py-4 border border-white/5 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>{t('consult_os')}</span>
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthScreen;
