import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
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

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    account_type: "owner" as "owner" | "employee",
    username: "",
    full_name: "",
    password: "",
    email: "",
    workshop_name: "",
    workshop_code: "",
    requested_role: "kasir" as "admin" | "kasir" | "mekanik",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError("");
      setInfo("");
      const response = await register({
        account_type: form.account_type,
        username: form.username,
        full_name: form.full_name,
        password: form.password,
        email: form.email || undefined,
        workshop_name: form.account_type === "owner" ? form.workshop_name : undefined,
        workshop_code: form.account_type === "employee" ? form.workshop_code : undefined,
        requested_role: form.account_type === "employee" ? form.requested_role : undefined,
      });
      if (response.requires_approval) {
        setInfo(response.message);
      }
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.card}>
          <Text style={styles.title}>Registrasi pengguna baru</Text>
          <Text style={styles.subtitle}>Pilih daftar sebagai pemilik bengkel atau karyawan yang ingin bergabung lewat ID bengkel.</Text>
          <View style={styles.segmentRow}>
            <ActionButton
              label="Pemilik Bengkel"
              compact
              onPress={() => updateField("account_type", "owner")}
              variant={form.account_type === "owner" ? "primary" : "secondary"}
              testID="register-type-owner"
            />
            <ActionButton
              label="User/Karyawan"
              compact
              onPress={() => updateField("account_type", "employee")}
              variant={form.account_type === "employee" ? "primary" : "secondary"}
              testID="register-type-employee"
            />
          </View>
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
          {form.account_type === "owner" ? (
            <FormField
              label="Nama Bengkel"
              value={form.workshop_name}
              onChangeText={(value) => updateField("workshop_name", value)}
              testID="register-workshop-name-input"
            />
          ) : (
            <>
              <FormField
                label="ID Bengkel (18 karakter)"
                value={form.workshop_code}
                onChangeText={(value) => updateField("workshop_code", value.toUpperCase())}
                autoCapitalize="characters"
                testID="register-workshop-code-input"
              />
              <View style={styles.segmentRow}>
                {(["admin", "kasir", "mekanik"] as const).map((role) => (
                  <ActionButton
                    key={role}
                    label={role.toUpperCase()}
                    compact
                    onPress={() => updateField("requested_role", role)}
                    variant={form.requested_role === role ? "primary" : "secondary"}
                    testID={`register-role-${role}`}
                  />
                ))}
              </View>
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info} testID="register-info-message">{info}</Text> : null}
          <ActionButton
            label={loading ? "Menyimpan..." : form.account_type === "owner" ? "Daftar dan Masuk" : "Kirim Permintaan Gabung"}
            onPress={handleRegister}
            testID="register-submit-button"
          >
            {loading ? <ActivityIndicator color={colors.surface} size="small" /> : null}
          </ActionButton>
          <Pressable
            onPress={() => router.push("/login" as Href)}
            style={styles.linkButton}
            testID="go-login-button"
          >
            <Text style={styles.linkText}>Sudah punya akun? Kembali ke login</Text>
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
    justifyContent: "center",
    minHeight: "100%",
  },
  card: {
    gap: spacing.md,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
  info: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 14,
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