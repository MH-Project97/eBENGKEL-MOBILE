import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { DeleteConfirmationCard } from "../../components/DeleteConfirmationCard";
import { FormField } from "../../components/FormField";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { colors, spacing, typography } from "../../lib/theme";
import type { TransactionRecord } from "../../lib/types";

export default function TransactionsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const isAdmin = session?.user.role === "admin";
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "all",
    mechanicName: "",
  });

  const today = new Date();
  const toDateString = (date: Date) => date.toISOString().slice(0, 10);
  const applyQuickRange = (daysBack: number | null) => {
    if (daysBack === null) {
      setFilters((current) => ({ ...current, startDate: "", endDate: "" }));
      return;
    }
    const start = new Date(today);
    start.setDate(today.getDate() - daysBack);
    setFilters((current) => ({
      ...current,
      startDate: toDateString(start),
      endDate: toDateString(today),
    }));
  };

  const loadTransactions = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.getTransactions(session.token, filters);
      setTransactions(response);
    } finally {
      setLoading(false);
    }
  }, [filters, session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadTransactions();
    }, [loadTransactions]),
  );

  const deleteTransaction = async () => {
    if (!session?.token || !deleteTargetId) {
      return;
    }

    try {
      setDeleting(true);
      await api.deleteTransaction(session.token, deleteTargetId);
      setDeleteTargetId(null);
      await loadTransactions();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenShell
      title="Bon & Transaksi"
      subtitle="Lihat invoice, mekanik, status, dan total transaksi terbaru."
      headerAction={<ActionButton label="Muat ulang" compact onPress={() => void loadTransactions()} variant="secondary" />}
    >
      <SurfaceCard>
        <Text style={styles.filterTitle}>Filter transaksi</Text>
        <View style={styles.filterRow}>
          <ActionButton label="Semua" compact onPress={() => applyQuickRange(null)} variant="secondary" />
          <ActionButton label="Hari ini" compact onPress={() => applyQuickRange(0)} variant="secondary" />
          <ActionButton label="7 hari" compact onPress={() => applyQuickRange(6)} variant="secondary" />
          <ActionButton label="30 hari" compact onPress={() => applyQuickRange(29)} variant="secondary" />
        </View>
        <FormField label="Tanggal mulai" value={filters.startDate} onChangeText={(value) => setFilters((current) => ({ ...current, startDate: value }))} placeholder="YYYY-MM-DD" testID="transactions-start-date-input" />
        <FormField label="Tanggal akhir" value={filters.endDate} onChangeText={(value) => setFilters((current) => ({ ...current, endDate: value }))} placeholder="YYYY-MM-DD" testID="transactions-end-date-input" />
        <FormField label="Nama mekanik" value={filters.mechanicName} onChangeText={(value) => setFilters((current) => ({ ...current, mechanicName: value }))} testID="transactions-mechanic-filter-input" />
        <View style={styles.filterRow}>
          <ActionButton label="Semua status" compact onPress={() => setFilters((current) => ({ ...current, status: "all" }))} variant={filters.status === "all" ? "primary" : "secondary"} />
          <ActionButton label="Lunas" compact onPress={() => setFilters((current) => ({ ...current, status: "paid" }))} variant={filters.status === "paid" ? "primary" : "secondary"} />
          <ActionButton label="Belum lunas" compact onPress={() => setFilters((current) => ({ ...current, status: "unpaid" }))} variant={filters.status === "unpaid" ? "primary" : "secondary"} />
        </View>
        <View style={styles.filterRow}>
          <ActionButton label="Terapkan filter" onPress={() => void loadTransactions()} testID="transactions-apply-filter-button" />
          <ActionButton
            label="Reset"
            onPress={() => setFilters({ startDate: "", endDate: "", status: "all", mechanicName: "" })}
            variant="secondary"
          />
        </View>
      </SurfaceCard>

      {loading ? (
        <SurfaceCard>
          <ActivityIndicator color={colors.primary} />
        </SurfaceCard>
      ) : null}

      {deleteTargetId && isAdmin ? (
        <DeleteConfirmationCard
          title="Hapus transaksi"
          description="Hanya admin yang boleh menghapus. Stok barang akan otomatis disesuaikan ulang."
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={deleteTransaction}
          loading={deleting}
          testIDPrefix="transactions-delete"
        />
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
            <View style={styles.filterRow}>
              <ActionButton label="Edit transaksi" onPress={() => router.push((`/cashier?editId=${transaction.id}` as Href))} variant="secondary" testID={`transactions-edit-${transaction.id}`} />
              {isAdmin ? (
                <ActionButton label="Hapus" onPress={() => setDeleteTargetId(transaction.id)} variant="danger" testID={`transactions-delete-${transaction.id}`} />
              ) : null}
            </View>
          </SurfaceCard>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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