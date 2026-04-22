import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { DASHBOARD_HERO } from "../../lib/images";
import { colors, spacing, typography } from "../../lib/theme";
import type { DashboardSummary } from "../../lib/types";

const menuCards = [
  { label: "Kasir", route: "/cashier" as const, icon: "cash" as const },
  { label: "Bon & Transaksi", route: "/transactions" as const, icon: "receipt" as const },
  { label: "Daftar Barang", route: "/inventory" as const, icon: "cube" as const },
  { label: "Detail Bengkel", route: "/workshop" as const, icon: "business" as const },
  { label: "Detail Pengguna", route: "/users" as const, icon: "people" as const },
];

export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.getDashboardSummary(session.token);
      setSummary(response);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  return (
    <ScreenShell
      title={`Halo, ${session?.user.full_name ?? "Tim Bengkel"}`}
      subtitle="Pantau aktivitas harian bengkel dengan tampilan cepat dan rapi."
      headerAction={<ActionButton label="Keluar" compact onPress={() => void signOut()} variant="secondary" testID="logout-button" />}
    >
      <Image source={{ uri: DASHBOARD_HERO }} style={styles.hero} />

      {loading ? (
        <SurfaceCard>
          <ActivityIndicator color={colors.primary} />
        </SurfaceCard>
      ) : null}

      <View style={styles.statsGrid}>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statLabel}>Barang tersimpan</Text>
          <Text style={styles.statValue}>{summary?.total_inventory_items ?? 0}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statLabel}>Stok menipis</Text>
          <Text style={[styles.statValue, { color: colors.danger }]}>{summary?.low_stock_count ?? 0}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statLabel}>Total transaksi</Text>
          <Text style={styles.statValue}>{summary?.total_transactions ?? 0}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statLabel}>Omzet hari ini</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={[styles.statValue, styles.moneyValue, { color: colors.success }]}
          >
            {formatCurrency(summary?.today_revenue ?? 0)}
          </Text>
        </SurfaceCard>
      </View>

      <View style={styles.menuGrid}>
        {menuCards.map((card) => (
          <Pressable
            key={card.label}
            onPress={() => router.push(card.route as Href)}
            style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]}
            testID={`menu-card-${card.route.replace("/", "")}`}
          >
            <Ionicons name={card.icon} size={26} color={colors.text} />
            <Text style={styles.menuTitle}>{card.label}</Text>
          </Pressable>
        ))}
      </View>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Stok perlu perhatian</Text>
        {(summary?.low_stock_items ?? []).length === 0 ? (
          <Text style={styles.emptyText}>Belum ada barang yang berada di bawah batas minimum.</Text>
        ) : (
          summary?.low_stock_items.map((item) => (
            <View key={item.id} style={styles.rowBetween}>
              <View style={styles.flexOne}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.category}</Text>
              </View>
              <Text style={styles.lowStockText}>{item.stock} pcs</Text>
            </View>
          ))
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Transaksi terbaru</Text>
        {(summary?.recent_transactions ?? []).length === 0 ? (
          <Text style={styles.emptyText}>Belum ada transaksi. Mulai dari menu kasir.</Text>
        ) : (
          summary?.recent_transactions.map((transaction) => (
            <View key={transaction.id} style={styles.rowBetween}>
              <View style={styles.flexOne}>
                <Text style={styles.rowTitle}>{transaction.invoice_number}</Text>
                <Text style={styles.rowMeta}>{transaction.customer_name || "Pelanggan umum"}</Text>
              </View>
              <Text style={styles.revenueText}>{formatCurrency(transaction.total)}</Text>
            </View>
          ))
        )}
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: "100%",
    height: 160,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statCard: {
    width: "47%",
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statValue: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 28,
  },
  moneyValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  menuCard: {
    width: "47%",
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  menuCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  menuTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
    lineHeight: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
  rowMeta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
  lowStockText: {
    color: colors.danger,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  revenueText: {
    color: colors.success,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
});