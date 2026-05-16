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
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Ionicons name="construct-outline" size={40} color={colors.surface} />
            </View>
            <Text style={styles.title} testID="register-screen-title">
              {form.account_type === "owner" ? "Daftar Bengkel Baru" : "Daftar Karyawan Baru"}
            </Text>
            <Text style={styles.subtitle} testID="register-screen-subtitle">
              {form.account_type === "owner"
                ? "Mulai digitalisasi bengkel Anda"
                : "Gabung ke bengkel dengan ID bengkel yang diberikan pemilik"}
            </Text>
          </View>

          <View style={styles.accountTypeCard}>
            <Text style={styles.accountTypeLabel} testID="register-account-type-label">Pilih jenis akun</Text>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => updateField("account_type", "owner")}
                style={({ pressed }) => [
                  styles.segmentButton,
                  form.account_type === "owner" && styles.segmentButtonActive,
                  pressed && styles.segmentPressed,
                ]}
                testID="register-type-owner"
              >
                <Text style={[styles.segmentText, form.account_type === "owner" && styles.segmentTextActive]}>
                  Pemilik Bengkel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => updateField("account_type", "employee")}
                style={({ pressed }) => [
                  styles.segmentButton,
                  form.account_type === "employee" && styles.segmentButtonActive,
                  pressed && styles.segmentPressed,
                ]}
                testID="register-type-employee"
              >
                <Text style={[styles.segmentText, form.account_type === "employee" && styles.segmentTextActive]}>
                  Karyawan
                </Text>
              </Pressable>
            </View>
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
            label="Email"
            value={form.email}
            onChangeText={(value) => updateField("email", value)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Boleh dikosongkan"
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
                label="ID Bengkel"
                value={form.workshop_code}
                onChangeText={(value) => updateField("workshop_code", value.toUpperCase())}
                autoCapitalize="characters"
                placeholder="Masukkan ID bengkel"
                testID="register-workshop-code-input"
              />
              <Text style={styles.helperText} testID="register-employee-helper-text">
                Role karyawan akan diatur pemilik bengkel setelah pendaftaran.
              </Text>
            </>
          )}
          {error ? <Text style={styles.error} testID="register-error-text">{error}</Text> : null}
          {info ? <Text style={styles.info} testID="register-info-message">{info}</Text> : null}
          <ActionButton
            label={loading ? "Menyimpan..." : "Daftar  →"}
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
            <Text style={styles.linkText}>Sudah punya akun? Masuk di sini</Text>
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
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  brandBlock: {
    alignItems: "center",
    gap: spacing.md,
  },
  logoBadge: {
    width: 116,
    height: 116,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  accountTypeCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountTypeLabel: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentPressed: {
    opacity: 0.88,
  },
  segmentText: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.surface,
  },
  title: {
    color: colors.primary,
    fontFamily: typography.heading,
    fontSize: 32,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    textAlign: "center",
  },
  info: {
    color: colors.success,
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