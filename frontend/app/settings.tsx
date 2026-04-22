import { StyleSheet, Text } from "react-native";

import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { colors, typography } from "../lib/theme";

export default function SettingsScreen() {
  return (
    <ScreenShell title="Pengaturan" subtitle="Pengaturan aplikasi, keamanan operasional, dan preferensi penggunaan." backButton>
      <SurfaceCard>
        <Text style={styles.title}>Keamanan Operasional</Text>
        <Text style={styles.body}>Role admin mengelola hapus data dan backup. Role kasir fokus pada transaksi, sedangkan mekanik lebih cocok untuk akses operasional dasar.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title}>Preferensi Aplikasi</Text>
        <Text style={styles.body}>Halaman transaksi, kasir, inventori, dan menu lain dapat terus dikembangkan sesuai alur kerja bengkel Anda.</Text>
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
});