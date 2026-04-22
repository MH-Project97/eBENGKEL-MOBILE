import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../components/ScreenShell";
import { SurfaceCard } from "../../components/SurfaceCard";
import { colors, spacing, typography } from "../../lib/theme";

const menuSections = [
  {
    title: "Manajemen",
    items: [
      { label: "Detail Pengguna", route: "/users" as Href, icon: "people-outline" as const },
      { label: "Detail Bengkel", route: "/workshop" as Href, icon: "business-outline" as const },
      { label: "Backup Data", route: "/backup" as Href, icon: "cloud-download-outline" as const },
    ],
  },
  {
    title: "Sistem",
    items: [
      { label: "Pengaturan", route: "/settings" as Href, icon: "settings-outline" as const },
      { label: "Tentang", route: "/about" as Href, icon: "information-circle-outline" as const },
    ],
  },
];

export default function MenuScreen() {
  const router = useRouter();

  const toMenuTestID = (label: string) => `menu-item-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <ScreenShell title="Menu" subtitle="Kumpulan fitur manajemen, sistem, dan fitur baru yang akan datang.">
      {menuSections.map((section) => (
        <SurfaceCard key={section.title}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.route)}
              testID={toMenuTestID(item.label)}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={22} color={colors.text} />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </SurfaceCard>
      ))}

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Segera Hadir</Text>
        <Text style={styles.helperText}>Kami siapkan ruang untuk fitur baru berikutnya seperti laporan lanjutan, bantuan, dan pengembangan operasional lainnya.</Text>
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  menuItemPressed: {
    opacity: 0.88,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  menuLabel: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
});