import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../lib/theme";

export default function SettingsScreen() {
  const { refreshProfile, signOut } = useAuth();
  const router = useRouter();

  return (
    <ScreenShell title="Pengaturan" subtitle="Pengaturan aplikasi, keamanan operasional, dan preferensi penggunaan." backButton>
      <SurfaceCard>
        <Text style={styles.title} testID="settings-security-title">
          Keamanan Operasional
        </Text>
        <Text style={styles.body} testID="settings-security-body">
          Role admin mengelola hapus data dan backup. Role kasir fokus pada transaksi, sedangkan mekanik lebih cocok untuk akses operasional dasar.
        </Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title} testID="settings-actions-title">
          Aksi Cepat
        </Text>
        <View style={styles.actionGrid}>
          <ActionButton
            label="Refresh Profil"
            compact
            onPress={() => void refreshProfile()}
            variant="secondary"
            testID="settings-refresh-profile-button"
          />
          <ActionButton
            label="Detail Bengkel"
            compact
            onPress={() => router.push("/workshop" as Href)}
            variant="secondary"
            testID="settings-go-workshop-button"
          />
          <ActionButton
            label="Detail Pengguna"
            compact
            onPress={() => router.push("/users" as Href)}
            variant="secondary"
            testID="settings-go-users-button"
          />
          <ActionButton
            label="Backup Data"
            compact
            onPress={() => router.push("/backup" as Href)}
            variant="secondary"
            testID="settings-go-backup-button"
          />
        </View>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title} testID="settings-tips-title">
          Panduan Singkat
        </Text>
        <View style={styles.tipList} testID="settings-tips-list">
          <Text style={styles.body}>• Gunakan owner/admin untuk approval karyawan dan perubahan role.</Text>
          <Text style={styles.body}>• Cek backup data secara berkala sebelum banyak perubahan stok/transaksi.</Text>
          <Text style={styles.body}>• Buka ulang tab Kasir untuk memulai transaksi baru dari keadaan bersih.</Text>
        </View>
      </SurfaceCard>
      <SurfaceCard>
        <View style={styles.logoutHeader}>
          <Text style={styles.title} testID="settings-system-title">
            Sistem
          </Text>
          <Text style={styles.body} testID="settings-system-body">
            Keluar akun dipindahkan ke halaman Pengaturan agar menu utama tetap ringkas.
          </Text>
        </View>
        <ActionButton
          label="Keluar"
          onPress={() => void signOut()}
          variant="danger"
          testID="settings-logout-button"
        />
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  body: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
  logoutHeader: {
    gap: spacing.sm,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tipList: {
    gap: spacing.sm,
  },
});