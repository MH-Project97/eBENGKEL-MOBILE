import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

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
  stock: 90,
  unit: 100,
  cost: 140,
  workshop: 160,
  consumer: 170,
  notes: 220,
  action: 110,
};

export default function InventoryScreen() {
  const { session } = useAuth();
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

  const lowStockCount = useMemo(() => items.filter((item) => item.stock <= item.low_stock_threshold).length, [items]);

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

  return (
    <ScreenShell title="" subtitle="" hideHeader>
      <View style={styles.summaryRow}>
        <SurfaceCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total barang</Text>
          <Text style={styles.summaryValue}>{items.length}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Stok menipis</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{lowStockCount}</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard>
        <View style={styles.toolbarRow}>
          <TextInput
            value={searchDraft}
            onChangeText={setSearchDraft}
            placeholder="Cari kode, nama, satuan, atau keterangan"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            testID="inventory-list-search-input"
          />
          <ActionButton
            label="Cari"
            compact
            onPress={() => {
              setSearchQuery(searchDraft);
            }}
            variant="secondary"
            testID="inventory-search-button"
          />
          {isAdmin ? <ActionButton label="Tambah Barang Baru" compact onPress={openCreateModal} testID="inventory-add-button" /> : null}
          <Pressable onPress={() => void loadItems()} style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]} testID="inventory-refresh-button">
            <Ionicons name="refresh" size={20} color={colors.text} />
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        {items.length === 0 ? (
          <Text style={styles.helperText}>Belum ada data barang tersimpan.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width: tableWidth }}>
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

              <ScrollView style={styles.tableBody} nestedScrollEnabled>
                {items.map((item) => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.bodyCell, { width: columnWidths.code }]}>{item.item_code}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.name }]}>{item.name}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.stock }, item.stock <= item.low_stock_threshold && styles.lowStockText]}>{item.stock}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.unit }]}>{item.unit}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.cost }]}>{formatCurrency(item.cost_price)}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.workshop }]}>{formatCurrency(item.workshop_price)}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.consumer }]}>{formatCurrency(item.consumer_price)}</Text>
                    <Text style={[styles.bodyCell, { width: columnWidths.notes }]}>{item.notes || "-"}</Text>
                    <View style={[styles.actionCell, { width: columnWidths.action }]}>
                      {isAdmin ? <ActionButton label="Edit" compact onPress={() => openEditModal(item)} testID={`inventory-item-${item.id}`} /> : <Text style={styles.readOnlyText}>Lihat</Text>}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        )}
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
                <ActionButton label="Tutup" onPress={closeModal} variant="secondary" />
              </View>

              {editingItemId && isAdmin ? (
                <>
                  <ActionButton label="Hapus Barang" onPress={() => setShowDeleteConfirm((current) => !current)} variant="danger" />
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
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  summaryCard: {
    width: "48%",
  },
  summaryLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 28,
  },
  toolbarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 190,
    minHeight: 52,
    backgroundColor: colors.background,
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
  headerCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    textTransform: "uppercase",
  },
  tableBody: {
    maxHeight: 420,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bodyCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
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