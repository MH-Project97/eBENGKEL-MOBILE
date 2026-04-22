import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { AUTH_HERO } from "../../lib/images";
import { colors, spacing, typography } from "../../lib/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
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
      <Image source={{ uri: AUTH_HERO }} style={styles.hero} />
      <SurfaceCard style={styles.card}>
        <Text style={styles.title}>Masuk ke Bengkel</Text>
        <Text style={styles.subtitle}>Kelola kasir, stok, transaksi, dan tim dari satu aplikasi.</Text>
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton label={loading ? "Memproses..." : "Masuk"} onPress={handleLogin} testID="login-submit-button">
          {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
        </ActionButton>
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Akun demo cepat</Text>
          <Text style={styles.demoText}>admin / admin123</Text>
          <Text style={styles.demoText}>kasir / kasir123</Text>
          <Text style={styles.demoText}>mekanik / mekanik123</Text>
        </View>
        <Link href={"/register" as Href} asChild>
          <Pressable style={styles.linkButton} testID="go-register-button">
            <Text style={styles.linkText}>Belum punya akun? Daftar sekarang</Text>
          </Pressable>
        </Link>
      </SurfaceCard>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.lg,
  },
  hero: {
    width: "100%",
    height: 210,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 30,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  demoBox: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  demoTitle: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  demoText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  linkButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  linkText: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});