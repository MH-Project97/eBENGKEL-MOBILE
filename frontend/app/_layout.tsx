import "react-native-reanimated";

import { Figtree_400Regular, Figtree_500Medium, Figtree_700Bold } from "@expo-google-fonts/figtree";
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "../context/AuthContext";
import { colors } from "../lib/theme";

function RootNavigator() {
  const { session, initializing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (initializing) {
      return;
    }

    const inAuthRoute = pathname === "/login" || pathname === "/register";
    if (!session && !inAuthRoute) {
      router.replace("/login" as Href);
      return;
    }

    if (session && (inAuthRoute || pathname === "/")) {
      router.replace("/dashboard" as Href);
    }
  }, [initializing, pathname, router, session]);

  if (initializing) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    OutfitSemiBold: Outfit_600SemiBold,
    OutfitBold: Outfit_700Bold,
    FigtreeRegular: Figtree_400Regular,
    FigtreeMedium: Figtree_500Medium,
    FigtreeBold: Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});