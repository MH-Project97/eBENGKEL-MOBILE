import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { colors, spacing, typography } from "../lib/theme";

export default function AboutScreen() {
  const router = useRouter();

  return (
    <ScreenShell title="Tentang" subtitle="Informasi singkat aplikasi manajemen bengkel Anda." backButton>
      <SurfaceCard>
        <Text style={styles.title} testID="about-app-title">Aplikasi Manajemen Bengkel</Text>
        <Text style={styles.body} testID="about-app-body">
          Aplikasi ini dirancang untuk membantu operasional bengkel harian: kasir, transaksi, stok barang, manajemen pengguna, profil bengkel, dan backup data.
        </Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title} testID="about-features-title">Yang Bisa Dilakukan</Text>
        <View style={styles.listWrap} testID="about-features-list">
          <Text style={styles.body}>• Buat transaksi barang dan jasa dari tab Kasir.</Text>
          <Text style={styles.body}>• Pantau stok dan harga barang dari tab Barang.</Text>
          <Text style={styles.body}>• Kelola anggota bengkel, approval, dan role dari Detail Bengkel.</Text>
          <Text style={styles.body}>• Lihat riwayat pelanggan dan backup data saat dibutuhkan.</Text>
        </View>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title} testID="about-workflow-title">Alur Kerja Cepat</Text>
        <View style={styles.listWrap} testID="about-workflow-list">
          <Text style={styles.body}>1. Login lalu pastikan bengkel aktif sudah benar.</Text>
          <Text style={styles.body}>2. Gunakan Kasir untuk transaksi baru dan cek status pembayaran.</Text>
          <Text style={styles.body}>3. Gunakan Transaksi untuk riwayat dan pengecekan pelanggan.</Text>
          <Text style={styles.body}>4. Gunakan Barang untuk update stok dan harga.</Text>
        </View>
        <ActionButton
          label="Buka Detail Bengkel"
          onPress={() => router.push("/workshop" as Href)}
          variant="secondary"
          testID="about-go-workshop-button"
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
  listWrap: {
    gap: spacing.sm,
  },
});