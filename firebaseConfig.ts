// firebaseConfig.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyChPvfOL16UXqBnOeZ9Eph3ydUX8X3cLxY",
  authDomain: "family-tree-app-df08f.firebaseapp.com",
  projectId: "family-tree-app-df08f",
  storageBucket: "family-tree-app-df08f.firebasestorage.app",
  messagingSenderId: "285997356019",
  appId: "1:285997356019:web:3ea8c654cce0a26c0ab886",
};

// 🔒 Prevent re-initialization (Expo reload safe)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ✅ Universal auth (works for Android + Web + PWA)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// ✅ Firestore
export const db = getFirestore(app);

// ✅ Storage
export const storage = getStorage(app);

export default app;
