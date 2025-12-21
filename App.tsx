// App.tsx (main entry)
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

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

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔑 Load icon fonts (MANDATORY for Expo Web)
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...Feather.font,
    ...FontAwesome.font,
  });

  // 🔐 Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

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
      {!user ? <LoginScreen /> : <FamilyTreeApp />}
    </SafeAreaProvider>
  );
}
