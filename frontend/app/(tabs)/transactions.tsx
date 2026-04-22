import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { DeleteConfirmationCard } from "../../components/DeleteConfirmationCard";
import { FormField } from "../../components/FormField";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { isManagerRole } from "../../lib/role";
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
  const isAdmin = isManagerRole(session?.user.role);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

  const searchedTransactions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return transactions;
    }

    return transactions.filter((transaction) => {
      const haystack = [
        transaction.customer_name,
        transaction.invoice_number,
        transaction.mechanic_name,
        transaction.notes,
        transaction.payment_state,
        transaction.lines.map((line) => line.name).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [searchQuery, transactions]);

  const customerGroups = useMemo(() => {
    const grouped = new Map<string, {
      key: string;
      count: number;
      totalSpent: number;
      totalDebt: number;
      latestPaymentState: string;
      transactions: TransactionRecord[];
    }>();

    searchedTransactions.forEach((transaction) => {
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
  }, [searchedTransactions]);

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
    <ScreenShell title="" subtitle="" hideHeader>
      <View style={styles.toolbarRow}>
        <TextInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Cari pelanggan, invoice, mekanik, item, atau catatan"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          testID="transactions-search-input"
        />
        <Pressable
          onPress={() => {
            setSearchQuery(searchDraft);
            setSelectedCustomerKey(null);
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          testID="transactions-search-button"
        >
          <Ionicons name="search" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setFilterModalVisible(true)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          testID="transactions-filter-button"
        >
          <Ionicons name="options-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            setSelectedCustomerKey(null);
            void loadTransactions();
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          testID="transactions-refresh-button"
        >
          <Ionicons name="refresh" size={20} color={colors.text} />
        </Pressable>
      </View>

      <Modal animationType="slide" transparent visible={filterModalVisible} onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
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
              <ActionButton
                label="Terapkan"
                onPress={() => {
                  setSelectedCustomerKey(null);
                  setFilterModalVisible(false);
                  void loadTransactions();
                }}
                testID="transactions-apply-filter-button"
              />
              <ActionButton
                label="Reset"
                onPress={() => {
                  setFilters(defaultFilters);
                  setSelectedCustomerKey(null);
                  setFilterModalVisible(false);
                  void loadTransactions(defaultFilters);
                }}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

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

      {searchedTransactions.length === 0 ? (
        <SurfaceCard>
          <Text style={styles.emptyText}>Belum ada transaksi yang cocok dengan pencarian atau filter Anda.</Text>
        </SurfaceCard>
      ) : (
        customerGroups.map((group) => {
          const isExpanded = selectedCustomerKey === group.key;
          return (
            <SurfaceCard key={group.key}>
              <Pressable
                onPress={() => setSelectedCustomerKey((current) => (current === group.key ? null : group.key))}
                style={({ pressed }) => [styles.customerCard, isExpanded && styles.customerCardActive, pressed && styles.customerCardPressed]}
                testID={`customer-summary-${group.key.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.flexOne}>
                    <Text style={styles.customerName}>{group.key}</Text>
                    <Text style={styles.meta}>{group.count} transaksi • {formatCurrency(group.totalSpent)}</Text>
                    <Text style={styles.meta}>Total hutang: {formatCurrency(group.totalDebt)}</Text>
                    <Text style={styles.meta}>Status terakhir: {group.latestPaymentState}</Text>
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.text} />
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.customerDetailPanel}>
                  <Text style={styles.meta}>Akumulasi belanja: {formatCurrency(group.totalSpent)}</Text>
                  <Text style={styles.meta}>Sisa hutang aktif: {formatCurrency(group.totalDebt)}</Text>
                  {group.transactions.map((transaction) => (
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
                </View>
              ) : null}
            </SurfaceCard>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPressed: {
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
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
  customerDetailPanel: {
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