import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, spacing, typography } from "../lib/theme";

type ActionButtonProps = PropsWithChildren<{
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
}>;

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  compact,
  children,
  testID,
}: ActionButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 120 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compact,
          isPrimary && styles.primary,
          variant === "secondary" && styles.secondary,
          isDanger && styles.danger,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <View style={styles.content}>
          {children}
          <Text
            style={[
              styles.label,
              isPrimary && styles.primaryLabel,
              isDanger && styles.primaryLabel,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderWidth: 2,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: "transparent",
    borderColor: colors.black,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.95,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontFamily: typography.bodyBold,
    fontSize: 15,
  },
  primaryLabel: {
    color: colors.surface,
  },
});