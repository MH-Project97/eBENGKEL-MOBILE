import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { isManagerRole, roleLabels } from "../lib/role";
import { colors, spacing, typography } from "../lib/theme";
import type { WorkshopMember } from "../lib/types";

const editableRoles = ["admin", "kasir", "mekanik"] as const;

export default function UsersScreen() {
  const { session } = useAuth();
  const [users, setUsers] = useState<WorkshopMember[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [generatedPasswords, setGeneratedPasswords] = useState<Record<string, string>>({});

  const isManager = isManagerRole(session?.user.role);

  const loadUsers = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      const response = await api.getUsers(session.token);
      setUsers(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data pengguna");
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers]),
  );

  const updateRole = async (membershipId: string, role: "admin" | "kasir" | "mekanik") => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      await api.updateUserRole(session.token, membershipId, role);
      setInfo("Role anggota berhasil diperbarui.");
      await loadUsers();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Gagal mengubah role");
    }
  };

  const removeAccess = async (membershipId: string) => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      await api.deleteUser(session.token, membershipId);
      setInfo("Akses anggota berhasil dihapus.");
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus akses anggota");
    }
  };

  const updatePasswordDraft = (membershipId: string, value: string) => {
    setPasswordDrafts((current) => ({ ...current, [membershipId]: value }));
  };

  const saveUserPassword = async (membershipId: string) => {
    if (!session?.token) {
      return;
    }

    const nextPassword = passwordDrafts[membershipId]?.trim();
    if (!nextPassword || nextPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }

    try {
      setError("");
      const response = await api.updateUserPassword(session.token, membershipId, nextPassword);
      setGeneratedPasswords((current) => ({ ...current, [membershipId]: "" }));
      setPasswordDrafts((current) => ({ ...current, [membershipId]: "" }));
      setInfo(`Password untuk @${response.username} berhasil diperbarui.`);
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Gagal mengubah password karyawan");
    }
  };

  const resetUserPassword = async (membershipId: string) => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      const response = await api.updateUserPassword(session.token, membershipId);
      setGeneratedPasswords((current) => ({ ...current, [membershipId]: response.temporary_password ?? "" }));
      setInfo(
        response.temporary_password
          ? `Password sementara @${response.username}: ${response.temporary_password}`
          : `Password @${response.username} berhasil direset.`,
      );
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Gagal reset password karyawan");
    }
  };

  return (
    <ScreenShell title="Detail Pengguna" subtitle="Daftar anggota aktif untuk bengkel yang sedang dipakai. Persetujuan user baru ada di halaman bengkel." backButton>
      <SurfaceCard>
        <Text style={styles.sectionTitle}>Ringkasan akses</Text>
        <Text style={styles.helperText}>Akun Anda: {session?.user.full_name} • {roleLabels[session?.user.role ?? "kasir"]}</Text>
        <Text style={styles.helperText}>Bengkel aktif: {session?.user.workshop_name}</Text>
        {info ? <Text style={styles.infoText} testID="users-info-message">{info}</Text> : null}
        {error ? <Text style={styles.errorText} testID="users-error-message">{error}</Text> : null}
      </SurfaceCard>

      {users.map((user) => (
        <SurfaceCard key={user.membership_id}>
          <Text style={styles.userTitle}>{user.full_name}</Text>
          <Text style={styles.helperText}>@{user.username}</Text>
          <Text style={styles.helperText}>{user.email || "Tanpa email"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabels[user.role]}</Text>
          </View>
          {isManager && user.role !== "owner" && user.user_id !== session?.user.id ? (
            <>
              <View style={styles.roleRow}>
                {editableRoles.map((role) => (
                  <ActionButton
                    key={`${user.membership_id}-${role}`}
                    label={role.toUpperCase()}
                    compact
                    onPress={() => void updateRole(user.membership_id, role)}
                    variant={user.role === role ? "primary" : "secondary"}
                    testID={`users-role-${user.membership_id}-${role}`}
                  />
                ))}
              </View>
              <Text style={styles.inlineLabel} testID={`users-password-label-${user.membership_id}`}>
                Password karyawan
              </Text>
              <TextInput
                value={passwordDrafts[user.membership_id] ?? ""}
                onChangeText={(value) => updatePasswordDraft(user.membership_id, value)}
                placeholder="Password baru minimal 6 karakter"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.passwordInput}
                testID={`users-password-input-${user.membership_id}`}
              />
              <View style={styles.roleRow}>
                <ActionButton
                  label="Simpan Password"
                  compact
                  onPress={() => void saveUserPassword(user.membership_id)}
                  testID={`users-save-password-${user.membership_id}`}
                />
                <ActionButton
                  label="Reset Otomatis"
                  compact
                  onPress={() => void resetUserPassword(user.membership_id)}
                  variant="secondary"
                  testID={`users-reset-password-${user.membership_id}`}
                />
              </View>
              {generatedPasswords[user.membership_id] ? (
                <Text style={styles.tempPasswordText} testID={`users-temp-password-${user.membership_id}`}>
                  Password sementara: {generatedPasswords[user.membership_id]}
                </Text>
              ) : null}
              <ActionButton label="Hapus akses" onPress={() => void removeAccess(user.membership_id)} variant="secondary" testID={`users-remove-${user.membership_id}`} />
            </>
          ) : null}
        </SurfaceCard>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  infoText: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  userTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  roleBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
  },
  roleBadgeText: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  inlineLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    textTransform: "uppercase",
  },
  passwordInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    backgroundColor: colors.surface,
  },
  tempPasswordText: {
    color: colors.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
});