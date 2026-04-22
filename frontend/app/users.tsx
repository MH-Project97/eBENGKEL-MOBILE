import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
});