import admin from 'firebase-admin';

let firebaseApp: admin.app.App;

export function initializeFirebase() {
  if (!firebaseApp) {
    // Initialize Firebase Admin SDK
    // In production, credentials are automatically loaded from environment
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  return firebaseApp;
}

export function getFirestore() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.firestore();
}

export function getAuth() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
}

export function getStorage() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.storage();
}
