import { readFileSync } from 'fs';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(readFileSync('C:\\Users\\KABUM\\Downloads\\ecossistema-pro-db-firebase-adminsdk-fbsvc-f517b551da.json', 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function seedAdmin() {
    const email = 'gabriel.welsing@gmail.com';
    let userRecord;
    try {
        // Try to find the user
        userRecord = await auth.getUserByEmail(email);
        console.log('User already exists in Auth:', userRecord.uid);
    } catch (e) {
        if (e.code === 'auth/user-not-found') {
            // Create the user if doesn't exist
            userRecord = await auth.createUser({
                email,
                password: 'Proeng2026Password!',
                emailVerified: true,
                displayName: 'Gabriel Welsing'
            });
            console.log('Created user in Auth:', userRecord.uid);
        } else {
            throw e;
        }
    }

    // Always create/update the document so the permissions are forced to true
    const docRef = db.collection('users').doc(userRecord.uid);
    await docRef.set({
        name: 'Gabriel Welsing',
        email: email,
        status: 'approved',
        roles: {
            admin: true,
            ambiental: true,
            conversao: true,
            impedimentos: true,
            preprojeto: true
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Created/Updated Admin document in Firestore for uid:', userRecord.uid);
}

seedAdmin().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
