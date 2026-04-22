import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

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

const defaultFilters = {
  startDate: "",
  endDate: "",
  status: "all",
  mechanicName: "",
};

export default function TransactionsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const isAdmin = session?.user.role === "admin";
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [filters, setFilters] = useState(defaultFilters);

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

  const loadTransactions = useCallback(
    async (overrideFilters = filters) => {
      if (!session?.token) {
        return;
      }

      try {
        setLoading(true);
        const response = await api.getTransactions(session.token, overrideFilters);
        setTransactions(response);
      } finally {
        setLoading(false);
      }
    },
    [filters, session?.token],
  );

  useFocusEffect(
    useCallback(() => {
      void loadTransactions();
    }, [loadTransactions]),
  );

  const customerGroups = useMemo(() => {
    const grouped = new Map<string, {
      key: string;
      count: number;
      totalSpent: number;
      totalDebt: number;
      latestPaymentState: string;
      transactions: TransactionRecord[];
    }>();

    transactions.forEach((transaction) => {
      const key = transaction.customer_name.trim() || "Pelanggan umum";
      const existing = grouped.get(key) ?? {
        key,
        count: 0,
        totalSpent: 0,
        totalDebt: 0,
        latestPaymentState: transaction.payment_state,
        transactions: [],
      };
      existing.count += 1;
      existing.totalSpent += transaction.total;
      existing.totalDebt += transaction.balance_due;
      existing.transactions.push(transaction);
      grouped.set(key, existing);
    });

    return Array.from(grouped.values());
  }, [transactions]);

  const selectedCustomer = customerGroups.find((group) => group.key === selectedCustomerKey) ?? null;

  const deleteTransaction = async () => {
    if (!session?.token || !deleteTargetId) {
      return;
    }

    try {
      setDeleting(true);
      await api.deleteTransaction(session.token, deleteTargetId);
      setDeleteTargetId(null);
      setSelectedCustomerKey(null);
      await loadTransactions();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenShell
      title="Bon & Transaksi"
      subtitle="Lihat ringkasan transaksi per pelanggan, hutang aktif, dan rincian bila pelanggan dipilih."
      headerAction={<ActionButton label="Muat ulang" compact onPress={() => void loadTransactions()} variant="secondary" />}
    >
      <SurfaceCard>
        <Text style={styles.filterTitle}>Filter transaksi</Text>
        <View style={styles.filterRow}>
          <ActionButton label="Semua" compact onPress={() => applyQuickRange(null)} variant="secondary" testID="transactions-range-all" />
          <ActionButton label="Hari ini" compact onPress={() => applyQuickRange(0)} variant="secondary" testID="transactions-range-today" />
          <ActionButton label="7 hari" compact onPress={() => applyQuickRange(6)} variant="secondary" testID="transactions-range-7d" />
          <ActionButton label="30 hari" compact onPress={() => applyQuickRange(29)} variant="secondary" testID="transactions-range-30d" />
        </View>
        <FormField label="Tanggal mulai" value={filters.startDate} onChangeText={(value) => setFilters((current) => ({ ...current, startDate: value }))} placeholder="YYYY-MM-DD" testID="transactions-start-date-input" />
        <FormField label="Tanggal akhir" value={filters.endDate} onChangeText={(value) => setFilters((current) => ({ ...current, endDate: value }))} placeholder="YYYY-MM-DD" testID="transactions-end-date-input" />
        <FormField label="Nama mekanik" value={filters.mechanicName} onChangeText={(value) => setFilters((current) => ({ ...current, mechanicName: value }))} testID="transactions-mechanic-filter-input" />
        <View style={styles.filterRow}>
          <ActionButton label="Semua status" compact onPress={() => setFilters((current) => ({ ...current, status: "all" }))} variant={filters.status === "all" ? "primary" : "secondary"} testID="transactions-status-all" />
          <ActionButton label="Lunas" compact onPress={() => setFilters((current) => ({ ...current, status: "paid" }))} variant={filters.status === "paid" ? "primary" : "secondary"} testID="transactions-status-paid" />
          <ActionButton label="Belum lunas" compact onPress={() => setFilters((current) => ({ ...current, status: "unpaid" }))} variant={filters.status === "unpaid" ? "primary" : "secondary"} testID="transactions-status-unpaid" />
        </View>
        <View style={styles.filterRow}>
          <ActionButton label="Terapkan filter" onPress={() => { setSelectedCustomerKey(null); void loadTransactions(); }} testID="transactions-apply-filter-button" />
          <ActionButton
            label="Reset"
            onPress={() => {
              setFilters(defaultFilters);
              setSelectedCustomerKey(null);
              void loadTransactions(defaultFilters);
            }}
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
        <>
          <SurfaceCard>
            <Text style={styles.filterTitle}>Ringkasan pelanggan</Text>
            {customerGroups.map((group) => (
              <Pressable
                key={group.key}
                onPress={() => setSelectedCustomerKey(group.key)}
                style={({ pressed }) => [styles.customerCard, selectedCustomerKey === group.key && styles.customerCardActive, pressed && styles.customerCardPressed]}
                testID={`customer-summary-${group.key.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <Text style={styles.customerName}>{group.key}</Text>
                <Text style={styles.meta}>{group.count} transaksi • {formatCurrency(group.totalSpent)}</Text>
                <Text style={styles.meta}>Total hutang: {formatCurrency(group.totalDebt)}</Text>
                <Text style={styles.meta}>Status terakhir: {group.latestPaymentState}</Text>
              </Pressable>
            ))}
          </SurfaceCard>

          {selectedCustomer ? (
            <SurfaceCard>
              <Text style={styles.filterTitle}>Rincian pelanggan: {selectedCustomer.key}</Text>
              <Text style={styles.meta}>Total transaksi: {selectedCustomer.count}</Text>
              <Text style={styles.meta}>Akumulasi belanja: {formatCurrency(selectedCustomer.totalSpent)}</Text>
              <Text style={styles.meta}>Sisa hutang aktif: {formatCurrency(selectedCustomer.totalDebt)}</Text>
              {selectedCustomer.transactions.map((transaction) => (
                <View key={transaction.id} style={styles.detailCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.flexOne}>
                      <Text style={styles.invoice}>{transaction.invoice_number}</Text>
                      <Text style={styles.meta}>Mekanik: {transaction.mechanic_name || "-"}</Text>
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
                  <View style={styles.filterRow}>
                    <ActionButton label="Edit transaksi" onPress={() => router.push((`/cashier?editId=${transaction.id}` as Href))} variant="secondary" testID={`transactions-edit-${transaction.id}`} />
                    {isAdmin ? <ActionButton label="Hapus" onPress={() => setDeleteTargetId(transaction.id)} variant="danger" testID={`transactions-delete-${transaction.id}`} /> : null}
                  </View>
                </View>
              ))}
            </SurfaceCard>
          ) : (
            <SurfaceCard>
              <Text style={styles.emptyText}>Pilih ringkasan pelanggan untuk melihat seluruh rincian transaksinya.</Text>
            </SurfaceCard>
          )}
        </>
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
  customerCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: 4,
  },
  customerCardActive: {
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  customerCardPressed: {
    opacity: 0.9,
  },
  customerName: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  detailCard: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  lineList: {
    gap: 4,
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
    lineHeight: 22,
  },
});