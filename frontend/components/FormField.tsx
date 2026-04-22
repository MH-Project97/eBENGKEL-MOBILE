import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors, spacing, typography } from "../lib/theme";

type FormFieldProps = TextInputProps & {
  label: string;
  testID?: string;
};

export function FormField({ label, multiline, style, testID, ...props }: FormFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.multiline, style]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 56,
    backgroundColor: colors.background,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: typography.bodyMedium,
    fontSize: 16,
  },
  multiline: {
    minHeight: 110,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
});