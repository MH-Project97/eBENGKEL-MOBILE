import { StyleSheet, Text } from "react-native";

import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { colors, typography } from "../lib/theme";

export default function AboutScreen() {
  return (
    <ScreenShell title="Tentang" subtitle="Informasi singkat aplikasi manajemen bengkel Anda." backButton>
      <SurfaceCard>
        <Text style={styles.title}>Aplikasi Manajemen Bengkel</Text>
        <Text style={styles.body}>Aplikasi ini dirancang untuk membantu operasional bengkel harian: kasir, transaksi, stok barang, manajemen pengguna, profil bengkel, dan backup data.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title}>Arah Pengembangan</Text>
        <Text style={styles.body}>Ke depan menu ini bisa menampilkan versi aplikasi, changelog singkat, bantuan penggunaan, dan informasi fitur baru.</Text>
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