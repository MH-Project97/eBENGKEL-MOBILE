import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, spacing } from "../lib/theme";

type SurfaceCardProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function SurfaceCard({ children, style }: SurfaceCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
});