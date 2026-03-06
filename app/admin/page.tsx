'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/app/firebase';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, ArrowLeft, Loader2, UserX, UserCheck, Settings, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCKco1J5ZPYz6G0pcXFrgiL70fON7pVSPE';

type UserData = {
    id: string;
    name?: string;
    email: string;
    status?: string;
    roles?: {
        conversao: boolean;
        topografia: boolean;
        pre_projeto: boolean;
        ambiental: boolean;
        earth: boolean;
        numerarPostes: boolean;
        admin: boolean;
    };
    createdAt?: any;
};

export default function AdminPage() {
    const { user, roles, loading } = useAuth();
    const router = useRouter();
    const [usersList, setUsersList] = useState<UserData[]>([]);
    const [fetching, setFetching] = useState(true);

    // Create user form
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRoles, setNewRoles] = useState({
        conversao: false, topografia: false, earth: false, numerarPostes: false, admin: false
    });
    const [creating, setCreating] = useState(false);
    const [createMsg, setCreateMsg] = useState('');
    const [createErr, setCreateErr] = useState('');

    useEffect(() => {
        if (!loading && (!user || !roles?.admin)) {
            router.replace('/hub');
        }
    }, [user, roles, loading, router]);

    useEffect(() => {
        if (!roles?.admin) return;

        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: UserData[] = [];
            snapshot.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() } as UserData);
            });
            // Sort: pending first, then by most recent (createdAt desc)
            list.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                const dateA = a.createdAt?.toMillis?.() || 0;
                const dateB = b.createdAt?.toMillis?.() || 0;
                return dateB - dateA;
            });
            setUsersList(list);
            setFetching(false);
        }, (error) => {
            console.error('Erro ao buscar usuários:', error);
            setFetching(false);
        });

        return () => unsubscribe();
    }, [roles]);

    if (loading || !user || !roles?.admin) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-500 font-bold">Verificando permissões...</p>
            </div>
        );
    }

    const updateUserStatus = async (userId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'users', userId), { status: newStatus });
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar o status do usuário.");
        }
    };

    const toggleRole = async (userId: string, currentRoles: any, roleName: 'conversao' | 'topografia' | 'pre_projeto' | 'ambiental' | 'earth' | 'numerarPostes' | 'admin') => {
        try {
            const updatedRoles = {
                conversao: currentRoles?.conversao || false,
                topografia: currentRoles?.topografia || false,
                pre_projeto: currentRoles?.pre_projeto || false,
                ambiental: currentRoles?.ambiental || false,
                earth: currentRoles?.earth || false,
                numerarPostes: currentRoles?.numerarPostes || false,
                admin: currentRoles?.admin || false,
                [roleName]: !(currentRoles?.[roleName])
            };

            await updateDoc(doc(db, 'users', userId), { roles: updatedRoles });
        } catch (error) {
            console.error("Erro ao atualizar role:", error);
            alert("Erro ao atualizar módulos do usuário.");
        }
    };

    const handleCreateUser = async () => {
        if (!newName || !newEmail || !newPassword) {
            setCreateErr('Preencha todos os campos.');
            return;
        }
        if (newPassword.length < 6) {
            setCreateErr('Senha deve ter ao menos 6 caracteres.');
            return;
        }

        setCreating(true);
        setCreateErr('');
        setCreateMsg('');

        try {
            // 1. Create Firebase Auth user via REST API (doesn't affect admin session)
            const res = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: newEmail.toLowerCase().trim(),
                        password: newPassword,
                        returnSecureToken: false
                    })
                }
            );

            const data = await res.json();

            if (data.error) {
                if (data.error.message === 'EMAIL_EXISTS') {
                    setCreateErr('Este e-mail já está cadastrado.');
                } else {
                    setCreateErr(`Erro: ${data.error.message}`);
                }
                setCreating(false);
                return;
            }

            const newUid = data.localId;

            // 2. Create Firestore document — already approved with selected roles
            await setDoc(doc(db, 'users', newUid), {
                name: newName.trim(),
                email: newEmail.toLowerCase().trim(),
                status: 'approved',
                roles: {
                    conversao: newRoles.conversao,
                    topografia: newRoles.topografia,
                    pre_projeto: false,
                    ambiental: false,
                    earth: newRoles.earth,
                    admin: newRoles.admin
                },
                createdAt: serverTimestamp()
            });

            setCreateMsg(`✅ ${newName} criado e aprovado com sucesso!`);
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewRoles({ conversao: false, topografia: false, earth: false, numerarPostes: false, admin: false });
        } catch (err: any) {
            console.error('Erro ao criar usuário:', err);
            setCreateErr('Erro ao criar usuário. Verifique a conexão.');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-slate-900 text-white px-6 py-4 shadow-md sticky top-0 z-10 flex items-center gap-4">
                <Link href="/hub" className="text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex items-center gap-3">
                    <ShieldCheck size={28} className="text-emerald-400" />
                    <h1 className="font-black text-xl uppercase tracking-wider">Painel de Acessos</h1>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-6 mt-6 space-y-6">

                {/* CRIAR USUÁRIO */}
                <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
                    <button
                        onClick={() => { setShowCreateForm(!showCreateForm); setCreateMsg(''); setCreateErr(''); }}
                        className="w-full p-5 flex items-center justify-between hover:bg-blue-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center">
                                <UserPlus size={20} className="text-blue-600" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-lg font-bold text-slate-800">Criar Usuário</h2>
                                <p className="text-xs text-slate-400">Crie e aprove um novo usuário diretamente</p>
                            </div>
                        </div>
                        {showCreateForm ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    </button>

                    {showCreateForm && (
                        <div className="p-5 pt-0 border-t border-blue-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                                <input
                                    value={newName} onChange={e => setNewName(e.target.value)}
                                    placeholder="Nome completo"
                                    className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800"
                                />
                                <input
                                    value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                    placeholder="E-mail"
                                    type="email"
                                    className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800"
                                />
                                <input
                                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Senha (min 6 caracteres)"
                                    type="text"
                                    className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium text-slate-800 font-mono"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-4 mt-4">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Módulos:</span>
                                {(['conversao', 'topografia', 'earth', 'numerarPostes', 'admin'] as const).map(role => (
                                    <label key={role} className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded border border-transparent hover:border-slate-300 transition-all">
                                        <input
                                            type="checkbox"
                                            checked={newRoles[role]}
                                            onChange={() => setNewRoles(prev => ({ ...prev, [role]: !prev[role] }))}
                                            className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4"
                                        />
                                        {role === 'conversao' ? 'Conversor' : role === 'topografia' ? 'Contar US' : role === 'earth' ? 'Integração Earth' : role === 'numerarPostes' ? 'Numerar Postes' : 'Admin'}
                                    </label>
                                ))}
                            </div>

                            {createErr && <p className="text-red-500 text-xs mt-3 font-bold bg-red-50 p-2 rounded">{createErr}</p>}
                            {createMsg && <p className="text-emerald-600 text-xs mt-3 font-bold bg-emerald-50 p-2 rounded">{createMsg}</p>}

                            <button
                                onClick={handleCreateUser}
                                disabled={creating}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                            >
                                {creating ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : <><UserPlus size={16} /> Criar e Aprovar</>}
                            </button>
                        </div>
                    )}
                </div>

                {/* LISTA DE USUÁRIOS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800">Usuários Cadastrados</h2>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {usersList.length} registros
                        </div>
                    </div>

                    {fetching ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                            <Loader2 className="w-6 h-6 animate-spin mb-2" />
                            Carregando base de usuários...
                        </div>
                    ) : usersList.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 font-medium">
                            Nenhum usuário encontrado no sistema.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {usersList.map((usr) => (
                                <div key={usr.id} className="p-6 flex flex-col md:flex-row gap-6 md:items-center hover:bg-slate-50 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-bold text-slate-800 text-lg">{usr.name || 'Usuário Existente'}</h3>
                                            {usr.status === 'pending' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">Pendente</span>}
                                            {usr.status === 'approved' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">Aprovado</span>}
                                            {usr.status === 'rejected' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">Recusado</span>}
                                        </div>
                                        <div className="text-slate-500 text-sm font-medium">{usr.email}</div>
                                        <div className="text-slate-400 text-xs mt-1">ID: {usr.id}</div>
                                    </div>

                                    <div className="flex flex-col gap-3 shrink-0 bg-slate-100 p-4 rounded-xl border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                            <Settings size={12} /> Permissões & Módulos
                                        </div>

                                        <div className="flex gap-2">
                                            {usr.status === 'pending' ? (
                                                <>
                                                    <button onClick={() => updateUserStatus(usr.id, 'approved')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1">
                                                        <UserCheck size={14} /> Aprovar Acesso
                                                    </button>
                                                    <button onClick={() => updateUserStatus(usr.id, 'rejected')} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1">
                                                        <UserX size={14} /> Recusar
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => updateUserStatus(usr.id, usr.status === 'approved' ? 'rejected' : 'approved')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1 ${usr.status === 'approved' ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}>
                                                    {usr.status === 'approved' ? <><UserX size={14} /> Revogar Acesso Geral</> : <><UserCheck size={14} /> Reativar Acesso</>}
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-3 mt-2">
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded border border-transparent hover:border-slate-300 transition-all">
                                                <input type="checkbox" checked={!!usr.roles?.conversao} onChange={() => toggleRole(usr.id, usr.roles, 'conversao')} className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4" />
                                                Conversor
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded border border-transparent hover:border-slate-300 transition-all">
                                                <input type="checkbox" checked={!!usr.roles?.topografia} onChange={() => toggleRole(usr.id, usr.roles, 'topografia')} className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4" />
                                                Contar US
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded border border-transparent hover:border-slate-300 transition-all">
                                                <input type="checkbox" checked={!!usr.roles?.earth || !!usr.roles?.pre_projeto || !!usr.roles?.ambiental} onChange={() => toggleRole(usr.id, usr.roles, 'earth')} className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4" />
                                                Integração Earth
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded border border-transparent hover:border-slate-300 transition-all">
                                                <input type="checkbox" checked={!!usr.roles?.numerarPostes} onChange={() => toggleRole(usr.id, usr.roles, 'numerarPostes')} className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4" />
                                                Numerar Postes
                                            </label>
                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded border border-transparent hover:border-slate-300 transition-all">
                                                <input type="checkbox" checked={!!usr.roles?.admin} onChange={() => toggleRole(usr.id, usr.roles, 'admin')} className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4" />
                                                Admin
                                            </label>
                                        </div >
                                    </div >
                                </div >
                            ))
                            }
                        </div >
                    )}
                </div >
            </main >
        </div >
    );
}

