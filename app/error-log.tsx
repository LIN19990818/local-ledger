import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../src/theme/colors';

interface ErrorLog {
  timestamp: number;
  message: string;
  stack?: string;
  component?: string;
}

const ERROR_LOG_KEY = 'ledger_error_logs';

export default function ErrorLogScreen() {
  const router = useRouter();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);

  useEffect(() => {
    loadErrorLogs();
  }, []);

  const loadErrorLogs = async () => {
    try {
      const logs = await AsyncStorage.getItem(ERROR_LOG_KEY);
      if (logs) {
        setErrorLogs(JSON.parse(logs));
      }
    } catch (error) {
      console.error('Failed to load error logs:', error);
    }
  };

  const clearLogs = async () => {
    try {
      await AsyncStorage.removeItem(ERROR_LOG_KEY);
      setErrorLogs([]);
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderErrorItem = ({ item }: { item: ErrorLog }) => (
    <View style={styles.errorItem}>
      <View style={styles.errorHeader}>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <Text style={styles.errorTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <Text style={styles.errorMessage}>{item.message}</Text>
      {item.component && (
        <Text style={styles.errorComponent}>组件: {item.component}</Text>
      )}
      {item.stack && (
        <ScrollView horizontal style={styles.errorStackContainer}>
          <Text style={styles.errorStack}>{item.stack}</Text>
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary.light} />
        </TouchableOpacity>
        <Text style={styles.title}>错误日志</Text>
        {errorLogs.length > 0 && (
          <TouchableOpacity onPress={clearLogs} style={styles.clearButton}>
            <Ionicons name="trash" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {errorLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.emptyText}>暂无错误记录</Text>
          <Text style={styles.emptyHint}>应用运行正常</Text>
        </View>
      ) : (
        <FlatList
          data={errorLogs}
          keyExtractor={(item, index) => `${item.timestamp}_${index}`}
          renderItem={renderErrorItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.light
  },
  backButton: {
    marginRight: spacing.md
  },
  title: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light
  },
  clearButton: {
    padding: spacing.sm
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl
  },
  emptyText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light,
    marginTop: spacing.lg
  },
  emptyHint: {
    fontSize: fontSize.md,
    color: colors.text.secondary.light,
    marginTop: spacing.sm
  },
  listContent: {
    padding: spacing.md
  },
  errorItem: {
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  errorTime: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginLeft: spacing.sm
  },
  errorMessage: {
    fontSize: fontSize.md,
    color: colors.text.primary.light,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm
  },
  errorComponent: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginBottom: spacing.sm
  },
  errorStackContainer: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    maxHeight: 150
  },
  errorStack: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light,
    fontFamily: 'monospace'
  }
});
