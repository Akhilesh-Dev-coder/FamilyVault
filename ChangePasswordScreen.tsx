// ChangePasswordScreen.tsx
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
  ActivityIndicator,
} from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { hashPassword } from "./hashUtils";

interface ChangePasswordScreenProps {
  onPasswordChanged: () => void;
  isDarkMode?: boolean;
}

const ChangePasswordScreen = ({ onPasswordChanged, isDarkMode = false }: ChangePasswordScreenProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No user is currently signed in");
      }

      // Update the user's password hash in Firestore
      const userRef = doc(db, "Users", currentUser.uid);
      await updateDoc(userRef, {
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
      });

      const successMsg = "Your password has been updated successfully.";
      if (Platform.OS === "web") {
        window.alert(successMsg);
      } else {
        Alert.alert("Success", successMsg);
      }
      
      onPasswordChanged();
    } catch (error: any) {
      console.error("Error updating password:", error);
      const errMsg = error.message || "Failed to update password. Please try again.";
      if (Platform.OS === "web") {
        window.alert("Error: " + errMsg);
      } else {
        Alert.alert("Error", errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  const themeContainerStyle = isDarkMode ? styles.containerDark : styles.containerLight;
  const themeCardStyle = isDarkMode ? styles.cardDark : styles.cardLight;
  const themeTextStyle = isDarkMode ? styles.textDark : styles.textLight;

  return (
    <KeyboardAvoidingView
      style={[styles.container, themeContainerStyle]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.card, themeCardStyle]}>
        <Text style={[styles.title, themeTextStyle]}>Update Password</Text>
        <Text style={styles.subtitle}>
          Your administrator has reset your password. Please choose a new secure password to secure your account.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.showPasswordButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={styles.showPasswordText}>
            {showPassword ? "Hide Passwords" : "Show Passwords"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>Save & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChangePasswordScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  containerLight: {
    backgroundColor: "#f3f4f6",
  },
  containerDark: {
    backgroundColor: "#111827",
  },
  card: {
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardLight: {
    backgroundColor: "white",
  },
  cardDark: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  textLight: {
    color: "#111827",
  },
  textDark: {
    color: "#f9fafb",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
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
    color: "#000",
  },
  showPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  showPasswordText: {
    color: "#2563eb",
    fontSize: 14,
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
  logoutButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  logoutButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
});
