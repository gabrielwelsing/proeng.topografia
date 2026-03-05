'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogOut, Image as ImageIcon, Map, Globe, ShieldAlert, Loader2, Clock, FileText } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/firebase';
import Link from 'next/link';

export default function HubPage() {
    const { user, roles, status, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading || !user || !roles) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    const handleLogout = async () => {
        await signOut(auth);
        router.replace('/login');
    };

<<<<<<< HEAD
    const hasNoRoles = !roles.admin && !roles.conversao && !roles.topografia && !roles.numerarPostes;
=======
    // User is pending or rejected — show a clear message
    if (status === 'pending') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
                <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 text-white p-2 rounded-lg"><Map size={20} /></div>
                        <div>
                            <h1 className="font-black text-xl text-slate-800 uppercase tracking-tight leading-none">ProEng</h1>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ecossistema Pro</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-slate-700">{user.email}</div>
                            <div className="text-[10px] font-bold text-amber-500 uppercase">Aguardando Aprovação</div>
                        </div>
                        <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 px-3 py-2 rounded-lg">
                            <LogOut size={16} /> Sair
                        </button>
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-amber-200 text-center max-w-md">
                        <Clock size={48} className="text-amber-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-slate-800 mb-3">Acesso Pendente</h2>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Sua conta foi criada com sucesso! Um administrador precisa aprovar o seu acesso.
                            <br /><br />
                            <strong>Esta tela atualiza automaticamente.</strong> Assim que o admin liberar, os módulos aparecerão aqui sem precisar recarregar.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    if (status === 'rejected') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
                <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 text-white p-2 rounded-lg"><Map size={20} /></div>
                        <div>
                            <h1 className="font-black text-xl text-slate-800 uppercase tracking-tight leading-none">ProEng</h1>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ecossistema Pro</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 px-3 py-2 rounded-lg">
                        <LogOut size={16} /> Sair
                    </button>
                </header>
                <main className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-red-200 text-center max-w-md">
                        <ShieldAlert size={48} className="text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-slate-800 mb-3">Acesso Negado</h2>
                        <p className="text-slate-500 text-sm">Seu acesso foi recusado pelo administrador. Fale com a equipe se isto foi um engano.</p>
                    </div>
                </main>
            </div>
        );
    }
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {(roles.admin || roles.pre_projeto || roles.topografia) && (
                <Link href="/topografia" className="group block">
                    <div className="bg-white border-2 border-slate-100 hover:border-blue-500 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1 h-full flex flex-col items-center text-center cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-blue-600 group-hover:text-white shadow-inner">
                            <Map size={32} />
                        </div>
<<<<<<< HEAD
                                </Link >
                            )
}

{
    (roles.admin || roles.conversao) && (
        <a href="/conversor/index.html" className="group block">
            <div className="bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1 h-full flex flex-col items-center text-center cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-emerald-600 group-hover:text-white shadow-inner">
                    <ImageIcon size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Conversor de Fotos</h3>
                <p className="text-slate-500 text-sm">
                    Ferramenta de conversão em lote de imagens arrastadas para relatórios PDF.
                </p>
            </div>
        </a>
    )
}

{
    (roles.admin || roles.numerarPostes) && (
        <a href="/numerar-postes/index.html" className="group block">
            <div className="bg-white border-2 border-slate-100 hover:border-amber-500 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1 h-full flex flex-col items-center text-center cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-amber-600 group-hover:text-white shadow-inner">
                    <FileText size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Numerar Postes</h3>
                <p className="text-slate-500 text-sm">
                    Contagem e numeração de postes em projetos de rede PDF com exportação marcada.
                </p>
            </div>
        </a>
    )
}

                        </div >

{
    roles.admin && (
        <div className="mt-12 text-center">
            <Link href="/admin" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
                <ShieldAlert size={18} />
                Gerenciar Acessos (Aprovar Usuários)
            </Link>
        </div>
=======
                                    <h3 className="text-xl font-black text-slate-800 mb-2">Contar US (Topografia)</h3>
                                    <p className="text-slate-500 text-sm">
                                        Sistema de levantamento topográfico, lançamento de postes, projetos e exportação unificada.
                                    </p>
                                </div>
                            </Link>
>>>>>>> ecef8b3 (feat: Integrar módulo Numerar Postes e ajustes visuais)
    )
}

{
    (roles.admin || roles.conversao) && (
        <a href="/conversor/index.html" className="group block">
            <div className="bg-white border-2 border-slate-100 hover:border-emerald-500 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1 h-full flex flex-col items-center text-center cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-emerald-600 group-hover:text-white shadow-inner">
                    <ImageIcon size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Conversor de Fotos</h3>
                <p className="text-slate-500 text-sm">
                    Ferramenta de conversão em lote de imagens arrastadas para relatórios PDF.
                </p>
            </div>
        </a>
    )
}

{
    (roles.admin || roles.earth || roles.pre_projeto || roles.ambiental) && (
        <Link href="/earth" className="group block">
            <div className="bg-white border-2 border-slate-100 hover:border-cyan-500 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1 h-full flex flex-col items-center text-center cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="w-16 h-16 bg-cyan-100 text-cyan-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-cyan-600 group-hover:text-white shadow-inner">
                    <Globe size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Integração Earth</h3>
                <p className="text-slate-500 text-sm">
                    Extração de coordenadas UTM de PDFs e exportação de pontos KML para Google Earth.
                </p>
            </div>
        </Link>
    )
}

{
    (roles.admin || roles.numerarPostes) && (
        <a href="/numerar-postes/index.html" className="group block">
            <div className="bg-white border-2 border-slate-100 hover:border-amber-500 rounded-3xl p-8 transition-all hover:shadow-xl hover:-translate-y-1 h-full flex flex-col items-center text-center cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-amber-600 group-hover:text-white shadow-inner">
                    <FileText size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Numerar Postes</h3>
                <p className="text-slate-500 text-sm">
                    Classificação visual e quantificação direta em plantas PDF de postes existentes e projetados.
                </p>
            </div>
        </a>
    )
}

                    </div >

{
    roles.admin && (
        <div className="mt-12 text-center">
            <Link href="/admin" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
                <ShieldAlert size={18} />
                Gerenciar Acessos (Aprovar Usuários)
            </Link>
        </div>
    )
}
                </div >
            </main >
        </div >
    );
}
