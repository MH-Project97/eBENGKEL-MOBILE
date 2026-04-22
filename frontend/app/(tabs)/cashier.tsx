import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, Share, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { colors, spacing, typography } from "../../lib/theme";
import type { InventoryItem, TransactionLineInput, TransactionRecord } from "../../lib/types";

type CartLine = TransactionLineInput & {
  key: string;
};

const paymentOptions = ["tunai", "transfer", "kartu", "qris"] as const;
const statusOptions = ["paid", "unpaid"] as const;

export default function CashierScreen() {
  const { session } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentOptions)[number]>("tunai");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("paid");
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    const response = await api.getItems(session.token, search);
    setInventoryItems(response);
  }, [search, session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadInventory();
    }, [loadInventory]),
  );

  const subtotal = useMemo(
    () => cart.reduce((total, line) => total + line.unit_price * line.quantity, 0),
    [cart],
  );
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const addInventoryItem = (item: InventoryItem) => {
    setCart((current) => {
      const existing = current.find((line) => line.item_id === item.id && line.type === "barang");
      if (existing) {
        return current.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      return [
        ...current,
        {
          key: `barang-${item.id}`,
          item_id: item.id,
          type: "barang",
          name: item.name,
          quantity: 1,
          unit_price: item.price,
        },
      ];
    });
  };

  const addService = () => {
    if (!serviceName.trim() || Number(servicePrice) <= 0) {
      setError("Isi nama jasa dan harga jasa dengan benar");
      return;
    }

    setError("");
    setCart((current) => [
      ...current,
      {
        key: `jasa-${Date.now()}`,
        type: "jasa",
        name: serviceName.trim(),
        quantity: 1,
        unit_price: Number(servicePrice),
      },
    ]);
    setServiceName("");
    setServicePrice("");
  };

  const updateQuantity = (lineKey: string, nextQuantity: number) => {
    setCart((current) =>
      current
        .map((line) => (line.key === lineKey ? { ...line, quantity: Math.max(nextQuantity, 0) } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const buildReceiptHtml = (transaction: TransactionRecord) => `
    <html>
      <body style="font-family: Arial; padding: 24px;">
        <h1>Bon Bengkel</h1>
        <p>Invoice: ${transaction.invoice_number}</p>
        <p>Pelanggan: ${transaction.customer_name || "Pelanggan umum"}</p>
        <p>Mekanik: ${transaction.mechanic_name || "-"}</p>
        <hr />
        ${transaction.lines
          .map(
            (line) => `<p>${line.name} (${line.quantity} x ${formatCurrency(line.unit_price)}) = ${formatCurrency(line.line_total)}</p>`,
          )
          .join("")}
        <hr />
        <p>Subtotal: ${formatCurrency(transaction.subtotal)}</p>
        <p>Diskon: ${formatCurrency(transaction.discount)}</p>
        <h2>Total: ${formatCurrency(transaction.total)}</h2>
        <p>Status: ${transaction.status}</p>
        <p>Metode bayar: ${transaction.payment_method}</p>
      </body>
    </html>
  `;

  const shareReceipt = async () => {
    if (!receipt) {
      return;
    }

    const html = buildReceiptHtml(receipt);
    if (Platform.OS === "web") {
      const browser = globalThis as typeof globalThis & {
        open?: (url?: string, target?: string) => { document?: { write: (value: string) => void; close: () => void }; print?: () => void } | null;
      };
      const popup = browser.open?.("", "_blank");
      popup?.document?.write(html);
      popup?.document?.close();
      popup?.print?.();
      return;
    }

    await Share.share({
      message: `Bon ${receipt.invoice_number}\nTotal ${formatCurrency(receipt.total)}\nPelanggan: ${receipt.customer_name || "Pelanggan umum"}`,
    });
  };

  const downloadReceipt = () => {
    if (!receipt || Platform.OS !== "web") {
      return;
    }

    const browser = globalThis as typeof globalThis & {
      document?: {
        createElement: (tag: string) => HTMLAnchorElement;
        body: { appendChild: (node: HTMLAnchorElement) => void; removeChild: (node: HTMLAnchorElement) => void };
      };
      URL?: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void };
      Blob?: typeof Blob;
    };
    if (!browser.document || !browser.URL || !browser.Blob) {
      return;
    }

    const blob = new browser.Blob([buildReceiptHtml(receipt)], { type: "text/html" });
    const url = browser.URL.createObjectURL(blob);
    const anchor = browser.document.createElement("a");
    anchor.href = url;
    anchor.download = `${receipt.invoice_number}.html`;
    browser.document.body.appendChild(anchor);
    anchor.click();
    browser.document.body.removeChild(anchor);
    browser.URL.revokeObjectURL(url);
  };

  const saveTransaction = async () => {
    if (!session?.token) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const response = await api.createTransaction(session.token, {
        customer_name: customerName,
        mechanic_name: mechanicName,
        notes,
        payment_method: paymentMethod,
        status,
        discount: Number(discount || 0),
        lines: cart.map(({ item_id, type, name, quantity, unit_price }) => ({
          item_id,
          type,
          name,
          quantity,
          unit_price,
        })),
      });
      setReceipt(response);
      setCart([]);
      setCustomerName("");
      setMechanicName("");
      setNotes("");
      setDiscount("0");
      await loadInventory();
    } catch (transactionError) {
      setError(transactionError instanceof Error ? transactionError.message : "Transaksi gagal disimpan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title="Kasir" subtitle="Tambah barang, jasa, diskon, lalu simpan bon transaksi.">
      <SurfaceCard>
        <Text style={styles.sectionTitle}>Informasi transaksi</Text>
        <FormField label="Nama pelanggan" value={customerName} onChangeText={setCustomerName} testID="cashier-customer-input" />
        <FormField label="Nama mekanik" value={mechanicName} onChangeText={setMechanicName} testID="cashier-mechanic-input" />
        <FormField
          label="Diskon"
          value={discount}
          onChangeText={setDiscount}
          keyboardType="numeric"
          testID="cashier-discount-input"
        />
        <FormField label="Catatan" value={notes} onChangeText={setNotes} multiline testID="cashier-notes-input" />
        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>Metode bayar</Text>
          <View style={styles.optionRow}>
            {paymentOptions.map((option) => (
              <ActionButton
                key={option}
                label={option.toUpperCase()}
                compact
                onPress={() => setPaymentMethod(option)}
                variant={paymentMethod === option ? "primary" : "secondary"}
                testID={`payment-method-${option}`}
              />
            ))}
          </View>
        </View>
        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>Status</Text>
          <View style={styles.optionRow}>
            {statusOptions.map((option) => (
              <ActionButton
                key={option}
                label={option === "paid" ? "LUNAS" : "BELUM LUNAS"}
                compact
                onPress={() => setStatus(option)}
                variant={status === option ? "primary" : "secondary"}
                testID={`payment-status-${option}`}
              />
            ))}
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Pilih barang</Text>
        <FormField
          label="Cari barang"
          value={search}
          onChangeText={setSearch}
          placeholder="Cari nama, kategori, supplier, atau kode barang"
          testID="inventory-search-input"
        />
        <ActionButton label="Muat barang" compact onPress={() => void loadInventory()} variant="secondary" testID="cashier-load-items-button" />
        {inventoryItems.length === 0 ? (
          <Text style={styles.helperText}>Belum ada barang. Tambahkan dulu dari menu daftar barang.</Text>
        ) : (
          inventoryItems.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <View style={styles.flexOne}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.helperText}>
                  {item.category} • {item.item_code} • stok {item.stock}
                </Text>
              </View>
              <View style={styles.actionStack}>
                <Text style={styles.priceText}>{formatCurrency(item.price)}</Text>
                <ActionButton
                  label="Tambah"
                  compact
                  onPress={() => addInventoryItem(item)}
                  testID={`add-item-to-cart-button-${item.id}`}
                />
              </View>
            </View>
          ))
        )}
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Tambah jasa manual</Text>
        <FormField label="Nama jasa" value={serviceName} onChangeText={setServiceName} testID="cashier-service-name-input" />
        <FormField
          label="Harga jasa"
          value={servicePrice}
          onChangeText={setServicePrice}
          keyboardType="numeric"
          testID="cashier-service-price-input"
        />
        <ActionButton label="Tambah jasa ke keranjang" onPress={addService} variant="secondary" testID="cashier-add-service-button" />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Keranjang transaksi</Text>
        {cart.length === 0 ? (
          <Text style={styles.helperText}>Keranjang masih kosong.</Text>
        ) : (
          cart.map((line) => (
            <View key={line.key} style={styles.cartRow}>
              <View style={styles.flexOne}>
                <Text style={styles.itemTitle}>{line.name}</Text>
                <Text style={styles.helperText}>{line.type.toUpperCase()}</Text>
              </View>
              <View style={styles.quantityControls}>
                <ActionButton label="-" compact onPress={() => updateQuantity(line.key, line.quantity - 1)} variant="secondary" />
                <Text style={styles.quantityText}>{line.quantity}</Text>
                <ActionButton label="+" compact onPress={() => updateQuantity(line.key, line.quantity + 1)} variant="secondary" />
              </View>
              <Text style={styles.priceText}>{formatCurrency(line.unit_price * line.quantity)}</Text>
            </View>
          ))
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Diskon</Text>
          <Text style={styles.summaryValue}>{formatCurrency(Number(discount || 0))}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total bayar</Text>
          <Text style={styles.totalValue} testID="checkout-total-value">{formatCurrency(total)}</Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <ActionButton
          label={submitting ? "Menyimpan transaksi..." : "Simpan transaksi"}
          onPress={() => void saveTransaction()}
          disabled={submitting || cart.length === 0}
          testID="cashier-submit-button"
        />
      </SurfaceCard>

      {receipt ? (
        <SurfaceCard>
          <Text style={styles.sectionTitle}>Bon terbaru</Text>
          <Text style={styles.itemTitle}>{receipt.invoice_number}</Text>
          <Text style={styles.helperText}>Total {formatCurrency(receipt.total)} • {receipt.status}</Text>
          <View style={styles.optionRow}>
            <ActionButton label="Cetak bon" onPress={() => void shareReceipt()} variant="secondary" />
            {Platform.OS === "web" ? (
              <ActionButton label="Unduh HTML" onPress={downloadReceipt} />
            ) : null}
          </View>
        </SurfaceCard>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  optionLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  cartRow: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  flexOne: {
    flex: 1,
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
  actionStack: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  quantityText: {
    minWidth: 28,
    textAlign: "center",
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  priceText: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  totalLabel: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  totalValue: {
    color: colors.primary,
    fontFamily: typography.heading,
    fontSize: 28,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});