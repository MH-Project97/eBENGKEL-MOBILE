import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { DeleteConfirmationCard } from "../components/DeleteConfirmationCard";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { isManagerRole } from "../lib/role";
import { colors, spacing, typography } from "../lib/theme";
import type { TransactionRecord } from "../lib/types";

export default function CustomerTransactionsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ customer?: string | string[] }>();
  const customerParam = Array.isArray(params.customer) ? params.customer[0] : params.customer;
  const customerName = customerParam || "Pelanggan umum";
  const isManager = isManagerRole(session?.user.role);

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadCustomerTransactions = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.getTransactions(session.token, {
        startDate: "",
        endDate: "",
        status: "all",
        mechanicName: "",
      });
      const filtered = response.filter((transaction) => (transaction.customer_name.trim() || "Pelanggan umum") === customerName);
      setTransactions(filtered);
    } finally {
      setLoading(false);
    }
  }, [customerName, session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadCustomerTransactions();
    }, [loadCustomerTransactions]),
  );

  const summary = useMemo(
    () => ({
      count: transactions.length,
      totalSpent: transactions.reduce((total, transaction) => total + transaction.total, 0),
      totalDebt: transactions.reduce((total, transaction) => total + transaction.balance_due, 0),
    }),
    [transactions],
  );

  const deleteTransaction = async () => {
    if (!session?.token || !deleteTargetId) {
      return;
    }

    try {
      setDeleting(true);
      await api.deleteTransaction(session.token, deleteTargetId);
      setDeleteTargetId(null);
      await loadCustomerTransactions();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenShell title="Riwayat Pelanggan" subtitle="Semua transaksi pelanggan ditampilkan sebagai card agar lebih rapi dan mudah dibaca." backButton>
      <SurfaceCard>
        <Text style={styles.customerName} testID="customer-history-name">{customerName}</Text>
        <Text style={styles.meta} testID="customer-history-summary">{summary.count} transaksi • {formatCurrency(summary.totalSpent)}</Text>
        <Text style={styles.meta} testID="customer-history-debt">Total hutang: {formatCurrency(summary.totalDebt)}</Text>
      </SurfaceCard>

      {loading ? (
        <SurfaceCard>
          <ActivityIndicator color={colors.primary} />
        </SurfaceCard>
      ) : null}

      {deleteTargetId && isManager ? (
        <DeleteConfirmationCard
          title="Hapus transaksi"
          description="Transaksi akan dihapus dari riwayat pelanggan ini dan stok akan disesuaikan kembali."
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={deleteTransaction}
          loading={deleting}
          testIDPrefix="customer-history-delete"
        />
      ) : null}

      {!loading && transactions.length === 0 ? (
        <SurfaceCard>
          <Text style={styles.meta}>Belum ada transaksi untuk pelanggan ini.</Text>
        </SurfaceCard>
      ) : null}

      {transactions.map((transaction) => (
        <SurfaceCard key={transaction.id}>
          <View style={styles.rowBetween}>
            <View style={styles.flexOne}>
              <Text style={styles.invoice}>{transaction.invoice_number}</Text>
              <Text style={styles.meta}>Mekanik: {transaction.mechanic_name || "-"}</Text>
              <Text style={styles.meta}>Tanggal: {transaction.transaction_date.slice(0, 10)}</Text>
            </View>
            <Text style={[styles.status, transaction.balance_due > 0 ? styles.unpaid : styles.paid]}>
              {transaction.balance_due > 0 ? "HUTANG" : transaction.change_due > 0 ? "KEMBALIAN" : "LUNAS"}
            </Text>
          </View>
          <Text style={styles.total}>{formatCurrency(transaction.total)}</Text>
          <Text style={styles.meta}>Dibayar: {formatCurrency(transaction.amount_paid)}</Text>
          <Text style={styles.meta}>Sisa hutang: {formatCurrency(transaction.balance_due)}</Text>
          <Text style={styles.meta}>Kembalian: {formatCurrency(transaction.change_due)}</Text>
          <Text style={styles.meta}>Metode bayar: {transaction.payment_method.toUpperCase()}</Text>
          {transaction.notes ? <Text style={styles.notes}>Catatan: {transaction.notes}</Text> : null}
          <View style={styles.lineList}>
            {transaction.lines.map((line, index) => (
              <Text key={`${transaction.id}-${index}`} style={styles.meta}>
                • {line.name} — {line.quantity} x {formatCurrency(line.unit_price)}
              </Text>
            ))}
          </View>
          <View style={styles.actionRow}>
            <ActionButton label="Edit transaksi" onPress={() => router.push((`/cashier?editId=${transaction.id}` as Href))} variant="secondary" testID={`customer-history-edit-${transaction.id}`} />
            {isManager ? <ActionButton label="Hapus" onPress={() => setDeleteTargetId(transaction.id)} variant="danger" testID={`customer-history-delete-${transaction.id}`} /> : null}
          </View>
        </SurfaceCard>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  customerName: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 24,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
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
  total: {
    color: colors.success,
    fontFamily: typography.heading,
    fontSize: 28,
  },
  notes: {
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  lineList: {
    gap: 4,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});