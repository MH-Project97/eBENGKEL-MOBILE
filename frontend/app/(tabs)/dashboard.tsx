import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { roleLabels } from "../../lib/role";
import { colors, spacing, typography } from "../../lib/theme";
import type { DashboardSummary } from "../../lib/types";

export default function DashboardScreen() {
  const { session } = useAuth();
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
      title={session?.user.workshop_name ?? "Bengkel Anda"}
      subtitle={`${session?.user.full_name ?? "Pengguna"} • ${roleLabels[session?.user.role ?? "kasir"]}`}
    >
      {loading ? (
        <SurfaceCard>
          <ActivityIndicator color={colors.primary} />
        </SurfaceCard>
      ) : null}

      <View style={styles.statsGrid}>
        <SurfaceCard style={styles.statCard}>
          <Text style={styles.statLabel}>Ringkasan transaksi</Text>
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

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Status stok berkurang</Text>
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