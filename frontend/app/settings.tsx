import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../lib/theme";

export default function SettingsScreen() {
  const { signOut } = useAuth();

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
        <Text style={styles.title} testID="settings-preferences-title">
          Preferensi Aplikasi
        </Text>
        <Text style={styles.body} testID="settings-preferences-body">
          Halaman transaksi, kasir, inventori, dan menu lain dapat terus dikembangkan sesuai alur kerja bengkel Anda.
        </Text>
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
});