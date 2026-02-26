'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/app/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const { user } = useAuth();

    // If already logged in, go to hub
    if (user && !loading) {
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
                setError('Erro Interno: Chave de API inválida na Vercel.');
            } else if (err.code === 'auth/unauthorized-domain') {
                setError('Domínio não autorizado no Firebase console.');
            } else {
                setError('Credenciais inválidas ou erro no login. (' + (err.code || 'Erro desconhecido') + ')');
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
                name, email, status: 'pending',
                roles: { conversao: false, topografia: false, admin: false },
                createdAt: serverTimestamp(),
            });
            await signOut(auth);
            setIsRegister(false);
            setSuccessMsg('Solicitação enviada! Aguarde aprovação do administrador para ter roles atribuídas.');
            setName(''); setEmail(''); setPassword('');
        } catch {
            setError('Erro ao solicitar acesso. E-mail já cadastrado?');
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
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-800 placeholder-slate-400"
                />

                <button
                    onClick={isRegister ? handleRegister : handleLogin}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white w-full py-3.5 rounded-xl font-black text-[15px] shadow-lg shadow-blue-500/30 transition-all active:scale-95 uppercase tracking-wider"
                >
                    {loading ? 'Aguarde...' : isRegister ? 'Solicitar Acesso' : 'Entrar no Portal'}
                </button>

                <button
                    onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg(''); }}
                    className="mt-6 text-[13px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
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
