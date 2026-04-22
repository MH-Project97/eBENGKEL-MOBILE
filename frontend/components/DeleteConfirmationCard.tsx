import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../lib/theme";
import { ActionButton } from "./ActionButton";
import { FormField } from "./FormField";
import { SurfaceCard } from "./SurfaceCard";

type DeleteConfirmationCardProps = {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  testIDPrefix: string;
};

export function DeleteConfirmationCard({
  title,
  description,
  onCancel,
  onConfirm,
  loading,
  testIDPrefix,
}: DeleteConfirmationCardProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const isMatch = confirmationText.trim().toUpperCase() === "HAPUS";

  return (
    <SurfaceCard>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <FormField
        label="Ketik HAPUS untuk konfirmasi"
        value={confirmationText}
        onChangeText={setConfirmationText}
        autoCapitalize="characters"
        testID={`${testIDPrefix}-confirm-input`}
      />
      <View style={styles.actions}>
        <ActionButton label="Batal" onPress={onCancel} variant="secondary" testID={`${testIDPrefix}-cancel-button`} />
        <ActionButton
          label={loading ? "Menghapus..." : "Hapus sekarang"}
          onPress={() => void onConfirm()}
          disabled={!isMatch || loading}
          variant="danger"
          testID={`${testIDPrefix}-confirm-button`}
        />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontFamily: typography.headingBold,
    fontSize: 18,
  },
  description: {
    color: colors.textMuted,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
  },
});