import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { DeleteConfirmationCard } from "../components/DeleteConfirmationCard";
import { FormField } from "../components/FormField";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { colors, spacing, typography } from "../lib/theme";
import type { Role, User } from "../lib/types";

const roles: Role[] = ["admin", "kasir", "mekanik"];

export default function UsersScreen() {
  const { session, refreshProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    username: "",
    full_name: "",
    password: "",
    email: "",
    role: "kasir" as Role,
  });

  const isAdmin = session?.user.role === "admin";

  const loadUsers = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    const response = await api.getUsers(session.token);
    setUsers(response);
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers]),
  );

  const updateRole = async (userId: string, role: Role) => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      await api.updateUserRole(session.token, userId, role);
      await loadUsers();
      await refreshProfile();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Gagal mengubah role");
    }
  };

  const createUser = async () => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      if (selectedUserId) {
        await api.updateUser(session.token, selectedUserId, {
          username: form.username,
          full_name: form.full_name,
          email: form.email || undefined,
          role: form.role,
          password: form.password || undefined,
        });
      } else {
        await api.createUser(session.token, {
          username: form.username,
          full_name: form.full_name,
          password: form.password,
          email: form.email || undefined,
          role: form.role,
        });
      }
      setSelectedUserId(null);
      setForm({ username: "", full_name: "", password: "", email: "", role: "kasir" });
      await loadUsers();
      await refreshProfile();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Gagal menambah pengguna");
    }
  };

  const startEditUser = (user: User) => {
    setSelectedUserId(user.id);
    setForm({
      username: user.username,
      full_name: user.full_name,
      password: "",
      email: user.email ?? "",
      role: user.role,
    });
    setError("");
  };

  const resetForm = () => {
    setSelectedUserId(null);
    setForm({ username: "", full_name: "", password: "", email: "", role: "kasir" });
    setError("");
  };

  const deleteUser = async () => {
    if (!session?.token || !selectedUserId) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.deleteUser(session.token, selectedUserId);
      resetForm();
      await loadUsers();
      await refreshProfile();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus pengguna");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenShell title="Detail Pengguna" subtitle="Kelola akun admin, kasir, dan mekanik dengan role yang tepat." backButton>
      <SurfaceCard>
        <Text style={styles.sectionTitle}>Ringkasan akses</Text>
        <Text style={styles.helperText}>Akun Anda: {session?.user.full_name} • role {session?.user.role}</Text>
        {!isAdmin ? <Text style={styles.helperText}>Hanya admin yang bisa menambah user dan mengganti role.</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </SurfaceCard>

      {isAdmin ? (
        <SurfaceCard>
          <Text style={styles.sectionTitle}>{selectedUserId ? "Edit pengguna" : "Tambah pengguna baru"}</Text>
          <FormField label="Username" value={form.username} onChangeText={(value) => setForm((current) => ({ ...current, username: value }))} autoCapitalize="none" testID="users-create-username-input" />
          <FormField label="Nama lengkap" value={form.full_name} onChangeText={(value) => setForm((current) => ({ ...current, full_name: value }))} testID="users-create-name-input" />
          <FormField label={selectedUserId ? "Password baru (opsional)" : "Password"} value={form.password} onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} secureTextEntry testID="users-create-password-input" />
          <FormField label="Email (opsional)" value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} autoCapitalize="none" testID="users-create-email-input" />
          <View style={styles.roleRow}>
            {roles.map((role) => (
              <ActionButton
                key={role}
                label={role.toUpperCase()}
                compact
                onPress={() => setForm((current) => ({ ...current, role }))}
                variant={form.role === role ? "primary" : "secondary"}
                testID={`users-create-role-${role}`}
              />
            ))}
          </View>
          <View style={styles.roleRow}>
            <ActionButton label={selectedUserId ? "Update pengguna" : "Simpan pengguna"} onPress={() => void createUser()} testID="users-create-submit-button" />
            <ActionButton label="Reset" onPress={resetForm} variant="secondary" />
          </View>
        </SurfaceCard>
      ) : null}

      {isAdmin && selectedUserId ? (
        <DeleteConfirmationCard
          title="Hapus pengguna"
          description="Hanya admin yang boleh menghapus user. Ketik HAPUS untuk konfirmasi."
          onCancel={resetForm}
          onConfirm={deleteUser}
          loading={deleting}
          testIDPrefix="users-delete"
        />
      ) : null}

      {users.map((user) => (
        <SurfaceCard key={user.id}>
          <Text style={styles.userTitle}>{user.full_name}</Text>
          <Text style={styles.helperText}>@{user.username}</Text>
          <Text style={styles.helperText}>{user.email || "Tanpa email"}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user.role.toUpperCase()}</Text>
          </View>
          {isAdmin ? (
            <>
              <View style={styles.roleRow}>
                {roles.map((role) => (
                  <ActionButton
                    key={`${user.id}-${role}`}
                    label={role.toUpperCase()}
                    compact
                    onPress={() => void updateRole(user.id, role)}
                    variant={user.role === role ? "primary" : "secondary"}
                    testID={`users-role-${user.id}-${role}`}
                  />
                ))}
              </View>
              <ActionButton label="Edit pengguna" onPress={() => startEditUser(user)} variant="secondary" testID={`users-edit-${user.id}`} />
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
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
  },
  roleBadgeText: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
  },
});