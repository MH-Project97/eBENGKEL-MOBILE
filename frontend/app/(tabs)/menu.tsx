import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

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
    title: "Preferensi",
    items: [
      { label: "Pengaturan", route: "/settings" as Href, icon: "settings-outline" as const },
      { label: "Tentang", route: "/about" as Href, icon: "information-circle-outline" as const },
    ],
  },
];

export default function MenuScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1080;

  const toMenuTestID = (label: string) => `menu-item-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <ScreenShell title="" subtitle="" hideHeader contentMaxWidth={980}>
      {menuSections.map((section) => (
        <SurfaceCard key={section.title}>
          <Text style={styles.sectionTitle} testID={`menu-section-${section.title.toLowerCase()}`}>
            {section.title}
          </Text>
          <View style={styles.gridWrap}>
            {section.items.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.route)}
                testID={toMenuTestID(item.label)}
                style={({ pressed }) => [styles.gridItem, isDesktop && styles.gridItemDesktop, pressed && styles.menuItemPressed]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={28} color={colors.text} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </SurfaceCard>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 20,
    marginBottom: spacing.md,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  menuItemPressed: {
    opacity: 0.88,
  },
  gridItem: {
    width: "47%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  gridItemDesktop: {
    width: "31.5%",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  menuLabel: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 16,
    textAlign: "center",
  },
});