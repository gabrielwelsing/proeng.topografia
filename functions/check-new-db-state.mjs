import { readFileSync } from 'fs';
import admin from 'firebase-admin';

const serviceAccount = JSON.parse(readFileSync('C:\\Users\\KABUM\\Downloads\\ecossistema-pro-db-firebase-adminsdk-fbsvc-f517b551da.json', 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function checkState() {
    console.log("--- Firebase Auth Users ---");
    const listUsersResult = await auth.listUsers(100);
    listUsersResult.users.forEach((userRecord) => {
        console.log(`UID: ${userRecord.uid}, Email: ${userRecord.email}, Providers: ${userRecord.providerData.map(p => p.providerId).join(', ')}`);
    });

    console.log("\n--- Firestore /users ---");
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
        console.log("No users found in Firestore.");
    } else {
        snapshot.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
        });
    }
}

checkState().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
