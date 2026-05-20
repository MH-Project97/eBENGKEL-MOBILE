import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, typography } from "../../lib/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await signIn(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.card}>
          <View style={styles.brandBlock} testID="login-brand-block">
            <View style={styles.logoBadge}>
              <Ionicons name="construct-outline" size={40} color={colors.surface} />
            </View>
            <Text style={styles.title} testID="login-screen-title">Masuk ke Sistem</Text>
            <Text style={styles.subtitle} testID="login-screen-subtitle">
              Kelola bengkel Anda dengan mudah
            </Text>
          </View>
          <FormField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            testID="login-username-input"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="login-password-input"
          />
          {error ? <Text style={styles.error} testID="login-error-text">{error}</Text> : null}
          <ActionButton label={loading ? "Memproses..." : "Masuk  →"} onPress={handleLogin} testID="login-submit-button">
            {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
          </ActionButton>
          <Pressable
            onPress={() => router.push("/register" as Href)}
            style={styles.linkButton}
            testID="go-register-button"
          >
            <Text style={styles.linkText}>Belum punya akun? Daftar di sini</Text>
          </Pressable>
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    justifyContent: "center",
    minHeight: "100%",
  },
  card: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brandBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  title: {
    color: colors.primary,
    fontFamily: typography.heading,
    fontSize: 30,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    textAlign: "center",
  },
  linkButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  linkText: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    textAlign: "center",
  },
});