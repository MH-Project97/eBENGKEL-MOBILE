import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, typography } from "../../lib/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    password: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError("");
      await register({
        username: form.username,
        full_name: form.full_name,
        password: form.password,
        email: form.email || undefined,
      });
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <SurfaceCard style={styles.card}>
        <Text style={styles.title}>Registrasi pengguna baru</Text>
        <Text style={styles.subtitle}>Email opsional. Akun baru otomatis bisa langsung masuk.</Text>
        <FormField
          label="Username"
          value={form.username}
          onChangeText={(value) => updateField("username", value)}
          autoCapitalize="none"
          testID="register-username-input"
        />
        <FormField
          label="Nama Lengkap"
          value={form.full_name}
          onChangeText={(value) => updateField("full_name", value)}
          testID="register-name-input"
        />
        <FormField
          label="Password"
          value={form.password}
          onChangeText={(value) => updateField("password", value)}
          secureTextEntry
          testID="register-password-input"
        />
        <FormField
          label="Email (opsional)"
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="register-email-input"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton
          label={loading ? "Menyimpan..." : "Daftar dan Masuk"}
          onPress={handleRegister}
          testID="register-submit-button"
        >
          {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
        </ActionButton>
        <Link href={"/login" as Href} asChild>
          <Pressable style={styles.linkButton} testID="go-login-button">
            <Text style={styles.linkText}>Sudah punya akun? Kembali ke login</Text>
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
  },
  card: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 28,
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