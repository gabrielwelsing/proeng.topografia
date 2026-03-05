'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/app/firebase';
import { useRouter } from 'next/navigation';

const googleProvider = new GoogleAuthProvider();

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // If already logged in, go to hub (hub handles pending/rejected)
    if (user && !authLoading) {
        router.replace('/hub');
        return null;
    }

    const handleLogin = async () => {
        if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
        setLoading(true); setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.replace('/hub');
        } catch (err: any) {
            console.error("Login Error:", err);
            if (err.code === 'auth/invalid-api-key') {
                setError('Erro Interno: Chave de API inválida.');
            } else if (err.code === 'auth/unauthorized-domain') {
                setError('Domínio não autorizado no Firebase.');
            } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('E-mail ou senha incorretos.');
            } else {
                setError('Erro no login. (' + (err.code || 'Erro desconhecido') + ')');
            }
        } finally { setLoading(false); }
    };

    const handleGoogleLogin = async () => {
        setLoading(true); setError('');
        try {
            await signInWithPopup(auth, googleProvider);
            // AuthContext will auto-create the user doc if it doesn't exist
            router.replace('/hub');
        } catch (err: any) {
            console.error("Google Login Error:", err);
            if (err.code === 'auth/popup-closed-by-user') {
                // User closed popup, no error needed
            } else if (err.code === 'auth/unauthorized-domain') {
                setError('Domínio não autorizado para login Google.');
            } else {
                setError('Erro no login com Google. (' + (err.code || err.message) + ')');
            }
        } finally { setLoading(false); }
    };

    const handleRegister = async () => {
        if (!name || !email || !password) { setError('Preencha todos os campos.'); return; }
        if (password.length < 6) { setError('Senha deve ter ao menos 6 caracteres.'); return; }
        setLoading(true); setError('');
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);

            await setDoc(doc(db, 'users', cred.user.uid), {
                name,
                email: email.toLowerCase(),
                status: 'pending',
                roles: {
                    conversao: false,
                    topografia: false,
                    pre_projeto: false,
                    ambiental: false,
                    earth: false,
                    admin: false
                },
                createdAt: serverTimestamp(),
            });

            await signOut(auth);
            setIsRegister(false);
            setSuccessMsg('Solicitação enviada! Aguarde aprovação do administrador.');
            setName(''); setEmail(''); setPassword('');
        } catch (err: any) {
            console.error("Registration error:", err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está cadastrado. Tente fazer login.');
            } else if (err.code === 'auth/weak-password') {
                setError('Senha muito fraca. Use ao menos 6 caracteres.');
            } else {
                setError('Erro ao solicitar acesso. (' + (err.code || err.message) + ')');
            }
        } finally { setLoading(false); }
    };

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 font-sans p-6 overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888081628-912b79a83687?q=80&w=2000')] bg-cover bg-center opacity-10"></div>

            <div className="z-10 bg-white/95 backdrop-blur-md p-10 rounded-[2rem] text-center shadow-2xl max-w-sm w-full border-b-[8px] border-blue-600">
                <h1 className="text-4xl font-black text-slate-800 mb-2 tracking-tighter uppercase relative group cursor-default">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">Pro</span><span className="text-slate-800">Eng</span>
                </h1>
                <p className="text-sm font-semibold text-slate-500 mb-8">{isRegister ? 'Solicitar Acesso' : 'Ecossistema Pro'}</p>

                {error && <p className="text-red-500 text-xs mb-4 font-bold bg-red-50 p-2 rounded">{error}</p>}
                {successMsg && <p className="text-green-600 text-xs mb-4 font-bold bg-green-50 p-2 rounded">{successMsg}</p>}

                {isRegister && (
                    <input
                        type="text" placeholder="Nome completo" value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-800 placeholder-slate-400"
                    />
                )}
                <input
                    type="email" placeholder="E-mail profissional" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-800 placeholder-slate-400"
                />
                <input
                    type="password" placeholder="Senha" value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (isRegister ? handleRegister() : handleLogin())}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-800 placeholder-slate-400"
                />

                <button
                    onClick={isRegister ? handleRegister : handleLogin}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white w-full py-3.5 rounded-xl font-black text-[15px] shadow-lg shadow-blue-500/30 transition-all active:scale-95 uppercase tracking-wider"
                >
                    {loading ? 'Aguarde...' : isRegister ? 'Solicitar Acesso' : 'Entrar no Portal'}
                </button>

                {/* Google Sign-In — only show on login, not register */}
                {!isRegister && (
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="mt-3 w-full py-3 rounded-xl font-bold text-[13px] border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-60"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Entrar com Google
                    </button>
                )}

                <button
                    onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg(''); }}
                    className="mt-5 text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
                >
                    {isRegister ? 'Já tem conta? Fazer Login' : 'Não tem conta? Solicitar Acesso'}
                </button>
            </div>

            <div className="z-10 mt-8 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Pro Engenharia &copy; {new Date().getFullYear()}
            </div>
        </div>
    );
}
