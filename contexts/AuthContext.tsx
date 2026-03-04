'use client';
// Dummy file to enable Firebase Auth Context
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/firebase';

export type UserRoles = {
    conversao: boolean;
    topografia: boolean;
    numerarPostes: boolean;
    admin: boolean;
};

type AuthContextType = {
    user: User | null;
    roles: UserRoles | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    roles: null,
    loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [roles, setRoles] = useState<UserRoles | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Fetch roles from Firestore users/{uid}
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    const userSnap = await getDoc(userDocRef);
                    const isAdminEmail = currentUser.email?.toLowerCase() === 'gabriel.welsing@gmail.com';

                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        const isApproved = data.status === 'approved';

                        setRoles({
                            conversao: !!data.roles?.conversao || isApproved,
                            topografia: !!data.roles?.topografia,
                            numerarPostes: !!data.roles?.numerarPostes,
                            admin: !!data.roles?.admin || isAdminEmail,
                        });
                    } else {
                        // Default roles for existing users without document or new users
                        setRoles({
                            conversao: isAdminEmail,
                            topografia: isAdminEmail,
                            numerarPostes: isAdminEmail,
                            admin: isAdminEmail
                        });
                    }
                } catch (error) {
                    console.error("Error fetching user roles:", error);
                    setRoles({ conversao: false, topografia: false, numerarPostes: false, admin: false });
                }
            } else {
                setRoles(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, roles, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
