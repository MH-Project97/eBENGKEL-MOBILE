import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { colors, spacing, typography } from "../../lib/theme";
import type { TransactionRecord } from "../../lib/types";

export default function TransactionsScreen() {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.getTransactions(session.token);
      setTransactions(response);
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadTransactions();
    }, [loadTransactions]),
  );

  return (
    <ScreenShell
      title="Bon & Transaksi"
      subtitle="Lihat invoice, mekanik, status, dan total transaksi terbaru."
      headerAction={<ActionButton label="Muat ulang" compact onPress={() => void loadTransactions()} variant="secondary" />}
    >
      {loading ? (
        <SurfaceCard>
          <ActivityIndicator color={colors.primary} />
        </SurfaceCard>
      ) : null}

      {transactions.length === 0 ? (
        <SurfaceCard>
          <Text style={styles.emptyText}>Belum ada transaksi tersimpan.</Text>
        </SurfaceCard>
      ) : (
        transactions.map((transaction) => (
          <SurfaceCard key={transaction.id}>
            <View style={styles.rowBetween}>
              <View style={styles.flexOne}>
                <Text style={styles.invoice}>{transaction.invoice_number}</Text>
                <Text style={styles.meta}>{transaction.customer_name || "Pelanggan umum"}</Text>
              </View>
              <Text style={[styles.status, transaction.status === "paid" ? styles.paid : styles.unpaid]}>
                {transaction.status === "paid" ? "LUNAS" : "BELUM LUNAS"}
              </Text>
            </View>
            <Text style={styles.total}>{formatCurrency(transaction.total)}</Text>
            <Text style={styles.meta}>Mekanik: {transaction.mechanic_name || "-"}</Text>
            <Text style={styles.meta}>Metode bayar: {transaction.payment_method.toUpperCase()}</Text>
            <Text style={styles.meta}>Jumlah item/jasa: {transaction.lines.length}</Text>
            {transaction.notes ? <Text style={styles.notes}>Catatan: {transaction.notes}</Text> : null}
          </SurfaceCard>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  flexOne: {
    flex: 1,
    gap: 4,
  },
  invoice: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  total: {
    color: colors.success,
    fontFamily: typography.heading,
    fontSize: 28,
  },
  status: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontFamily: typography.bodyBold,
    fontSize: 12,
  },
  paid: {
    color: colors.success,
    borderColor: colors.success,
  },
  unpaid: {
    color: colors.danger,
    borderColor: colors.danger,
  },
  notes: {
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
});