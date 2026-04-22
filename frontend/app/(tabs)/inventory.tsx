import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { DeleteConfirmationCard } from "../../components/DeleteConfirmationCard";
import { FormField } from "../../components/FormField";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { colors, spacing, typography } from "../../lib/theme";
import type { InventoryItem } from "../../lib/types";

const emptyForm = {
  name: "",
  category: "",
  price: "",
  stock: "",
  supplier: "",
  item_code: "",
  low_stock_threshold: "5",
};

export default function InventoryScreen() {
  const { session } = useAuth();
  const isAdmin = session?.user.role === "admin";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    if (!session?.token) {
      return;
    }
    const response = await api.getItems(session.token, search);
    setItems(response);
  }, [search, session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
    }, [loadItems]),
  );

  const lowStockCount = useMemo(
    () => items.filter((item) => item.stock <= item.low_stock_threshold).length,
    [items],
  );

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      stock: String(item.stock),
      supplier: item.supplier,
      item_code: item.item_code,
      low_stock_threshold: String(item.low_stock_threshold),
    });
  };

  const clearForm = () => {
    setSelectedItemId(null);
    setForm(emptyForm);
    setError("");
  };

  const saveItem = async () => {
    if (!session?.token) {
      return;
    }

    try {
      setError("");
      const payload = {
        name: form.name,
        category: form.category,
        price: Number(form.price || 0),
        stock: Number(form.stock || 0),
        supplier: form.supplier,
        item_code: form.item_code,
        low_stock_threshold: Number(form.low_stock_threshold || 0),
      };

      if (selectedItemId) {
        await api.updateItem(session.token, selectedItemId, payload);
      } else {
        await api.createItem(session.token, payload);
      }

      clearForm();
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan barang");
    }
  };

  const deleteSelectedItem = async () => {
    if (!session?.token || !selectedItemId) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.deleteItem(session.token, selectedItemId);
      clearForm();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus barang");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenShell title="Daftar Barang" subtitle="Atur stok, harga, supplier, kode barang, dan batas stok minimum.">
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
        <Text style={styles.sectionTitle}>{selectedItemId ? "Edit barang" : "Tambah barang baru"}</Text>
        <FormField label="Nama barang" value={form.name} onChangeText={(value) => updateField("name", value)} testID="inventory-name-input" />
        <FormField label="Kategori" value={form.category} onChangeText={(value) => updateField("category", value)} testID="inventory-category-input" />
        <FormField label="Harga" value={form.price} onChangeText={(value) => updateField("price", value)} keyboardType="numeric" testID="inventory-price-input" />
        <FormField label="Stok" value={form.stock} onChangeText={(value) => updateField("stock", value)} keyboardType="numeric" testID="inventory-stock-input" />
        <FormField label="Supplier" value={form.supplier} onChangeText={(value) => updateField("supplier", value)} testID="inventory-supplier-input" />
        <FormField label="Kode barang" value={form.item_code} onChangeText={(value) => updateField("item_code", value)} autoCapitalize="characters" testID="inventory-item-code-input" />
        <FormField
          label="Batas stok minimum"
          value={form.low_stock_threshold}
          onChangeText={(value) => updateField("low_stock_threshold", value)}
          keyboardType="numeric"
          testID="inventory-low-stock-threshold-input"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.actionRow}>
          <ActionButton label={selectedItemId ? "Update barang" : "Simpan barang"} onPress={() => void saveItem()} testID="inventory-save-button" />
          <ActionButton label="Reset" onPress={clearForm} variant="secondary" testID="inventory-reset-button" />
        </View>
      </SurfaceCard>

      {selectedItemId && isAdmin ? (
        <DeleteConfirmationCard
          title="Hapus barang"
          description="Hanya admin yang boleh menghapus. Ketik HAPUS untuk melanjutkan."
          onCancel={clearForm}
          onConfirm={deleteSelectedItem}
          loading={deleting}
          testIDPrefix="inventory-delete"
        />
      ) : null}

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Cari dan pilih barang</Text>
        <FormField label="Pencarian" value={search} onChangeText={setSearch} placeholder="Nama, kategori, supplier, atau kode barang" testID="inventory-list-search-input" />
        <ActionButton label="Terapkan pencarian" compact onPress={() => void loadItems()} variant="secondary" testID="inventory-search-button" />
        {items.length === 0 ? (
          <Text style={styles.helperText}>Belum ada data barang tersimpan.</Text>
        ) : (
          items.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => selectItem(item)} style={styles.itemCard} testID={`inventory-item-${item.id}`}>
              <View style={styles.flexOne}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.helperText}>{item.category} • {item.supplier}</Text>
                <Text style={styles.helperText}>{item.item_code}</Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={styles.priceText}>Rp{Math.round(item.price)}</Text>
                <Text style={[styles.stockText, item.stock <= item.low_stock_threshold && styles.lowStockText]}>
                  Stok {item.stock}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </SurfaceCard>
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
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  actionRow: {
    gap: spacing.sm,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  flexOne: {
    flex: 1,
    gap: 4,
  },
  alignEnd: {
    alignItems: "flex-end",
    gap: 4,
  },
  itemTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  priceText: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  stockText: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  lowStockText: {
    color: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});