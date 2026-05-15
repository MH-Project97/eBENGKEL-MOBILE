import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { FormField } from "../../components/FormField";
import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { colors, spacing, typography } from "../../lib/theme";
import type { InventoryItem, TransactionLineInput, TransactionRecord } from "../../lib/types";

type CustomerMode = "konsumen" | "bengkel";

type CartLine = TransactionLineInput & {
  key: string;
};

const paymentOptions = ["tunai", "transfer", "qris"] as const;
const customerModes: { label: string; value: CustomerMode }[] = [
  { label: "Konsumen", value: "konsumen" },
  { label: "Bengkel", value: "bengkel" },
];

export default function CashierScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string | string[] }>();
  const editIdParam = Array.isArray(params.editId) ? params.editId[0] : params.editId;
  const isEditMode = Boolean(editIdParam);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("konsumen");
  const [customerName, setCustomerName] = useState("");
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicModalVisible, setMechanicModalVisible] = useState(false);
  const [mechanicSearch, setMechanicSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentOptions)[number]>("tunai");
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [changeDecisionVisible, setChangeDecisionVisible] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);
  const [workshopCustomers, setWorkshopCustomers] = useState<string[]>([]);
  const [workshopMechanics, setWorkshopMechanics] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [error, setError] = useState("");

  const inventoryMap = useMemo(
    () => Object.fromEntries(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems],
  );

  const resetCashierForm = useCallback(() => {
    setCustomerMode("konsumen");
    setCustomerName("");
    setMechanicName("");
    setNotes("");
    setDiscount("0");
    setAmountPaid("0");
    setPaymentMethod("tunai");
    setServiceName("");
    setServicePrice("");
    setServiceModalVisible(false);
    setChangeDecisionVisible(false);
    setItemModalVisible(false);
    setCustomerModalVisible(false);
    setMechanicModalVisible(false);
    setItemSearch("");
    setCustomerSearch("");
    setMechanicSearch("");
    setCart([]);
    setReceipt(null);
    setError("");
    setLoadingEditData(false);
  }, []);

  const loadInventory = useCallback(async (keyword = "") => {
    if (!session?.token) {
      return;
    }
    const response = await api.getItems(session.token, keyword);
    setInventoryItems(response);
  }, [session?.token]);

  const loadWorkshopData = useCallback(async () => {
    if (!session?.token) {
      return;
    }
    const response = await api.getWorkshop(session.token);
    setWorkshopCustomers(response.customers);
    setWorkshopMechanics(response.mechanic_options);
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkshopData();
      void loadInventory();
    }, [loadInventory, loadWorkshopData]),
  );

  const loadTransactionForEdit = useCallback(async () => {
    if (!session?.token || !editIdParam) {
      return;
    }

    try {
      setLoadingEditData(true);
      const transaction = await api.getTransaction(session.token, editIdParam);
      setCustomerMode(transaction.customer_mode ?? "konsumen");
      setCustomerName(transaction.customer_name);
      setMechanicName(transaction.mechanic_name);
      setNotes(transaction.notes);
      setDiscount(String(transaction.discount));
      setAmountPaid(String(transaction.amount_paid));
      setPaymentMethod(transaction.payment_method as (typeof paymentOptions)[number]);
      setCart(
        transaction.lines.map((line, index) => ({
          key: line.item_id ? `barang-${line.item_id}` : `jasa-${index}-${transaction.id}`,
          item_id: line.item_id,
          type: line.type,
          name: line.name,
          quantity: line.quantity,
          unit_price: line.unit_price,
        })),
      );
      setReceipt(null);
    } catch (transactionError) {
      setError(transactionError instanceof Error ? transactionError.message : "Gagal memuat transaksi");
    } finally {
      setLoadingEditData(false);
    }
  }, [editIdParam, session?.token]);

  useFocusEffect(
    useCallback(() => {
      if (editIdParam) {
        void loadTransactionForEdit();
      }
      return () => {
        if (editIdParam) {
          resetCashierForm();
        }
      };
    }, [editIdParam, loadTransactionForEdit, resetCashierForm]),
  );

  useEffect(() => {
    setCart((current) =>
      current.map((line) => {
        if (line.type !== "barang" || !line.item_id) {
          return line;
        }
        const item = inventoryMap[line.item_id];
        if (!item) {
          return line;
        }
        const nextPrice = customerMode === "bengkel" ? item.workshop_price : item.consumer_price;
        return line.unit_price === nextPrice ? line : { ...line, unit_price: nextPrice };
      }),
    );
  }, [customerMode, inventoryMap]);

  useEffect(() => {
    if (customerMode === "bengkel") {
      setMechanicName("");
    }
  }, [customerMode]);

  const subtotal = useMemo(
    () => cart.reduce((total, line) => total + line.unit_price * line.quantity, 0),
    [cart],
  );
  const total = Math.max(subtotal - Number(discount || 0), 0);
  const paidAmount = Number(amountPaid || 0);
  const balanceDue = Math.max(total - paidAmount, 0);
  const changeDue = Math.max(paidAmount - total, 0);
  const paymentStateLabel = balanceDue > 0 ? "Masih hutang" : changeDue > 0 ? "Ada kembalian" : "Lunas";

  const getItemPriceByMode = (item: InventoryItem) =>
    customerMode === "bengkel" ? item.workshop_price : item.consumer_price;

  const addInventoryItem = (item: InventoryItem) => {
    if (item.stock <= 0) {
      setError("Stok barang habis");
      return;
    }

    const nextPrice = getItemPriceByMode(item);
    setError("");
    setCart((current) => {
      const existing = current.find((line) => line.item_id === item.id && line.type === "barang");
      if (existing) {
        if (existing.quantity >= item.stock) {
          setError("Jumlah barang di keranjang sudah mencapai stok tersedia");
          return current;
        }
        return current.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1, unit_price: nextPrice } : line,
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
          unit_price: nextPrice,
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
    setServiceModalVisible(false);
  };

  const removeLine = (lineKey: string) => {
    setCart((current) => current.filter((line) => line.key !== lineKey));
  };

  const updateQuantity = (line: CartLine, delta: number) => {
    const nextQuantity = line.quantity + delta;
    if (nextQuantity <= 0) {
      removeLine(line.key);
      return;
    }

    if (line.type === "barang" && line.item_id) {
      const sourceItem = inventoryMap[line.item_id];
      if (sourceItem && nextQuantity > sourceItem.stock) {
        setError("Jumlah melebihi stok yang tersedia");
        return;
      }
    }

    setError("");
    setCart((current) => current.map((item) => (item.key === line.key ? { ...item, quantity: nextQuantity } : item)));
  };

  const filteredCustomers = useMemo(
    () => workshopCustomers.filter((name) => name.toLowerCase().includes(customerSearch.trim().toLowerCase())),
    [customerSearch, workshopCustomers],
  );

  const filteredMechanics = useMemo(
    () => workshopMechanics.filter((name) => name.toLowerCase().includes(mechanicSearch.trim().toLowerCase())),
    [mechanicSearch, workshopMechanics],
  );

  const openCustomerModal = () => {
    setCustomerSearch(customerName);
    setCustomerModalVisible(true);
  };

  const openMechanicModal = () => {
    setMechanicSearch(mechanicName);
    setMechanicModalVisible(true);
  };

  const openItemModal = () => {
    setItemSearch("");
    setItemModalVisible(true);
    void loadInventory("");
  };

  const saveCustomerToWorkshop = async () => {
    if (!session?.token || !customerSearch.trim()) {
      return;
    }
    await api.addWorkshopCustomer(session.token, customerSearch.trim());
    await loadWorkshopData();
    setCustomerName(customerSearch.trim());
    setCustomerModalVisible(false);
  };

  const saveMechanicToWorkshop = async () => {
    if (!session?.token || !mechanicSearch.trim()) {
      return;
    }
    await api.addWorkshopMechanic(session.token, mechanicSearch.trim());
    await loadWorkshopData();
    setMechanicName(mechanicSearch.trim());
    setMechanicModalVisible(false);
  };

  const buildReceiptHtml = (transaction: TransactionRecord) => `
    <html>
      <body style="font-family: Arial; padding: 24px;">
        <h1>Bon Bengkel</h1>
        <p>Invoice: ${transaction.invoice_number}</p>
        <p>Mode pelanggan: ${transaction.customer_mode}</p>
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
        <p>Dibayar: ${formatCurrency(transaction.amount_paid)}</p>
        <p>Sisa hutang: ${formatCurrency(transaction.balance_due)}</p>
        <p>Kembalian: ${formatCurrency(transaction.change_due)}</p>
        <p>Status pembayaran: ${transaction.payment_state}</p>
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
      message: `Bon ${receipt.invoice_number}\nTotal ${formatCurrency(receipt.total)}\nDibayar ${formatCurrency(receipt.amount_paid)}\nSisa hutang ${formatCurrency(receipt.balance_due)}`,
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

  const finalizeTransaction = async (changeHandledByCashier: boolean) => {
    if (!session?.token) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const effectivePaidAmount = changeHandledByCashier ? total : paidAmount;
      const effectiveNotes = changeHandledByCashier && changeDue > 0
        ? [notes.trim(), `Kembalian ${formatCurrency(changeDue)} dikembalikan langsung oleh kasir.`].filter(Boolean).join(" | ")
        : notes;
      const derivedStatus: "paid" | "unpaid" = effectivePaidAmount >= total ? "paid" : "unpaid";
      const payload = {
        customer_mode: customerMode,
        customer_name: customerName,
        mechanic_name: mechanicName,
        notes: effectiveNotes,
        payment_method: paymentMethod,
        status: derivedStatus,
        discount: Number(discount || 0),
        amount_paid: effectivePaidAmount,
        lines: cart.map(({ item_id, type, name, quantity, unit_price }) => ({
          item_id,
          type,
          name,
          quantity,
          unit_price,
        })),
      };

      const response = editIdParam
        ? await api.updateTransaction(session.token, editIdParam, payload)
        : await api.createTransaction(session.token, payload);

      if (customerName.trim() && !workshopCustomers.includes(customerName.trim())) {
        await api.addWorkshopCustomer(session.token, customerName.trim());
        await loadWorkshopData();
      }

      setReceipt(response);
      setCart([]);
      setCustomerName("");
      setMechanicName("");
      setNotes("");
      setDiscount("0");
      setAmountPaid("0");
      setPaymentMethod("tunai");
      setCustomerMode("konsumen");
      if (editIdParam) {
        router.replace("/cashier" as Href);
      }
      await loadInventory();
    } catch (transactionError) {
      setError(transactionError instanceof Error ? transactionError.message : "Transaksi gagal disimpan");
    } finally {
      setSubmitting(false);
    }
  };

  const saveTransaction = async () => {
    if (paidAmount > total) {
      setChangeDecisionVisible(true);
      return;
    }
    await finalizeTransaction(false);
  };

  return (
    <>
      <ScreenShell title="" subtitle="" hideHeader>
        {isEditMode ? (
          <SurfaceCard>
            <Text style={styles.sectionTitle}>Mode edit transaksi</Text>
            <Text style={styles.helperText}>Perubahan transaksi akan otomatis menyesuaikan stok dan status pembayaran.</Text>
            <ActionButton
              label="Batal edit"
              onPress={() => {
                resetCashierForm();
                router.replace("/transactions" as Href);
              }}
              variant="secondary"
              testID="cashier-cancel-edit-button"
            />
          </SurfaceCard>
        ) : null}

        {loadingEditData ? (
          <SurfaceCard>
            <Text style={styles.helperText}>Memuat data transaksi untuk diedit...</Text>
          </SurfaceCard>
        ) : null}

        <SurfaceCard>
          <Text style={styles.sectionTitle}>Data transaksi</Text>

          <Text style={styles.fieldLabel}>Mode pelanggan</Text>
          <View style={styles.segmentRow}>
            {customerModes.map((mode) => (
              <Pressable
                key={mode.value}
                onPress={() => setCustomerMode(mode.value)}
                style={({ pressed }) => [styles.segmentButton, customerMode === mode.value && styles.segmentButtonActive, pressed && styles.segmentPressed]}
                testID={`cashier-customer-mode-${mode.value}`}
              >
                <Text style={[styles.segmentText, customerMode === mode.value && styles.segmentTextActive]}>{mode.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Pelanggan</Text>
          <Pressable onPress={openCustomerModal} style={({ pressed }) => [styles.selectorButton, pressed && styles.segmentPressed]} testID="cashier-customer-selector-button">
            <Text style={[styles.selectorText, !customerName && styles.selectorPlaceholder]}>
              {customerName || (customerMode === "konsumen" ? "Pilih pelanggan" : "Pilih bengkel pembeli")}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>

          {customerMode === "konsumen" ? (
            <>
              <Text style={styles.fieldLabel}>Mekanik</Text>
              <Pressable onPress={openMechanicModal} style={({ pressed }) => [styles.selectorButton, pressed && styles.segmentPressed]} testID="cashier-mechanic-selector-button">
                <Text style={[styles.selectorText, !mechanicName && styles.selectorPlaceholder]}>
                  {mechanicName || "Pilih mekanik"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Metode pembayaran</Text>
          <View style={styles.segmentRow}>
            {paymentOptions.map((option) => (
              <Pressable
                key={option}
                onPress={() => setPaymentMethod(option)}
                style={({ pressed }) => [styles.segmentButton, paymentMethod === option && styles.segmentButtonActive, pressed && styles.segmentPressed]}
                testID={`payment-method-${option}`}
              >
                <Text style={[styles.segmentText, paymentMethod === option && styles.segmentTextActive]}>{option.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.sectionTitle}>Pilih barang</Text>
          <Pressable onPress={openItemModal} style={({ pressed }) => [styles.pickerTrigger, pressed && styles.segmentPressed]} testID="cashier-toggle-item-picker-button">
            <View style={styles.pickerIconBox}>
              <Ionicons name="cart-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.itemTitle}>Pilih barang / sparepart</Text>
              <Text style={styles.helperText}>Harga otomatis mengikuti mode {customerMode}.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.sectionTitle}>Keranjang</Text>
          {cart.length === 0 ? (
            <Text style={styles.helperText}>Belum ada barang atau jasa di keranjang.</Text>
          ) : (
            cart.map((line) => {
              const stockInfo = line.type === "barang" && line.item_id ? inventoryMap[line.item_id]?.stock ?? 0 : null;
              return (
                <View key={line.key} style={styles.cartCard}>
                  <View style={styles.cartTopRow}>
                    <View style={styles.flexOne}>
                      <Text style={styles.itemTitle}>{line.name}</Text>
                      <Text style={styles.helperText}>
                        {line.type === "barang"
                          ? `Stok ${stockInfo} • ${formatCurrency(line.unit_price)}`
                          : `Jasa manual • ${formatCurrency(line.unit_price)}`}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeLine(line.key)} style={({ pressed }) => [styles.deleteButton, pressed && styles.segmentPressed]} testID={`cashier-remove-line-${line.key}`}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                  <View style={styles.cartBottomRow}>
                    <View style={styles.qtyControl}>
                      <Pressable onPress={() => updateQuantity(line, -1)} style={({ pressed }) => [styles.qtyButton, pressed && styles.segmentPressed]} testID={`cashier-decrease-qty-${line.key}`}>
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </Pressable>
                      <Text style={styles.qtyValue} testID={`cashier-qty-${line.key}`}>{line.quantity}</Text>
                      <Pressable onPress={() => updateQuantity(line, 1)} style={({ pressed }) => [styles.qtyButton, pressed && styles.segmentPressed]} testID={`cashier-increase-qty-${line.key}`}>
                        <Ionicons name="add" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                    <Text style={styles.priceText} testID={`cashier-line-subtotal-${line.key}`}>{formatCurrency(line.unit_price * line.quantity)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.sectionTitle}>Input jasa manual</Text>
          <Pressable onPress={() => setServiceModalVisible(true)} style={({ pressed }) => [styles.pickerTrigger, pressed && styles.segmentPressed]} testID="cashier-service-modal-open-button">
            <View style={styles.pickerIconBox}>
              <Ionicons name="construct-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.itemTitle}>Tambah jasa manual</Text>
              <Text style={styles.helperText}>Masukkan jasa yang tidak ada di daftar barang melalui popup.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.sectionTitle}>Ringkasan transaksi</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total transaksi</Text>
              <Text style={styles.totalValue} testID="checkout-total-value">{formatCurrency(total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
          </View>

          <FormField label="Diskon" value={discount} onChangeText={setDiscount} keyboardType="numeric" testID="cashier-discount-input" />
          <FormField label="Pembayaran" value={amountPaid} onChangeText={setAmountPaid} keyboardType="numeric" testID="cashier-amount-paid-input" />

          <View style={styles.paymentStateCard} testID="cashier-payment-preview-card">
            <Text style={styles.paymentStateText}>{paymentStateLabel}</Text>
            <Text style={styles.helperText}>Dibayar: {formatCurrency(paidAmount)}</Text>
            <Text style={styles.helperText}>Sisa hutang: {formatCurrency(balanceDue)}</Text>
            <Text style={styles.helperText}>Kembalian: {formatCurrency(changeDue)}</Text>
          </View>

          {error ? <Text style={styles.errorText} testID="cashier-error-text">{error}</Text> : null}

          <ActionButton
            label={submitting ? (isEditMode ? "Memperbarui transaksi..." : "Memproses transaksi...") : (isEditMode ? "Update transaksi" : "Proses transaksi")}
            onPress={() => void saveTransaction()}
            disabled={submitting || cart.length === 0 || loadingEditData}
            testID="cashier-submit-button"
          />
        </SurfaceCard>
        <SurfaceCard>
          <Text style={styles.sectionTitle}>Detail tambahan</Text>
          <FormField label="Catatan" value={notes} onChangeText={setNotes} multiline testID="cashier-notes-input" />
        </SurfaceCard>

        {receipt ? (
          <SurfaceCard>
            <Text style={styles.sectionTitle}>Bon terbaru</Text>
            <Text style={styles.itemTitle}>{receipt.invoice_number}</Text>
            <Text style={styles.helperText}>Mode {receipt.customer_mode} • Total {formatCurrency(receipt.total)}</Text>
            <Text style={styles.helperText}>Dibayar {formatCurrency(receipt.amount_paid)} • {receipt.payment_state}</Text>
            <View style={styles.segmentRow}>
              <ActionButton label="Cetak bon" onPress={() => void shareReceipt()} variant="secondary" testID="cashier-share-receipt-button" />
              {Platform.OS === "web" ? <ActionButton label="Unduh HTML" onPress={downloadReceipt} testID="cashier-download-receipt-button" /> : null}
            </View>
          </SurfaceCard>
        ) : null}
      </ScreenShell>

      <Modal visible={customerModalVisible} animationType="slide" transparent onRequestClose={() => setCustomerModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Pilih pelanggan</Text>
            <TextInput
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Cari pelanggan"
              placeholderTextColor={colors.textMuted}
              style={styles.inlineInput}
              testID="cashier-customer-modal-input"
            />
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList}>
              {filteredCustomers.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    setCustomerName(name);
                    setCustomerModalVisible(false);
                  }}
                  style={({ pressed }) => [styles.modalOption, pressed && styles.segmentPressed]}
                  testID={`cashier-customer-option-${name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Text style={styles.selectorText}>{name}</Text>
                </Pressable>
              ))}
              {filteredCustomers.length === 0 && customerSearch.trim() ? (
                <ActionButton label={`Tambah pelanggan: ${customerSearch.trim()}`} onPress={() => void saveCustomerToWorkshop()} testID="cashier-add-customer-from-search-button" />
              ) : null}
            </ScrollView>
            <ActionButton label="Tutup" onPress={() => setCustomerModalVisible(false)} variant="secondary" testID="cashier-customer-modal-cancel" />
          </SurfaceCard>
        </View>
      </Modal>

      <Modal visible={mechanicModalVisible} animationType="slide" transparent onRequestClose={() => setMechanicModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Pilih mekanik</Text>
            <TextInput
              value={mechanicSearch}
              onChangeText={setMechanicSearch}
              placeholder="Cari mekanik"
              placeholderTextColor={colors.textMuted}
              style={styles.inlineInput}
              testID="cashier-mechanic-modal-input"
            />
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList}>
              {filteredMechanics.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => {
                    setMechanicName(name);
                    setMechanicModalVisible(false);
                  }}
                  style={({ pressed }) => [styles.modalOption, pressed && styles.segmentPressed]}
                  testID={`cashier-mechanic-option-${name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Text style={styles.selectorText}>{name}</Text>
                </Pressable>
              ))}
              {filteredMechanics.length === 0 && mechanicSearch.trim() ? (
                <ActionButton label={`Tambah mekanik: ${mechanicSearch.trim()}`} onPress={() => void saveMechanicToWorkshop()} testID="cashier-add-mechanic-from-search-button" />
              ) : null}
            </ScrollView>
            <ActionButton label="Tutup" onPress={() => setMechanicModalVisible(false)} variant="secondary" testID="cashier-mechanic-modal-cancel" />
          </SurfaceCard>
        </View>
      </Modal>

      <Modal visible={itemModalVisible} animationType="slide" transparent onRequestClose={() => setItemModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Pilih barang</Text>
            <View style={styles.inputActionRow}>
              <TextInput
                value={itemSearch}
                onChangeText={setItemSearch}
                placeholder="Cari nama, kode, kategori, supplier"
                placeholderTextColor={colors.textMuted}
                style={styles.inlineInput}
                testID="cashier-item-search-input"
              />
              <Pressable
                onPress={() => void loadInventory(itemSearch)}
                style={({ pressed }) => [styles.refreshButton, pressed && styles.segmentPressed]}
                testID="cashier-load-items-button"
              >
                <Ionicons name="search" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList}>
              {inventoryItems.length === 0 ? (
                <Text style={styles.helperText}>Belum ada barang yang cocok. Coba kata kunci lain atau cek stok barang.</Text>
              ) : (
                inventoryItems.map((item) => {
                  const itemPrice = getItemPriceByMode(item);
                  return (
                    <View key={item.id} style={styles.inventoryRow}>
                      <View style={styles.flexOne}>
                        <Text style={styles.itemTitle}>{item.name}</Text>
                        <Text style={styles.helperText}>{item.item_code} • stok {item.stock} • {item.unit}</Text>
                      </View>
                      <View style={styles.inventoryActionColumn}>
                        <Text style={styles.priceText}>{formatCurrency(itemPrice)}</Text>
                        <ActionButton
                          label="Tambah"
                          compact
                          onPress={() => {
                            addInventoryItem(item);
                            setItemModalVisible(false);
                          }}
                          disabled={item.stock <= 0}
                          testID={`add-item-to-cart-button-${item.id}`}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <ActionButton label="Tutup" onPress={() => setItemModalVisible(false)} variant="secondary" testID="cashier-item-modal-close-button" />
          </SurfaceCard>
        </View>
      </Modal>

      <Modal visible={serviceModalVisible} animationType="slide" transparent onRequestClose={() => setServiceModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Input jasa manual</Text>
            <FormField label="Nama jasa" value={serviceName} onChangeText={setServiceName} testID="cashier-service-name-input" />
            <FormField label="Harga jasa" value={servicePrice} onChangeText={setServicePrice} keyboardType="numeric" testID="cashier-service-price-input" />
            <View style={styles.segmentRow}>
              <ActionButton label="Tutup" onPress={() => setServiceModalVisible(false)} variant="secondary" testID="cashier-service-modal-cancel" />
              <ActionButton label="Simpan jasa" onPress={addService} testID="cashier-add-service-button" />
            </View>
          </SurfaceCard>
        </View>
      </Modal>

      <Modal visible={changeDecisionVisible} animationType="fade" transparent onRequestClose={() => setChangeDecisionVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Keputusan kembalian</Text>
            <Text style={styles.helperText}>Ada kembalian sebesar {formatCurrency(changeDue)}. Pilih apakah kembalian disimpan di transaksi atau sudah dikembalikan langsung oleh kasir.</Text>
            <View style={styles.segmentRow}>
              <ActionButton
                label="Simpan kembalian"
                variant="secondary"
                onPress={() => {
                  setChangeDecisionVisible(false);
                  void finalizeTransaction(false);
                }}
                testID="cashier-store-change-button"
              />
              <ActionButton
                label="Selesai"
                onPress={() => {
                  setChangeDecisionVisible(false);
                  void finalizeTransaction(true);
                }}
                testID="cashier-finish-change-button"
              />
            </View>
          </SurfaceCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  segmentButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentPressed: {
    opacity: 0.88,
  },
  segmentText: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  segmentTextActive: {
    color: colors.surface,
  },
  inputActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  inlineInput: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  refreshButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  selectorText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
  },
  selectorPlaceholder: {
    color: colors.textMuted,
  },
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  pickerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
  },
  inventoryActionColumn: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  cartCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cartTopRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  cartBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    minWidth: 24,
    textAlign: "center",
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  paymentStateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  paymentStateText: {
    color: colors.primary,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
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
  totalValue: {
    color: colors.primary,
    fontFamily: typography.heading,
    fontSize: 28,
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
  flexOne: {
    flex: 1,
    gap: 4,
  },
  priceText: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: 28,
    maxHeight: "85%",
  },
  modalList: {
    gap: spacing.sm,
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surfaceAlt,
  },
});