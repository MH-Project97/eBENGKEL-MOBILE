import { useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { isManagerRole } from "../lib/role";
import { colors, typography } from "../lib/theme";

export default function BackupScreen() {
  const { session } = useAuth();
  const isAdmin = isManagerRole(session?.user.role);
  const [message, setMessage] = useState("");
  const [counts, setCounts] = useState<{ users?: number; inventory_items?: number; transactions?: number }>({});

  const exportBackup = async () => {
    if (!session?.token || !isAdmin) {
      return;
    }

    const backup = await api.exportBackup(session.token);
    const nextCounts = (backup.counts ?? {}) as { users?: number; inventory_items?: number; transactions?: number };
    setCounts(nextCounts);

    if (Platform.OS === "web") {
      const browser = globalThis as typeof globalThis & {
        document?: { createElement: (tag: string) => HTMLAnchorElement; body: { appendChild: (node: HTMLAnchorElement) => void; removeChild: (node: HTMLAnchorElement) => void } };
        URL?: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void };
        Blob?: typeof Blob;
      };
      if (browser.document && browser.URL && browser.Blob) {
        const blob = new browser.Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = browser.URL.createObjectURL(blob);
        const anchor = browser.document.createElement("a");
        anchor.href = url;
        anchor.download = `backup-bengkel-${Date.now()}.json`;
        browser.document.body.appendChild(anchor);
        anchor.click();
        browser.document.body.removeChild(anchor);
        browser.URL.revokeObjectURL(url);
      }
    }

    setMessage("Backup data berhasil dibuat dan siap diunduh.");
  };

  return (
    <ScreenShell title="Backup Data" subtitle="Ekspor data pengguna, barang, transaksi, dan profil bengkel dalam format JSON." backButton>
      <SurfaceCard>
        <Text style={styles.title}>Akses Backup</Text>
        <Text style={styles.body}>Hanya owner atau admin yang dapat membuat backup data lengkap untuk keamanan operasional bengkel.</Text>
        {isAdmin ? <ActionButton label="Buat Backup JSON" onPress={() => void exportBackup()} testID="backup-export-button" /> : <Text style={styles.warning}>Masuk sebagai owner/admin untuk menggunakan fitur backup.</Text>}
        {message ? <Text style={styles.success} testID="backup-success-message">{message}</Text> : null}
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.title}>Ringkasan Backup Terakhir</Text>
        <Text style={styles.body}>User: {counts.users ?? 0}</Text>
        <Text style={styles.body}>Barang: {counts.inventory_items ?? 0}</Text>
        <Text style={styles.body}>Transaksi: {counts.transactions ?? 0}</Text>
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  body: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
  warning: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  success: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});