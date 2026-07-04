// LoginScreen.tsx
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "./firebaseConfig";
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { hashPassword, getDeterministicAuthPassword } from "./hashUtils";

interface LoginScreenProps {
  onNavigate: () => void;
}

const LoginScreen = ({ onNavigate }: LoginScreenProps) => {
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPhone, setResetPhone] = useState("");

  const APP_NAME = "Palakunnil kudumbam";

  const handleLogin = async () => {
    if (loginMethod === "phone") {
      const cleanPhone = phone.replace(/\D/g, "");
      if (!cleanPhone || !password.trim()) {
        Alert.alert("Error", "Please enter both phone number and password");
        return;
      }

      setLoading(true);
      let tempAuthUser: any = null;
      try {
        // 1. Authenticate to Firebase Auth first using the deterministic password
        const authEmail = `${cleanPhone}@familyvault.local`;
        const authPassword = getDeterministicAuthPassword(cleanPhone);
        const userCredential = await signInWithEmailAndPassword(auth, authEmail, authPassword);
        tempAuthUser = userCredential.user;

        // 2. Now that we are authenticated, we can fetch their document from Firestore
        const userDocRef = doc(db, "Users", tempAuthUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          throw new Error("Profile not found");
        }

        const userData = userDoc.data();
        if (userData.suspended) {
          throw new Error("Your account has been suspended.");
        }
        
        // 3. Verify the entered password against the passwordHash in Firestore
        const enteredHash = hashPassword(password);
        if (userData.passwordHash !== enteredHash) {
          throw new Error("Invalid phone number or password.");
        }

        // Login succeeds! The auth session remains active.
      } catch (error: any) {
        console.error("Phone login error:", error);
        
        // If we authenticated but verification failed, sign out immediately
        try {
          await auth.signOut();
        } catch (signOutErr) {
          console.error("Error signing out after failed verification:", signOutErr);
        }

        let msg = "Invalid phone number or password.";
        if (
          error.code === "auth/user-not-found" || 
          error.code === "auth/invalid-credential" ||
          error.code === "auth/wrong-password"
        ) {
          msg = "Invalid phone number or password.";
        } else if (error.message === "Your account has been suspended.") {
          msg = "Your account has been suspended by an administrator.";
        } else if (error.message === "Profile not found") {
          msg = "User profile not found. Please contact support.";
        } else if (error.code === "auth/too-many-requests") {
          msg = "Too many failed attempts. Please try again later.";
        }

        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Login Failed", msg);
        }
        setPassword("");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // On success, Firebase triggers onAuthStateChanged → shows family tree
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Incorrect email or password. Please try again.";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        errorMessage = "Invalid email or password.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage =
          "Too many failed attempts. Please reset your password or try again later.";
      }

      if (Platform.OS === "web") {
        window.alert(errorMessage);
      } else {
        Alert.alert("Login Failed", errorMessage);
      }
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    console.log("handleForgotPassword triggered with:", resetEmail);
    if (!resetEmail.trim()) {
      Alert.alert(
        "Reset Password",
        "Please enter your email address to reset your password.",
      );
      return;
    }

    setResetLoading(true);
    try {
      console.log("Calling sendPasswordResetEmail...");

      // 10s timeout to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(new Error("Request timed out (10s). Check your network.")),
          10000,
        ),
      );

      await Promise.race([
        sendPasswordResetEmail(auth, resetEmail),
        timeoutPromise,
      ]);

      console.log("sendPasswordResetEmail success");
      if (Platform.OS === "web") {
        window.alert(
          "Email Sent! Check your email for a link to reset your password.",
        );
        setShowForgotModal(false);
      } else {
        Alert.alert(
          "Email Sent",
          "Check your email for a link to reset your password.",
          [{ text: "OK", onPress: () => setShowForgotModal(false) }],
        );
      }
      setResetEmail("");
    } catch (error: any) {
      console.error("Reset password error", error);
      const msg = error.message || "Failed to send reset email.";
      if (Platform.OS === "web") {
        window.alert("Error: " + msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handlePhoneResetRequest = async () => {
    console.log("handlePhoneResetRequest triggered with:", resetPhone);
    const cleanPhone = resetPhone.replace(/\D/g, "");
    if (!cleanPhone.trim() || cleanPhone.length < 10) {
      const errorMsg = "Please enter a valid mobile number (minimum 10 digits).";
      if (Platform.OS === "web") {
        window.alert(errorMsg);
      } else {
        Alert.alert("Reset Password", errorMsg);
      }
      return;
    }

    setResetLoading(true);
    let authenticated = false;
    try {
      // 1. Authenticate to Firebase Auth first using the deterministic password
      console.log("Authenticating to Firebase Auth...");
      const authEmail = `${cleanPhone}@familyvault.local`;
      const authPassword = getDeterministicAuthPassword(cleanPhone);
      const userCredential = await signInWithEmailAndPassword(auth, authEmail, authPassword);
      const tempAuthUser = userCredential.user;
      authenticated = true;

      // 2. Update user's own document in the "Users" collection (now that we are authenticated, permissions will pass)
      console.log("Adding reset request flags to User document...");
      const userDocRef = doc(db, "Users", tempAuthUser.uid);
      await updateDoc(userDocRef, {
        resetRequested: true,
        resetRequestedAt: serverTimestamp(),
      });
      console.log("User reset flags updated successfully");

      const successMsg = "Your request for a temporary password has been sent to the administrator. Please contact your administrator or check back soon.";
      if (Platform.OS === "web") {
        window.alert(successMsg);
        setShowForgotModal(false);
      } else {
        Alert.alert(
          "Request Sent",
          successMsg,
          [{ text: "OK", onPress: () => setShowForgotModal(false) }],
        );
      }
      setResetPhone("");
    } catch (error: any) {
      console.error("Phone reset request error", error);
      let msg = error.message || "Failed to send reset request.";
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        msg = "This phone number is not registered in the system.";
      }
      
      if (Platform.OS === "web") {
        window.alert("Error: " + msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      // Always sign out if we authenticated to avoid keeping the session
      if (authenticated) {
        try {
          await auth.signOut();
        } catch (signOutErr) {
          console.error("Error signing out after reset request:", signOutErr);
        }
      }
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, loginMethod === "email" && styles.activeTab]}
            onPress={() => setLoginMethod("email")}
          >
            <Text style={[styles.tabText, loginMethod === "email" && styles.activeTabText]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, loginMethod === "phone" && styles.activeTab]}
            onPress={() => setLoginMethod("phone")}
          >
            <Text style={[styles.tabText, loginMethod === "phone" && styles.activeTabText]}>Phone</Text>
          </TouchableOpacity>
        </View>

        {loginMethod === "email" ? (
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
              onSubmitEditing={handleLogin}
              autoCapitalize="none"
              autoCorrect={false}
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
          style={styles.forgotButton}
          onPress={() => {
            if (loginMethod === "phone") {
              setResetPhone(phone); // Pre-fill with current phone if typed
              setShowForgotModal(true);
            } else {
              setResetEmail(email); // Pre-fill with current email if typed
              setShowForgotModal(true);
            }
          }}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Logging in..." : "Log In"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={onNavigate}>
            <Text style={styles.linkText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              {loginMethod === "phone"
                ? "Enter your mobile number to request a temporary password from the administrator."
                : "Enter your email to receive a password reset link."}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {loginMethod === "phone" ? "Phone Number" : "Email"}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={
                  loginMethod === "phone"
                    ? "Enter your mobile number"
                    : "Enter your email"
                }
                placeholderTextColor="#9CA3AF"
                value={loginMethod === "phone" ? resetPhone : resetEmail}
                onChangeText={loginMethod === "phone" ? setResetPhone : setResetEmail}
                keyboardType={loginMethod === "phone" ? "phone-pad" : "email-address"}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.button, styles.modalCancelButton]}
                onPress={() => setShowForgotModal(false)}
              >
                <Text style={[styles.buttonText, { color: "#374151" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.modalSendButton,
                  resetLoading && styles.buttonDisabled,
                ]}
                onPress={loginMethod === "phone" ? handlePhoneResetRequest : handleForgotPassword}
                disabled={resetLoading}
              >
                <Text style={styles.buttonText}>
                  {resetLoading
                    ? "Sending..."
                    : loginMethod === "phone"
                    ? "Request Reset"
                    : "Send Link"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
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
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
    elevation: 10,
    zIndex: 10,
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#e5e7eb",
  },
  modalSendButton: {
    flex: 1,
    backgroundColor: "#2563eb",
  },
});
