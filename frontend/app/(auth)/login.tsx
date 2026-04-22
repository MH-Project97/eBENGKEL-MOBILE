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
  const [username, setUsername] = useState("ownerdemo");
  const [password, setPassword] = useState("owner123");
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
          <View style={styles.brandRow} testID="login-brand-block">
            <View style={styles.logoBadge}>
              <Ionicons name="construct-outline" size={28} color={colors.surface} />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.kicker}>Multi bengkel</Text>
              <Text style={styles.title}>Masuk ke sistem bengkel</Text>
              <Text style={styles.subtitle}>Pantau cabang, stok, transaksi, dan tim dari satu alur kerja yang rapi.</Text>
            </View>
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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton label={loading ? "Memproses..." : "Masuk"} onPress={handleLogin} testID="login-submit-button">
            {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
          </ActionButton>
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Akun demo cepat</Text>
            <Text style={styles.demoText}>ownerdemo / owner123</Text>
            <Text style={styles.demoText}>staffdemo / staff123</Text>
            <Text style={styles.demoText}>staffdemo aktif setelah disetujui owner/admin</Text>
          </View>
          <Pressable
            onPress={() => router.push("/register" as Href)}
            style={styles.linkButton}
            testID="go-register-button"
          >
            <Text style={styles.linkText}>Belum punya akun? Daftar sekarang</Text>
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
    padding: spacing.lg,
    gap: spacing.lg,
    justifyContent: "center",
    minHeight: "100%",
  },
  card: {
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextWrap: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: colors.accent,
    fontFamily: typography.bodyBold,
    fontSize: 12,
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
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
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
    paddingVertical: spacing.xs,
  },
  linkText: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});