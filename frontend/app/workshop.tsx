import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { FormField } from "../components/FormField";
import { ScreenShell } from "../components/ScreenShell";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { colors, typography } from "../lib/theme";

const emptyWorkshop = {
  workshop_name: "",
  owner_name: "",
  phone: "",
  address: "",
  open_hours: "",
  notes: "",
};

export default function WorkshopScreen() {
  const { session } = useAuth();
  const [form, setForm] = useState(emptyWorkshop);
  const [info, setInfo] = useState("");

  const loadWorkshop = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    const response = await api.getWorkshop(session.token);
    setForm({
      workshop_name: response.workshop_name,
      owner_name: response.owner_name,
      phone: response.phone,
      address: response.address,
      open_hours: response.open_hours,
      notes: response.notes,
    });
  }, [session?.token]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkshop();
    }, [loadWorkshop]),
  );

  const updateField = (field: keyof typeof emptyWorkshop, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveWorkshop = async () => {
    if (!session?.token) {
      return;
    }

    await api.updateWorkshop(session.token, form);
    setInfo("Data bengkel berhasil diperbarui.");
  };

  return (
    <ScreenShell title="Detail Bengkel" subtitle="Simpan profil bengkel untuk dipakai di transaksi dan operasional." backButton>
      <SurfaceCard>
        <FormField label="Nama bengkel" value={form.workshop_name} onChangeText={(value) => updateField("workshop_name", value)} testID="workshop-name-input" />
        <FormField label="Nama pemilik" value={form.owner_name} onChangeText={(value) => updateField("owner_name", value)} testID="workshop-owner-input" />
        <FormField label="Nomor telepon" value={form.phone} onChangeText={(value) => updateField("phone", value)} keyboardType="phone-pad" testID="workshop-phone-input" />
        <FormField label="Alamat" value={form.address} onChangeText={(value) => updateField("address", value)} multiline testID="workshop-address-input" />
        <FormField label="Jam operasional" value={form.open_hours} onChangeText={(value) => updateField("open_hours", value)} testID="workshop-hours-input" />
        <FormField label="Catatan bengkel" value={form.notes} onChangeText={(value) => updateField("notes", value)} multiline testID="workshop-notes-input" />
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <ActionButton label="Simpan detail bengkel" onPress={() => void saveWorkshop()} testID="workshop-save-button" />
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  info: {
    color: colors.success,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
});