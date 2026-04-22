import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { DeleteConfirmationCard } from "../../components/DeleteConfirmationCard";
import { FormField } from "../../components/FormField";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { colors, spacing, typography } from "../../lib/theme";
import type { InventoryItem } from "../../lib/types";

const units = ["pcs", "bungkus", "kotak", "set", "liter", "botol", "pasang", "roll"];
const emptyForm = {
  item_code: "",
  name: "",
  stock: "",
  unit: "pcs",
  cost_price: "",
  workshop_price: "",
  consumer_price: "",
  notes: "",
  low_stock_threshold: "5",
};

const columnWidths = {
  code: 120,
  name: 200,
  stock: 120,
  unit: 100,
  cost: 140,
  workshop: 160,
  consumer: 170,
  notes: 220,
  action: 110,
};

const sortButtonMeta = {
  code: { icon: "barcode-outline", label: "Kode" },
  stock: { icon: "layers-outline", label: "Stok" },
  price: { icon: "cash-outline", label: "Harga" },
} as const;

export default function InventoryScreen() {
  const { session } = useAuth();
  const { height } = useWindowDimensions();
  const isAdmin = session?.user.role === "admin";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<"code" | "stock" | "price">("code");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const loadItems = useCallback(async () => {
    if (!session?.token) {
      return;
    }
    const response = await api.getItems(session.token, searchQuery);
    setItems(response);
  }, [searchQuery, session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems]),
  );

  const rowsPerPage = useMemo(() => {
    if (height >= 920) {
      return 16;
    }
    if (height >= 820) {
      return 14;
    }
    if (height >= 740) {
      return 12;
    }
    return 10;
  }, [height]);

  const sortedItems = useMemo(() => {
    const nextItems = [...items];
    nextItems.sort((left, right) => {
      if (sortBy === "stock") {
        return sortOrder === "asc" ? left.stock - right.stock : right.stock - left.stock;
      }
      if (sortBy === "price") {
        return sortOrder === "asc"
          ? left.consumer_price - right.consumer_price
          : right.consumer_price - left.consumer_price;
      }
      const compared = left.item_code.localeCompare(right.item_code);
      return sortOrder === "asc" ? compared : -compared;
    });
    return nextItems;
  }, [items, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / rowsPerPage));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPageSafe - 1) * rowsPerPage;
    return sortedItems.slice(start, start + rowsPerPage);
  }, [currentPageSafe, rowsPerPage, sortedItems]);

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateModal = () => {
    setEditingItemId(null);
    setForm(emptyForm);
    setError("");
    setShowDeleteConfirm(false);
    setModalVisible(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setForm({
      item_code: item.item_code,
      name: item.name,
      stock: String(item.stock),
      unit: item.unit || "pcs",
      cost_price: String(item.cost_price ?? 0),
      workshop_price: String(item.workshop_price ?? item.price ?? 0),
      consumer_price: String(item.consumer_price ?? item.price ?? 0),
      notes: item.notes ?? "",
      low_stock_threshold: String(item.low_stock_threshold),
    });
    setError("");
    setShowDeleteConfirm(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingItemId(null);
    setForm(emptyForm);
    setError("");
    setShowDeleteConfirm(false);
  };

  const saveItem = async () => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      const payload = {
        item_code: form.item_code,
        name: form.name,
        stock: Number(form.stock || 0),
        unit: form.unit,
        cost_price: Number(form.cost_price || 0),
        workshop_price: Number(form.workshop_price || 0),
        consumer_price: Number(form.consumer_price || 0),
        notes: form.notes,
        category: "",
        supplier: "",
        low_stock_threshold: Number(form.low_stock_threshold || 0),
      };

      if (editingItemId) {
        await api.updateItem(session.token, editingItemId, payload);
      } else {
        await api.createItem(session.token, payload);
      }

      closeModal();
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan barang");
    }
  };

  const deleteSelectedItem = async () => {
    if (!session?.token || !editingItemId) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.deleteItem(session.token, editingItemId);
      closeModal();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus barang");
    } finally {
      setDeleting(false);
    }
  };

  const tableWidth = Object.values(columnWidths).reduce((total, width) => total + width, 0);
  const sortLabel = sortBy === "code" ? "Kode" : sortBy === "stock" ? "Stok" : "Harga";

  const toggleSort = (nextSortBy: "code" | "stock" | "price") => {
    setCurrentPage(1);
    if (sortBy === nextSortBy) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortOrder(nextSortBy === "code" ? "asc" : "desc");
  };

  return (
    <ScreenShell title="" subtitle="" hideHeader scrollable={false} contentStyle={styles.screenContent}>
      <SurfaceCard style={styles.controlsCard}>
        <View style={styles.searchRow}>
          <TextInput
            value={searchDraft}
            onChangeText={setSearchDraft}
            placeholder="Cari kode, nama, satuan, atau keterangan"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            testID="inventory-list-search-input"
          />
          <Pressable
            onPress={() => {
              setSearchQuery(searchDraft);
              setCurrentPage(1);
            }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            testID="inventory-search-button"
          >
            <Ionicons name="search" size={18} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.sortRow}>
          {isAdmin ? (
            <Pressable
              onPress={openCreateModal}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
              testID="inventory-add-button"
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          ) : null}
          {(["code", "stock", "price"] as const).map((key) => {
            const isActive = sortBy === key;
            const iconColor = isActive ? colors.surface : colors.text;
            return (
              <Pressable
                key={key}
                onPress={() => toggleSort(key)}
                style={({ pressed }) => [
                  styles.iconButton,
                  isActive && styles.activeIconButton,
                  pressed && styles.iconPressed,
                ]}
                testID={`inventory-sort-${key}`}
              >
                <Ionicons name={sortButtonMeta[key].icon} size={18} color={iconColor} />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => void loadItems()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            testID="inventory-refresh-button"
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.paginationInfoRow}>
          <Text style={styles.helperText} testID="inventory-sort-state">
            Urut: {sortLabel} {sortOrder === "asc" ? "↑" : "↓"}
          </Text>
          <Text style={styles.helperText} testID="inventory-page-state">
            Hal. {currentPageSafe}/{totalPages}
          </Text>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.tableCard}>
        {sortedItems.length === 0 ? (
          <View style={styles.emptyState} testID="inventory-empty-state">
            <Text style={styles.helperText}>Belum ada data barang tersimpan.</Text>
          </View>
        ) : (
          <View style={styles.tableContent}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tableHorizontalScroll}
              contentContainerStyle={styles.tableHorizontalContent}
              testID="inventory-table-horizontal-scroll"
            >
              <View style={[styles.tableContainer, { width: tableWidth }]}> 
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, { width: columnWidths.code }]}>Kode</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.name }]}>Nama</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.stock }]}>Stok</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.unit }]}>Satuan</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.cost }]}>Harga Modal</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.workshop }]}>Jual Bengkel</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.consumer }]}>Jual Konsumen</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.notes }]}>Keterangan</Text>
                  <Text style={[styles.headerCell, { width: columnWidths.action }]}>Aksi</Text>
                </View>

                <ScrollView
                  style={styles.tableBody}
                  contentContainerStyle={styles.tableBodyContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  testID="inventory-table-vertical-scroll"
                >
                  {paginatedItems.map((item) => {
                    const badgeTone = item.stock <= item.low_stock_threshold ? "danger" : item.stock <= item.low_stock_threshold * 2 ? "warning" : "success";
                    const badgeLabel = item.stock <= item.low_stock_threshold ? "Kritis" : item.stock <= item.low_stock_threshold * 2 ? "Menipis" : "Aman";
                    return (
                      <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.bodyCell, { width: columnWidths.code }]}>{item.item_code}</Text>
                        <Text style={[styles.bodyCell, { width: columnWidths.name }]}>{item.name}</Text>
                        <View style={[styles.stockCell, { width: columnWidths.stock }]}> 
                          <Text style={[styles.bodyCell, styles.stockValue, item.stock <= item.low_stock_threshold && styles.lowStockText]}>{item.stock}</Text>
                          <View style={[styles.stockBadge, badgeTone === "danger" ? styles.badgeDanger : badgeTone === "warning" ? styles.badgeWarning : styles.badgeSuccess]}>
                            <Text style={[styles.stockBadgeText, badgeTone === "warning" && styles.badgeWarningText]}>{badgeLabel}</Text>
                          </View>
                        </View>
                        <Text style={[styles.bodyCell, { width: columnWidths.unit }]}>{item.unit}</Text>
                        <Text style={[styles.bodyCell, { width: columnWidths.cost }]}>{formatCurrency(item.cost_price)}</Text>
                        <Text style={[styles.bodyCell, { width: columnWidths.workshop }]}>{formatCurrency(item.workshop_price)}</Text>
                        <Text style={[styles.bodyCell, { width: columnWidths.consumer }]}>{formatCurrency(item.consumer_price)}</Text>
                        <Text style={[styles.bodyCell, { width: columnWidths.notes }]}>{item.notes || "-"}</Text>
                        <View style={[styles.actionCell, { width: columnWidths.action }]}> 
                          {isAdmin ? (
                            <ActionButton
                              label="Edit"
                              compact
                              onPress={() => openEditModal(item)}
                              testID={`inventory-item-${item.id}`}
                            />
                          ) : (
                            <Text style={styles.readOnlyText}>Lihat</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}
        <View style={styles.tableFooter}>
          <Text style={styles.helperText} testID="inventory-results-state">
            Menampilkan {sortedItems.length === 0 ? 0 : (currentPageSafe - 1) * rowsPerPage + 1}-
            {Math.min(currentPageSafe * rowsPerPage, sortedItems.length)} dari {sortedItems.length} barang
          </Text>
          <View style={styles.paginationControls}>
            <ActionButton
              label="Sebelumnya"
              compact
              onPress={() => setCurrentPage((current) => Math.max(1, current - 1))}
              variant="secondary"
              disabled={currentPageSafe <= 1}
              testID="inventory-page-prev"
            />
            <ActionButton
              label="Berikutnya"
              compact
              onPress={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
              variant="secondary"
              disabled={currentPageSafe >= totalPages}
              testID="inventory-page-next"
            />
          </View>
        </View>
      </SurfaceCard>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingItemId ? "Edit Barang" : "Tambah Barang Baru"}</Text>
              <FormField label="Kode barang" value={form.item_code} onChangeText={(value) => updateField("item_code", value)} autoCapitalize="characters" testID="inventory-item-code-input" />
              <FormField label="Nama barang" value={form.name} onChangeText={(value) => updateField("name", value)} testID="inventory-name-input" />
              <FormField label="Jumlah stok" value={form.stock} onChangeText={(value) => updateField("stock", value)} keyboardType="numeric" testID="inventory-stock-input" />

              <Text style={styles.sectionLabel}>Satuan stok</Text>
              <View style={styles.unitRow}>
                {units.map((unit) => (
                  <ActionButton key={unit} label={unit.toUpperCase()} compact onPress={() => updateField("unit", unit)} variant={form.unit === unit ? "primary" : "secondary"} />
                ))}
              </View>

              <FormField label="Harga modal" value={form.cost_price} onChangeText={(value) => updateField("cost_price", value)} keyboardType="numeric" testID="inventory-cost-price-input" />
              <FormField label="Harga jual ke bengkel" value={form.workshop_price} onChangeText={(value) => updateField("workshop_price", value)} keyboardType="numeric" testID="inventory-workshop-price-input" />
              <FormField label="Harga jual ke konsumen" value={form.consumer_price} onChangeText={(value) => updateField("consumer_price", value)} keyboardType="numeric" testID="inventory-consumer-price-input" />
              <FormField label="Keterangan" value={form.notes} onChangeText={(value) => updateField("notes", value)} multiline testID="inventory-notes-input" />
              <FormField label="Batas stok minimum" value={form.low_stock_threshold} onChangeText={(value) => updateField("low_stock_threshold", value)} keyboardType="numeric" testID="inventory-low-stock-threshold-input" />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.modalActions}>
                <ActionButton label={editingItemId ? "Simpan Perubahan" : "Simpan Barang"} onPress={() => void saveItem()} testID="inventory-save-button" />
                <ActionButton label="Tutup" onPress={closeModal} variant="secondary" testID="inventory-close-button" />
              </View>

              {editingItemId && isAdmin ? (
                <>
                  <ActionButton label="Hapus Barang" onPress={() => setShowDeleteConfirm((current) => !current)} variant="danger" testID="inventory-open-delete-button" />
                  {showDeleteConfirm ? (
                    <DeleteConfirmationCard
                      title="Hapus barang"
                      description="Tombol hapus hanya tersedia untuk admin dan berada di dalam menu edit. Ketik HAPUS untuk konfirmasi."
                      onCancel={() => setShowDeleteConfirm(false)}
                      onConfirm={deleteSelectedItem}
                      loading={deleting}
                      testIDPrefix="inventory-delete"
                    />
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    gap: spacing.md,
  },
  controlsCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  toolbarRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  paginationInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconPressed: {
    opacity: 0.88,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCard: {
    flex: 1,
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
  tableContent: {
    flex: 1,
  },
  tableHorizontalScroll: {
    flex: 1,
  },
  tableHorizontalContent: {
    flexGrow: 1,
  },
  tableContainer: {
    flexGrow: 1,
  },
  headerCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    textTransform: "uppercase",
  },
  tableBody: {
    flex: 1,
  },
  tableBodyContent: {
    paddingBottom: spacing.xs,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stockCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  bodyCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
  },
  stockValue: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  stockBadgeText: {
    color: colors.surface,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
  },
  badgeDanger: {
    backgroundColor: colors.danger,
  },
  badgeWarning: {
    backgroundColor: colors.warning,
  },
  badgeSuccess: {
    backgroundColor: colors.success,
  },
  badgeWarningText: {
    color: colors.text,
  },
  actionCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
  },
  readOnlyText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  lowStockText: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
  },
  paginationControls: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  tableFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 10, 0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalContent: {
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 28,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  modalActions: {
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});