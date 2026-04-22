import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { FormField } from "../components/FormField";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { isManagerRole, roleLabels } from "../lib/role";
import { colors, spacing, typography } from "../lib/theme";
import type { WorkshopProfile } from "../lib/types";

const emptyWorkshop = {
  workshop_name: "",
  owner_name: "",
  phone: "",
  address: "",
  open_hours: "",
  notes: "",
};

export default function WorkshopScreen() {
  const { session, switchWorkshop, refreshProfile } = useAuth();
  const [data, setData] = useState<WorkshopProfile | null>(null);
  const [form, setForm] = useState(emptyWorkshop);
  const [newWorkshopName, setNewWorkshopName] = useState("");
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const isManager = isManagerRole(session?.user.role);
  const isOwner = session?.user.role === "owner";

  const loadWorkshop = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.getWorkshop(session.token);
      setData(response);
      setForm({
        workshop_name: response.workshop_name,
        owner_name: response.owner_name,
        phone: response.phone,
        address: response.address,
        open_hours: response.open_hours,
        notes: response.notes,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat bengkel");
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkshop();
    }, [loadWorkshop]),
  );

  const updateField = (field: keyof typeof emptyWorkshop, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveWorkshop = async () => {
    if (!session?.token) {
      return;
    }
    try {
      setError("");
      const response = await api.updateWorkshop(session.token, form);
      setData(response);
      setInfo("Detail bengkel berhasil diperbarui.");
      await refreshProfile();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan detail bengkel");
    }
  };

  const changeWorkshop = async (workshopId: string) => {
    try {
      setInfo("");
      setError("");
      await switchWorkshop(workshopId);
      await loadWorkshop();
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Gagal mengganti bengkel aktif");
    }
  };

  const createWorkshop = async () => {
    if (!session?.token || !newWorkshopName.trim()) {
      return;
    }

    try {
      setError("");
      const response = await api.createWorkshop(session.token, {
        workshop_name: newWorkshopName,
        owner_name: session.user.full_name,
        phone: "",
        address: "",
        open_hours: "",
        notes: "",
      });
      setNewWorkshopName("");
      await switchWorkshop(response.user.workshop_id);
      await loadWorkshop();
      setInfo("Bengkel baru berhasil dibuat dan langsung diaktifkan.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Gagal membuat bengkel baru");
    }
  };

  const handleMemberAction = async (
    membershipId: string,
    action: "approve" | "remove" | "set-role",
    role?: "admin" | "kasir" | "mekanik",
  ) => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      await api.updateWorkshopMember(session.token, membershipId, { action, role });
      await loadWorkshop();
      setInfo(action === "approve" ? "Permintaan karyawan disetujui." : "Akses anggota diperbarui.");
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "Gagal memperbarui akses anggota");
    }
  };

  return (
    <ScreenShell title="Detail Bengkel" subtitle="Kelola profil bengkel, ID unik, cabang aktif, dan persetujuan karyawan." backButton>
      <SurfaceCard>
        <Text style={styles.sectionTitle}>Ringkasan bengkel aktif</Text>
        <Text style={styles.bigTitle} testID="workshop-current-name">{session?.user.workshop_name}</Text>
        <Text style={styles.helperText} testID="workshop-current-meta">{session?.user.full_name} • {roleLabels[session?.user.role ?? "kasir"]}</Text>
        <View style={styles.inlineCard} testID="workshop-code-box">
          <Text style={styles.inlineLabel}>ID Bengkel</Text>
          <Text style={styles.inlineValue}>{session?.user.workshop_code}</Text>
        </View>
        {info ? <Text style={styles.info} testID="workshop-info-message">{info}</Text> : null}
        {error ? <Text style={styles.error} testID="workshop-error-message">{error}</Text> : null}
      </SurfaceCard>

      {loading ? (
        <SurfaceCard>
          <ActivityIndicator color={colors.primary} testID="workshop-loading-indicator" />
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Akses bengkel Anda</Text>
        {(data?.workshops ?? []).map((workshop) => (
          <View key={workshop.workshop_id} style={styles.listRow}>
            <View style={styles.flexOne}>
              <Text style={styles.rowTitle}>{workshop.workshop_name}</Text>
              <Text style={styles.helperText}>{workshop.workshop_code} • {roleLabels[workshop.role]}</Text>
            </View>
            <ActionButton
              label={workshop.workshop_id === session?.user.workshop_id ? "Aktif" : "Pilih"}
              compact
              onPress={() => void changeWorkshop(workshop.workshop_id)}
              variant={workshop.workshop_id === session?.user.workshop_id ? "primary" : "secondary"}
              disabled={workshop.workshop_id === session?.user.workshop_id}
              testID={`workshop-switch-${workshop.workshop_id}`}
            />
          </View>
        ))}
      </SurfaceCard>

      {isOwner ? (
        <SurfaceCard>
          <Text style={styles.sectionTitle}>Tambah bengkel baru</Text>
          <FormField label="Nama bengkel baru" value={newWorkshopName} onChangeText={setNewWorkshopName} testID="workshop-create-name-input" />
          <ActionButton label="Buat Bengkel" onPress={() => void createWorkshop()} testID="workshop-create-button" />
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Profil bengkel</Text>
        <FormField label="Nama bengkel" value={form.workshop_name} onChangeText={(value) => updateField("workshop_name", value)} testID="workshop-name-input" />
        <FormField label="Nama pemilik" value={form.owner_name} onChangeText={(value) => updateField("owner_name", value)} testID="workshop-owner-input" />
        <FormField label="Nomor telepon" value={form.phone} onChangeText={(value) => updateField("phone", value)} keyboardType="phone-pad" testID="workshop-phone-input" />
        <FormField label="Alamat" value={form.address} onChangeText={(value) => updateField("address", value)} multiline testID="workshop-address-input" />
        <FormField label="Jam operasional" value={form.open_hours} onChangeText={(value) => updateField("open_hours", value)} testID="workshop-hours-input" />
        <FormField label="Catatan bengkel" value={form.notes} onChangeText={(value) => updateField("notes", value)} multiline testID="workshop-notes-input" />
        {isManager ? (
          <ActionButton label="Simpan detail bengkel" onPress={() => void saveWorkshop()} testID="workshop-save-button" />
        ) : (
          <Text style={styles.helperText}>Hanya owner atau admin yang dapat mengubah detail bengkel.</Text>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Permintaan akses karyawan</Text>
        {(data?.pending_members ?? []).length === 0 ? (
          <Text style={styles.helperText}>Belum ada permintaan akses baru.</Text>
        ) : (
          data?.pending_members.map((member) => (
            <View key={member.membership_id} style={styles.memberCard}>
              <Text style={styles.rowTitle}>{member.full_name}</Text>
              <Text style={styles.helperText}>@{member.username} • {roleLabels[member.role]}</Text>
              {isManager ? (
                <View style={styles.actionRow}>
                  <ActionButton label="Setujui" compact onPress={() => void handleMemberAction(member.membership_id, "approve")} testID={`workshop-approve-${member.membership_id}`} />
                  <ActionButton label="Hapus" compact onPress={() => void handleMemberAction(member.membership_id, "remove")} variant="secondary" testID={`workshop-remove-pending-${member.membership_id}`} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  bigTitle: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 26,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    padding: spacing.md,
    gap: 4,
  },
  inlineLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  inlineValue: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  info: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  listRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  flexOne: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  memberCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
});