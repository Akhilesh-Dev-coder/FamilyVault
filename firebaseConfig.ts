// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// 🔽 Add these
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyChPvfOL16UXqBnOeZ9Eph3ydUX8X3cLxY",
  authDomain: "family-tree-app-df08f.firebaseapp.com",
  projectId: "family-tree-app-df08f",
  storageBucket: "family-tree-app-df08f.firebasestorage.app",
  messagingSenderId: "285997356019",
  appId: "1:285997356019:web:3ea8c654cce0a26c0ab886"
};

const app = initializeApp(firebaseConfig);

// 🔽 Initialize auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export { auth };