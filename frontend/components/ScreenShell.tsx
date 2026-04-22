import { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, typography } from "../lib/theme";
import { ActionButton } from "./ActionButton";

type ScreenShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  backButton?: boolean;
  headerAction?: ReactNode;
  hideHeader?: boolean;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function ScreenShell({
  title,
  subtitle,
  backButton,
  headerAction,
  hideHeader,
  scrollable = true,
  contentStyle,
  children,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mergedContentStyle = [
    styles.content,
    { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
    !scrollable && styles.contentFill,
    contentStyle,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        {scrollable ? (
          <ScrollView
            contentContainerStyle={mergedContentStyle}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {hideHeader ? null : (
              <View style={styles.headerRow}>
                <View style={styles.headerTextWrapper}>
                  {backButton ? (
                    <ActionButton
                      label="Kembali"
                      compact
                      onPress={() => router.back()}
                      variant="secondary"
                    >
                      <Ionicons name="arrow-back" size={16} color={colors.text} />
                    </ActionButton>
                  ) : null}
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
              </View>
            )}
            {children}
          </ScrollView>
        ) : (
          <View style={mergedContentStyle}>
            {hideHeader ? null : (
              <View style={styles.headerRow}>
                <View style={styles.headerTextWrapper}>
                  {backButton ? (
                    <ActionButton
                      label="Kembali"
                      compact
                      onPress={() => router.back()}
                      variant="secondary"
                    >
                      <Ionicons name="arrow-back" size={16} color={colors.text} />
                    </ActionButton>
                  ) : null}
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
              </View>
            )}
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  contentFill: {
    flex: 1,
  },
  headerRow: {
    gap: spacing.md,
  },
  headerTextWrapper: {
    gap: spacing.sm,
  },
  headerAction: {
    alignSelf: "flex-start",
  },
  title: {
    color: colors.text,
    fontFamily: typography.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
});