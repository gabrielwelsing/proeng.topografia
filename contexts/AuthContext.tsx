'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/app/firebase';

export type UserRoles = {
    conversao: boolean;
    topografia: boolean;
    pre_projeto: boolean;
    ambiental: boolean;
    earth: boolean;
    numerarPostes: boolean;
    admin: boolean;
};

type AuthContextType = {
    user: User | null;
    roles: UserRoles | null;
    status: string | null;       // 'approved' | 'pending' | 'rejected' | null
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    roles: null,
    status: null,
    loading: true,
});

const ADMIN_EMAIL = 'gabriel.welsing@gmail.com';

const NO_ROLES: UserRoles = {
    conversao: false, topografia: false, pre_projeto: false,
    ambiental: false, earth: false, numerarPostes: false, admin: false
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [roles, setRoles] = useState<UserRoles | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubSnapshot: (() => void) | null = null;

        const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
            // Clean up old snapshot when user changes
            if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }

            setUser(currentUser);

            if (!currentUser) {
                setRoles(null);
                setStatus(null);
                setLoading(false);
                return;
            }

            const userDocRef = doc(db, 'users', currentUser.uid);
            const isAdminEmail = currentUser.email?.toLowerCase() === ADMIN_EMAIL;
            let isFirstSnapshot = true;

            unsubSnapshot = onSnapshot(userDocRef, async (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const approved = data.status === 'approved';

                    setStatus(data.status || 'pending');
                    setRoles({
                        conversao: !!data.roles?.conversao || approved,
                        topografia: !!data.roles?.topografia || approved,
                        pre_projeto: !!data.roles?.pre_projeto || !!data.roles?.topografia || approved,
                        ambiental: !!data.roles?.ambiental || approved,
                        earth: !!data.roles?.earth || !!data.roles?.pre_projeto || !!data.roles?.ambiental || approved,
                        numerarPostes: !!data.roles?.numerarPostes || !!data.roles?.admin || isAdminEmail,
                        admin: !!data.roles?.admin || isAdminEmail,
                    });
                } else {
                    // First-time sign-in (Google or otherwise) — create the pending doc
                    const displayName = currentUser.displayName
                        || currentUser.email?.split('@')[0]
                        || 'Novo Usuário';

                    // Set roles to pending immediately so the UI reacts
                    setStatus('pending');
                    setRoles({ ...NO_ROLES, admin: isAdminEmail });

                    try {
                        await setDoc(userDocRef, {
                            name: displayName,
                            email: (currentUser.email || '').toLowerCase(),
                            status: 'pending',
                            roles: { ...NO_ROLES },
                            createdAt: serverTimestamp()
                        });
                        // onSnapshot will fire again with the new doc, updating roles
                    } catch (writeErr) {
                        console.error("Error creating user doc:", writeErr);
                    }
                }

                // Only set loading to false AFTER the first snapshot populates roles
                if (isFirstSnapshot) {
                    isFirstSnapshot = false;
                    setLoading(false);
                }
            }, (err) => {
                console.error("Snapshot error:", err);
                setRoles(NO_ROLES);
                setStatus(null);
                setLoading(false);
            });
        });

        return () => {
            unsubAuth();
            if (unsubSnapshot) unsubSnapshot();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, roles, status, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
