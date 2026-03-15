import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../../src/theme/colors';
import { formatCurrency, showAlert } from '../../src/utils/helpers';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { TransactionRepository, CategoryRepository, AccountRepository, BudgetRepository, SettingsRepository } from '../../src/database/repository';
import { format } from 'date-fns';
import { Platform } from 'react-native';
import { Transaction, Category, Account, Settings } from '../../src/types';
import { PasswordModal } from '../../src/components/PasswordModal';

export default function SettingsScreen() {
  const router = useRouter();
  const { account, budget, settings, updateAccount, updateSettings, setBudget, refreshCategories, categories, initialize } = useAppStore();
  
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showLargeAmountModal, setShowLargeAmountModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showVerifyOldPasswordModal, setShowVerifyOldPasswordModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('');
  const [largeAmountThreshold, setLargeAmountThreshold] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (budget) {
      setBudgetAmount(String(budget.amount));
    }
  }, [budget]);

  const handleSetBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('错误', '请输入有效金额');
      return;
    }
    
    const month = format(new Date(), 'yyyy-MM');
    await setBudget(month, amount);
    setShowBudgetModal(false);
    showAlert('成功', `已设置本月预算为 ${formatCurrency(amount)}`);
  };

  const handleSetWarningThreshold = async () => {
    const warning = parseFloat(warningThreshold);
    
    if (isNaN(warning) || warning < 0) {
      showAlert('错误', '请输入有效的余额预警值');
      return;
    }
    
    await updateAccount({ warningThreshold: warning });
    setShowWarningModal(false);
    setWarningThreshold('');
    showAlert('成功', '余额预警阈值已更新');
  };

  const handleSetLargeAmountThreshold = async () => {
    const large = parseFloat(largeAmountThreshold);
    
    if (isNaN(large) || large <= 0) {
      showAlert('错误', '请输入有效的大额阈值');
      return;
    }
    
    await updateAccount({ largeAmountThreshold: large });
    setShowLargeAmountModal(false);
    setLargeAmountThreshold('');
    showAlert('成功', '大额确认阈值已更新');
  };

  const handleSetBalance = async () => {
    const balance = parseFloat(balanceAmount);
    
    if (isNaN(balance) || balance < 0) {
      showAlert('错误', '请输入有效金额');
      return;
    }
    
    await updateAccount({ balance });
    setShowBalanceModal(false);
    setBalanceAmount('');
    showAlert('成功', `当前余额已设置为 ${formatCurrency(balance)}`);
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 4) {
      showAlert('错误', '密码长度至少4位');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      return;
    }
    
    await updateSettings({ operationPassword: newPassword });
    setShowSetPasswordModal(false);
    setNewPassword('');
    setConfirmPassword('');
    setOldPassword('');
    setPasswordError(false);
    showAlert('成功', '操作密码已设置');
  };

  const handleVerifyOldPassword = (password: string) => {
    if (password === settings?.operationPassword) {
      setShowVerifyOldPasswordModal(false);
      setPasswordError(false);
      setShowSetPasswordModal(true);
    } else {
      setPasswordError(true);
    }
  };

  const openSetPasswordModal = () => {
    if (settings?.operationPassword) {
      setShowVerifyOldPasswordModal(true);
    } else {
      setShowSetPasswordModal(true);
    }
  };

  const verifyPasswordAndExecute = (action: () => void) => {
    if (!settings?.operationPassword) {
      action();
      return;
    }
    
    setPendingAction(() => action);
    setShowPasswordModal(true);
  };

  const handlePasswordConfirm = (password: string) => {
    if (password === settings?.operationPassword) {
      setShowPasswordModal(false);
      setPasswordError(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setPasswordError(true);
    }
  };

  const openBalanceModal = () => {
    verifyPasswordAndExecute(() => {
      setBalanceAmount(String(account?.balance || 0));
      setShowBalanceModal(true);
    });
  };

  const handleExportData = async () => {
    try {
      console.log('开始导出数据...');
      console.log('Platform.OS:', Platform.OS);
      
      const transactions = await TransactionRepository.getAll();
      console.log('获取到交易记录:', transactions.length);
      
      const categoriesData = await CategoryRepository.getAll();
      console.log('获取到分类:', categoriesData.length);
      
      const accountData = await AccountRepository.get();
      console.log('获取到账户:', accountData ? 'yes' : 'no');
      
      const settingsData = await SettingsRepository.get();
      console.log('获取到设置:', settingsData ? 'yes' : 'no');
      
      if (transactions.length === 0) {
        showAlert('提示', '暂无数据可导出');
        return;
      }
      
      const exportData = {
        version: '1.0.5',
        exportedAt: Date.now(),
        transactions,
        categories: categoriesData,
        account: accountData,
        settings: settingsData
      };
      
      const fileName = `ledger_backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
      console.log('文件名:', fileName);
      
      const content = JSON.stringify(exportData, null, 2);
      console.log('JSON内容长度:', content.length);
      
      if (Platform.OS === 'web') {
        console.log('使用Web方式导出...');
        try {
          const blob = new Blob([content], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          showAlert('导出成功', `已导出 ${transactions.length} 条记录`);
        } catch (webError) {
          console.error('Web export error:', webError);
          showAlert('导出失败', `文件下载失败: ${webError instanceof Error ? webError.message : '未知错误'}`);
        }
      } else {
        console.log('使用原生方式导出...');
        
        const cacheDir = FileSystem.cacheDirectory;
        const docDir = FileSystem.documentDirectory;
        
        console.log('cacheDirectory:', cacheDir);
        console.log('documentDirectory:', docDir);
        
        let baseDir = cacheDir || docDir;
        
        if (!baseDir) {
          showAlert('导出失败', '无法获取存储目录\n请确保应用有存储权限');
          return;
        }
        
        const filePath = `${baseDir}${fileName}`;
        console.log('文件路径:', filePath);
        
        try {
          await FileSystem.writeAsStringAsync(filePath, content, {
            encoding: FileSystem.EncodingType.UTF8
          });
          
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          console.log('文件信息:', fileInfo);
          
          if (await Sharing.isAvailableAsync()) {
            console.log('开始分享...');
            await Sharing.shareAsync(filePath, {
              mimeType: 'application/json',
              dialogTitle: '导出数据备份',
              UTI: 'public.json'
            });
            console.log('分享完成');
          } else {
            showAlert('导出成功', `文件已保存到:\n${filePath}`);
          }
        } catch (writeError) {
          console.error('写入文件错误:', writeError);
          showAlert('导出失败', `写入文件失败:\n${writeError instanceof Error ? writeError.message : '未知错误'}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error('Error stack:', errorStack);
      showAlert('导出失败', `数据导出过程中出现错误: ${errorMessage}`);
    }
  };

  const handleExportCSV = async () => {
    try {
      const transactions = await TransactionRepository.getAll();
      
      if (transactions.length === 0) {
        showAlert('提示', '暂无数据可导出');
        return;
      }
      
      const headers = ['日期', '类型', '分类', '金额', '备注', '标签'];
      const rows = transactions.map(t => [
        format(new Date(t.date), 'yyyy-MM-dd HH:mm'),
        t.type === 'income' ? '收入' : '支出',
        t.categoryName,
        t.amount.toFixed(2),
        t.note || '',
        t.tags?.join(';') || ''
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const fileName = `ledger_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      
      if (Platform.OS === 'web') {
        try {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          showAlert('导出成功', 'CSV文件已下载');
        } catch (webError) {
          console.error('CSV export error:', webError);
          showAlert('导出失败', 'CSV文件下载失败，请重试');
        }
      } else {
        let cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) {
          cacheDir = FileSystem.documentDirectory;
        }
        
        if (!cacheDir) {
          showAlert('导出失败', '无法获取存储目录\n请确保应用有存储权限');
          return;
        }
        
        const filePath = `${cacheDir}${fileName}`;
        
        try {
          await FileSystem.writeAsStringAsync(filePath, csvContent, {
            encoding: FileSystem.EncodingType.UTF8
          });
          
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filePath, {
              mimeType: 'text/csv',
              dialogTitle: '导出CSV文件',
              UTI: 'public.comma-separated-values-text'
            });
          } else {
            showAlert('导出成功', `文件已保存到:\n${filePath}`);
          }
        } catch (writeError) {
          console.error('CSV写入文件错误:', writeError);
          showAlert('导出失败', `写入文件失败:\n${writeError instanceof Error ? writeError.message : '未知错误'}`);
        }
      }
    } catch (error) {
      console.error('CSV export error:', error);
      showAlert('导出失败', 'CSV导出过程中出现错误');
    }
  };

  const handleClearData = () => {
    showAlert(
      '清除数据',
      '确定要清除所有数据吗？此操作不可恢复！',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS === 'web') {
                const { clearAllData } = await import('../../src/database/webStorage');
                await clearAllData();
              } else {
                const { getNativeDatabase } = await import('../../src/database/native');
                const db = getNativeDatabase();
                await db.execAsync(`
                  DELETE FROM transactions;
                  DELETE FROM budgets;
                `);
                await AccountRepository.update({ balance: 0 });
              }
              await initialize();
              showAlert('成功', '数据已清除');
            } catch (error) {
              console.error('Clear data error:', error);
              showAlert('错误', '清除数据失败');
            }
          }
        }
      ]
    );
  };

  const handleImportData = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          
          try {
            const text = await file.text();
            const importData = JSON.parse(text);
            await processImportData(importData);
          } catch (error) {
            console.error('Import error:', error);
            showAlert('导入失败', '文件格式错误或文件损坏');
          }
        };
        
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true
        });
        
        if (result.canceled || !result.assets?.[0]) return;
        
        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);
        const importData = JSON.parse(content);
        await processImportData(importData);
      }
    } catch (error) {
      console.error('Import error:', error);
      showAlert('导入失败', '数据导入过程中出现错误');
    }
  };

  const processImportData = async (importData: {
    version: string;
    exportedAt: number;
    transactions: Transaction[];
    categories: Category[];
    account: Account;
    settings: Settings;
  }) => {
    if (!importData.version || !importData.transactions) {
      showAlert('导入失败', '无效的备份文件格式');
      return;
    }

    showAlert(
      '导入数据',
      `检测到 ${importData.transactions.length} 条交易记录，是否覆盖当前数据？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '覆盖导入',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS === 'web') {
                const { clearAllData } = await import('../../src/database/webStorage');
                await clearAllData();
                
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                const STORAGE_KEYS = {
                  TRANSACTIONS: 'ledger_transactions',
                  CATEGORIES: 'ledger_categories',
                  ACCOUNT: 'ledger_account',
                  SETTINGS: 'ledger_settings'
                };
                
                if (importData.transactions && importData.transactions.length > 0) {
                  await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(importData.transactions));
                }
                
                if (importData.categories && importData.categories.length > 0) {
                  await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(importData.categories));
                }
                
                if (importData.account) {
                  await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify(importData.account));
                }
                
                if (importData.settings) {
                  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(importData.settings));
                }
              } else {
                const { getNativeDatabase } = await import('../../src/database/native');
                const db = getNativeDatabase();
                
                await db.execAsync('DELETE FROM transactions');
                await db.execAsync('DELETE FROM budgets');
                
                for (const t of importData.transactions) {
                  await db.runAsync(
                    `INSERT INTO transactions (id, amount, type, categoryId, categoryName, categoryIcon, date, note, tags, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [t.id, t.amount, t.type, t.categoryId, t.categoryName, t.categoryIcon, t.date, t.note || '', t.tags ? JSON.stringify(t.tags) : '[]', t.createdAt, t.updatedAt]
                  );
                }
                
                if (importData.account) {
                  await db.runAsync(
                    `UPDATE accounts SET balance = ?, warningThreshold = ?, largeAmountThreshold = ?, updatedAt = ? WHERE id = 'default'`,
                    [importData.account.balance, importData.account.warningThreshold || 100, importData.account.largeAmountThreshold || 500, Date.now()]
                  );
                }
              }
              
              await initialize();
              showAlert('导入成功', `已成功导入 ${importData.transactions.length} 条交易记录`);
            } catch (error) {
              console.error('Import process error:', error);
              showAlert('导入失败', '数据处理过程中出现错误');
            }
          }
        }
      ]
    );
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    rightComponent?: React.ReactNode,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress && !rightComponent}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon as any} size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (onPress && <Ionicons name="chevron-forward" size={20} color={colors.text.secondary.light} />)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账户设置</Text>
          
          {renderSettingItem(
            'wallet',
            '当前余额',
            `${formatCurrency(account?.balance || 0)}（点击修改）`,
            undefined,
            openBalanceModal
          )}
          
          {renderSettingItem(
            'lock-closed',
            '操作密码',
            settings?.operationPassword ? '已设置（点击修改）' : '点击设置',
            undefined,
            openSetPasswordModal
          )}
          
          {renderSettingItem(
            'pie-chart',
            '月度预算',
            budget ? formatCurrency(budget.amount) : '点击设置',
            undefined,
            () => {
              setBudgetAmount(budget ? String(budget.amount) : '');
              setShowBudgetModal(true);
            }
          )}
          
          {renderSettingItem(
            'warning',
            '余额预警阈值',
            `低于 ${formatCurrency(account?.warningThreshold || 100)} 时提醒`,
            undefined,
            () => {
              setWarningThreshold(String(account?.warningThreshold || 100));
              setShowWarningModal(true);
            }
          )}
          
          {renderSettingItem(
            'alert-circle',
            '大额确认阈值',
            `超过 ${formatCurrency(account?.largeAmountThreshold || 500)} 时需确认`,
            undefined,
            () => {
              setLargeAmountThreshold(String(account?.largeAmountThreshold || 500));
              setShowLargeAmountModal(true);
            }
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据管理</Text>
          
          {renderSettingItem(
            'download',
            '导出数据',
            '导出所有账单数据为JSON文件',
            undefined,
            handleExportData
          )}
          
          {renderSettingItem(
            'cloud-upload',
            '导入数据',
            '从备份文件恢复数据',
            undefined,
            handleImportData
          )}
          
          {renderSettingItem(
            'document-text',
            '导出CSV',
            '导出账单为CSV表格文件',
            undefined,
            handleExportCSV
          )}
          
          {renderSettingItem(
            'trash',
            '清除数据',
            '删除所有账单记录',
            undefined,
            handleClearData
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>分类管理</Text>
          
          {renderSettingItem(
            'list',
            '管理分类',
            `共 ${categories.length} 个分类`,
            undefined,
            () => router.push('/category/manage')
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>记账打卡</Text>
          
          <View style={styles.streakCard}>
            <View style={styles.streakInfo}>
              <Ionicons name="flame" size={32} color={colors.warning} />
              <View>
                <Text style={styles.streakTitle}>连续记账</Text>
                <Text style={styles.streakDays}>{settings?.streakDays || 0} 天</Text>
              </View>
            </View>
            <View style={styles.streakRewards}>
              <View style={[styles.rewardBadge, settings?.unlockedThemes?.includes('bronze') && styles.rewardUnlocked]}>
                <Text style={styles.rewardText}>7天</Text>
              </View>
              <View style={[styles.rewardBadge, settings?.unlockedThemes?.includes('gold') && styles.rewardUnlocked]}>
                <Text style={styles.rewardText}>30天</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          
          {renderSettingItem(
            'information-circle',
            '版本',
            '1.0.7'
          )}
          
          {renderSettingItem(
            'heart',
            '本地记账本',
            '纯本地存储，无需网络，保护隐私'
          )}
          
          {renderSettingItem(
            'bug',
            '错误日志',
            '查看应用错误记录',
            undefined,
            () => router.push('/error-log')
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showBudgetModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置月度预算</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="输入预算金额"
              placeholderTextColor={colors.text.secondary.light}
              keyboardType="decimal-pad"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowBudgetModal(false);
                  setBudgetAmount('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSetBudget}
              >
                <Text style={styles.modalButtonConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWarningModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置余额预警阈值</Text>
            <Text style={styles.modalLabel}>当余额低于此值时会收到提醒</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="输入预警金额"
              placeholderTextColor={colors.text.secondary.light}
              keyboardType="decimal-pad"
              value={warningThreshold}
              onChangeText={setWarningThreshold}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowWarningModal(false);
                  setWarningThreshold('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSetWarningThreshold}
              >
                <Text style={styles.modalButtonConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLargeAmountModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLargeAmountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置大额确认阈值</Text>
            <Text style={styles.modalLabel}>当金额超过此值时需要二次确认</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="输入大额阈值"
              placeholderTextColor={colors.text.secondary.light}
              keyboardType="decimal-pad"
              value={largeAmountThreshold}
              onChangeText={setLargeAmountThreshold}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowLargeAmountModal(false);
                  setLargeAmountThreshold('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSetLargeAmountThreshold}
              >
                <Text style={styles.modalButtonConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBalanceModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBalanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置当前余额</Text>
            <Text style={styles.modalLabel}>直接设置您的存款余额</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="输入当前余额"
              placeholderTextColor={colors.text.secondary.light}
              keyboardType="decimal-pad"
              value={balanceAmount}
              onChangeText={setBalanceAmount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowBalanceModal(false);
                  setBalanceAmount('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSetBalance}
              >
                <Text style={styles.modalButtonConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PasswordModal
        visible={showPasswordModal}
        title="验证密码"
        message="请输入操作密码以继续"
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordError(false);
          setPendingAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        isError={passwordError}
        errorMessage="密码错误，请重试"
      />

      <PasswordModal
        visible={showVerifyOldPasswordModal}
        title="验证原密码"
        message="请输入原密码以设置新密码"
        onClose={() => {
          setShowVerifyOldPasswordModal(false);
          setPasswordError(false);
        }}
        onConfirm={handleVerifyOldPassword}
        isError={passwordError}
        errorMessage="密码错误，请重试"
      />

      <Modal
        visible={showSetPasswordModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSetPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>设置操作密码</Text>
            <Text style={styles.modalLabel}>设置密码后，修改余额和交易需要验证</Text>
            
            <Text style={styles.inputLabel}>新密码</Text>
            <TextInput
              style={[styles.modalInput, passwordError && styles.inputError]}
              placeholder="输入4-6位数字密码"
              placeholderTextColor={colors.text.secondary.light}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setPasswordError(false);
              }}
            />
            
            <Text style={styles.inputLabel}>确认密码</Text>
            <TextInput
              style={[styles.modalInput, passwordError && styles.inputError]}
              placeholder="再次输入密码"
              placeholderTextColor={colors.text.secondary.light}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setPasswordError(false);
              }}
            />
            
            {passwordError && (
              <Text style={styles.errorText}>两次密码输入不一致</Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowSetPasswordModal(false);
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError(false);
                }}
              >
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSetPassword}
              >
                <Text style={styles.modalButtonConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.md
  },
  section: {
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary.light,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  settingTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  settingSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginTop: 2
  },
  streakCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface.light,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  streakTitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary.light,
    marginLeft: spacing.md
  },
  streakDays: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.warning,
    marginLeft: spacing.md
  },
  streakRewards: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  rewardBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border.light
  },
  rewardUnlocked: {
    backgroundColor: colors.warning
  },
  rewardText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: colors.background.light,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light,
    textAlign: 'center',
    marginBottom: spacing.md
  },
  modalLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  modalInput: {
    fontSize: fontSize.lg,
    color: colors.text.primary.light,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center'
  },
  modalButtonCancel: {
    backgroundColor: colors.surface.light
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary
  },
  modalButtonCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  modalButtonConfirmText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: '#FFFFFF'
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light,
    marginBottom: spacing.xs,
    marginTop: spacing.sm
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.danger
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs
  }
});
