// App.tsx (main entry)
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Alert } from 'react-native';

// 🔽 FONT LOADING (THIS FIXES ICONS ON WEB)
import { useFonts } from 'expo-font';
import {
  Ionicons,
  MaterialIcons,
  Feather,
  FontAwesome,
} from '@expo/vector-icons';

import FamilyTreeApp from './FamilyTreeApp';
import LoginScreen from './LoginScreen';
import SignUpScreen from './SignUpScreen';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoginView, setIsLoginView] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // 🔑 Load icon fonts (MANDATORY for Expo Web)
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...Feather.font,
    ...FontAwesome.font,
  });

  // 🔐 Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // If we are in the middle of a signup flow that intends to force logout,
        // ignore this auto-signin event so we don't flash the main app.
        if (isSigningUp) {
          return;
        }

        // User is authenticated, but let's check if they are allowed (Suspended/Deleted)
        try {
          const userDocRef = doc(db, 'Users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.suspended) {
              Alert.alert('Access Denied', 'Your account has been suspended by an administrator.');
              await signOut(auth);
              setUser(null);
            } else {
              // Valid user
              setUser(currentUser);
            }
          } else {
            // User has Auth but no Firestore doc (Deleted by Admin)
            Alert.alert('Account Not Found', 'Your user profile has been deleted. Please contact support or sign up again.');
            // Optional: If you want to force them to sign up again, you could keep them logged in but redirect to SignUp?
            // But simpler is to kick them out.
            await signOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // If network error, maybe let them in or block? defaulting to block for safety if suspended
          // But for UX, maybe allowed? Let's allow but log.
          // actually, if we can't verify, we should probably be careful. 
          // For now, let's assume valid if fetch fails (offline), or handle offline gracefully later.
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, [isSigningUp]); // Add isSigningUp dependence so listener updates? No, onAuthStateChanged returns unsubscribe.
  // CRITICAL: onAuthStateChanged is an observer. if isSigningUp changes, we might want to ensure the logic within the callback sees the new value.
  // Since isSigningUp is state, accessing it inside the closure defined on mount (dependency []) will see STALE value (false).
  // We need to use a ref or depend on it. But recreating the listener on every state change is potentially expensive/flashy?
  // Actually, onAuthStateChanged is expensive to attach/detach? Not really.
  // Let's add [isSigningUp] to dependency array.

  // ⛔ Block render until BOTH auth + fonts are ready
  if (authLoading || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#2563eb" />
          <Text>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {user ? (
        <FamilyTreeApp />
      ) : isLoginView ? (
        <LoginScreen onNavigate={() => setIsLoginView(false)} />
      ) : (
        <SignUpScreen
          onNavigate={() => setIsLoginView(true)}
          setIsSigningUp={setIsSigningUp}
        />
      )}
    </SafeAreaProvider>
  );
}
