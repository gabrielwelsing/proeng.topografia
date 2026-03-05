/**
 * Cloud Functions for Ecossistema Pro
 * 
 * onUserCreated: Triggered automatically when ANY user is created in Firebase Auth
 * (email/password, Google sign-in, any provider).
 * Creates a Firestore document in the 'users' collection with status: 'pending'.
 * This guarantees that EVERY Auth user has a corresponding Firestore document,
 * eliminating the "limbo" problem where users exist in Auth but not in Firestore.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Trigger: runs every time a new Auth user is created
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const uid = user.uid;
    const email = (user.email || "").toLowerCase();
    const displayName = user.displayName || email.split("@")[0] || "Novo Usuário";

    // Check if doc already exists (e.g., created by admin panel)
    const docRef = db.doc(`users/${uid}`);
    const existing = await docRef.get();

    if (existing.exists) {
        console.log(`Document already exists for ${email} (${uid}). Skipping.`);
        return null;
    }

    // Create the user document with pending status
    const userData = {
        name: displayName,
        email: email,
        status: "pending",
        roles: {
            conversao: false,
            topografia: false,
            pre_projeto: false,
            ambiental: false,
            earth: false,
            admin: false,
        },
        provider: user.providerData && user.providerData.length > 0
            ? user.providerData[0].providerId
            : "unknown",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(userData);
    console.log(`✅ Created Firestore doc for ${email} (${uid}) via ${userData.provider}`);
    return null;
});
