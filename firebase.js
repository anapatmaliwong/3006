/**
 * Firebase Admin SDK — server-side only
 * Client browsers never see these credentials
 */
const admin = require('firebase-admin');

let db = null;

function initFirebase() {
  if (admin.apps.length) return admin.app();

  // Option A: Use service account JSON (recommended for production)
  // Place service-account.json in /backend/config/
  const fs = require('fs');
  const saPath = require('path').join(__dirname, 'service-account.json');

  if (fs.existsSync(saPath)) {
    const serviceAccount = require('./service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase Admin: initialized with service account file');
  } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    // Option B: Use env vars
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('Firebase Admin: initialized with env vars');
  } else {
    throw new Error(
      'Firebase Admin: no credentials found.\n' +
      'Either place service-account.json in /backend/config/ or set FIREBASE env vars in .env'
    );
  }

  db = admin.database();
  return admin.app();
}

function getDB() {
  if (!db) initFirebase();
  return db;
}

module.exports = { initFirebase, getDB, admin };
