'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/app/firebase';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { ShieldCheck, ArrowLeft, Loader2, UserX, UserCheck, Settings } from 'lucide-react';
import Link from 'next/link';

type UserData = {
    id: string;
    name?: string;
    email: string;
    status?: string;
    roles?: {
        conversao: boolean;
        topografia: boolean;
        admin: boolean;
    };
    createdAt?: any;
};

export default function AdminPage() {
    const { user, roles, loading } = useAuth();
    const router = useRouter();
    const [usersList, setUsersList] = useState<UserData[]>([]);
    const [fetching, setFetching] = useState(true);

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

    const toggleRole = async (userId: string, currentRoles: any, roleName: 'conversao' | 'topografia' | 'admin') => {
        try {
            const newRoles = {
                conversao: currentRoles?.conversao || false,
                topografia: currentRoles?.topografia || false,
                admin: currentRoles?.admin || false,
                [roleName]: !(currentRoles?.[roleName])
            };

            await updateDoc(doc(db, 'users', userId), { roles: newRoles });
        } catch (error) {
            console.error("Erro ao atualizar role:", error);
            alert("Erro ao atualizar módulos do usuário.");
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

            <main className="max-w-5xl mx-auto p-6 mt-6">
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
                                                <input type="checkbox" checked={!!usr.roles?.admin} onChange={() => toggleRole(usr.id, usr.roles, 'admin')} className="rounded text-blue-500 focus:ring-blue-500 w-4 h-4" />
                                                Admin
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
