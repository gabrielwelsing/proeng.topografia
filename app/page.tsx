'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function HomeRedirect() {
    const { user, roles, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.replace('/login');
        } else {
            router.replace('/hub');
        }
    }, [user, roles, loading, router]);

    return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-900">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
    );
}
