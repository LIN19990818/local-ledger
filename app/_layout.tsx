import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppStore } from '../src/store';
import { initDatabase } from '../src/database/init';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  const { isInitialized, isLoading, initialize } = useAppStore();

  useEffect(() => {
    const init = async () => {
      await initDatabase();
      await initialize();
    };
    init();
  }, []);

  if (isLoading || !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/[id]" />
        <Stack.Screen name="transaction/add" />
        <Stack.Screen name="category/manage" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/security" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen name="statistics/index" />
        <Stack.Screen name="statistics/detail" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.light
  }
});
