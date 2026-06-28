import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { hashPassword, getDeterministicAuthPassword } from "./hashUtils";

interface SignUpScreenProps {
  onNavigate: () => void;
  setIsSigningUp?: (val: boolean) => void;
}

const SignUpScreen = ({ onNavigate, setIsSigningUp }: SignUpScreenProps) => {
  const [name, setName] = useState("");
  const [signUpMethod, setSignUpMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const APP_NAME = "Palakunnil kudumbam";

  const handleSignUp = async () => {
    if (!name.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (signUpMethod === "email" && !email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    if (signUpMethod === "phone" && !phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (signUpMethod === "phone" && cleanPhone.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number (minimum 10 digits)");
      return;
    }

    setLoading(true);
    if (setIsSigningUp) setIsSigningUp(true);

    try {
      const authEmail = signUpMethod === "email" ? email.trim() : `${cleanPhone}@familyvault.local`;
      const authPassword = signUpMethod === "email" ? password : getDeterministicAuthPassword(cleanPhone);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        authEmail,
        authPassword,
      );
      // Update the user's display name
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      try {
        // Create user document in Firestore
        // Explicitly log the UID we are writing to
        console.log("Writing to Firestore for UID:", userCredential.user.uid);

        const userDocData: any = {
          name: name,
          email: authEmail,
          role: "user",
          createdAt: serverTimestamp(),
          platform: Platform.OS, // Add platform for debugging
        };

        if (signUpMethod === "phone") {
          userDocData.phone = cleanPhone;
          userDocData.loginMethod = "phone";
          userDocData.passwordHash = hashPassword(password);
          userDocData.mustChangePassword = false;
        } else {
          userDocData.loginMethod = "email";
        }

        await setDoc(doc(db, "Users", userCredential.user.uid), userDocData);

        console.log("Firestore document created successfully");

        // NEW: Sign out immediately so they have to log in manually
        await auth.signOut();

        // Allow the App.tsx listener to proceed normally now (user is null anyway)
        if (setIsSigningUp) setIsSigningUp(false);

        Alert.alert(
          "Success",
          "Account created successfully! Please log in with your new credentials.",
          [{ text: "OK", onPress: onNavigate }],
        );
      } catch (firestoreError: any) {
        console.error("Firestore write error:", firestoreError);
        Alert.alert(
          "Database Error",
          "Account created but profile save failed: " + firestoreError.message,
        );

        // CRITICAL: If DB write fails, sign out so they don't enter the app with no profile
        try {
          await auth.signOut();
        } catch (e) {
          console.error("Sign out failed", e);
        }

        if (setIsSigningUp) setIsSigningUp(false);
        return; // Stop execution
      }
      // Auth state listener in App.tsx will handle the rest
    } catch (error: any) {
      console.error("Sign Up error:", error);
      if (setIsSigningUp) setIsSigningUp(false);

      let errorMessage = "Failed to create account. Please try again.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = signUpMethod === "email" 
          ? "This email is already registered." 
          : "This phone number is already registered.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      } else if (error.code === "permission-denied") {
        errorMessage = "Firestore permission denied. Check security rules.";
      }
      Alert.alert("Registration Failed", errorMessage + " " + error.message);
    } finally {
      // Check if mounted before updating state to avoid warnings
      setLoading(false);
      // Ensure flag is reset in case something weird happened (though caught above)
      // if (setIsSigningUp) setIsSigningUp(false); // Done in try/catch blocks to avoid premature reset
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join your Palakunnil kudumbam</Text>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, signUpMethod === "email" && styles.activeTab]}
              onPress={() => setSignUpMethod("email")}
            >
              <Text style={[styles.tabText, signUpMethod === "email" && styles.activeTabText]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, signUpMethod === "phone" && styles.activeTab]}
              onPress={() => setSignUpMethod("phone")}
            >
              <Text style={[styles.tabText, signUpMethod === "phone" && styles.activeTabText]}>Phone</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {signUpMethod === "email" ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleSignUp}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating Account..." : "Sign Up"}
            </Text>
          </TouchableOpacity>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onNavigate}>
              <Text style={styles.linkText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignUpScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#2563eb",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
  },
  eyeText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: "#6b7280",
  },
  linkText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
  },
});
