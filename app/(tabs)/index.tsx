import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Pressable,
  RefreshControl,
  Dimensions,
  LinearGradient as LinearGradientType
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../../src/theme/colors';
import { formatCurrency, formatDate, validateAmount, checkBalanceWarning, checkBudgetWarning, parseAmountFromText, getDateRange, showAlert } from '../../src/utils/helpers';
import { Transaction, Category } from '../../src/types';
import { format, subDays, isToday, isYesterday, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

interface TodayStats {
  income: number;
  expense: number;
  count: number;
}

interface MonthStats {
  income: number;
  expense: number;
  count: number;
}

interface DailyExpense {
  date: Date;
  expense: number;
  income: number;
  count: number;
}

export default function HomeScreen() {
  const { account, categories, budget, quickAmounts, addTransaction, updateAccount, settings, transactions, refreshTransactions, refreshAccount, refreshBudget, isInitialized } = useAppStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showQuickAmounts, setShowQuickAmounts] = useState(false);
  
  const [balanceAnim] = useState(new Animated.Value(1));
  const [balanceColor, setBalanceColor] = useState('#FFFFFF');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState<TodayStats>({ income: 0, expense: 0, count: 0 });
  const [monthStats, setMonthStats] = useState<MonthStats>({ income: 0, expense: 0, count: 0 });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [calendarData, setCalendarData] = useState<Map<string, DailyExpense>>(new Map());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const isBalanceWarning = account ? checkBalanceWarning(account.balance, account.warningThreshold) : false;
  const budgetWarning = budget ? checkBudgetWarning(budget.spent, budget.amount) : { level: 'safe' as const };

  const filteredCategories = categories.filter(c => c.type === transactionType);

  const suggestCategoryByText = (text: string, categoryList: Category[]): Category | null => {
    const keywords: Record<string, string[]> = {
      '餐饮': ['餐', '吃', '饭', '外卖', '奶茶', '咖啡', '早餐', '午餐', '晚餐', '夜宵', '零食', '饮料', '水果', '美食'],
      '交通': ['交通', '地铁', '公交', '打车', '滴滴', '出租', '加油', '停车', '高铁', '火车', '飞机', '出行'],
      '购物': ['购物', '买', '淘宝', '京东', '超市', '衣服', '鞋', '包', '网购'],
      '娱乐': ['娱乐', '电影', '游戏', 'KTV', '酒吧', '演唱会', '休闲'],
      '医疗': ['医疗', '药', '医院', '看病', '体检', '挂号'],
      '教育': ['教育', '学习', '课程', '书', '培训', '学费'],
      '住房': ['房租', '水电', '物业', '维修', '房租'],
      '通讯': ['话费', '流量', '宽带', '充值', '手机'],
      '工资': ['工资', '薪水', '薪资', '收入'],
      '奖金': ['奖金', '年终', '提成', '分红'],
      '投资': ['投资', '理财', '股', '基金', '利息'],
      '兼职': ['兼职', '外快', '副业'],
      '报销': ['报销', '退款', '返还']
    };
    
    const lowerText = text.toLowerCase();
    
    for (const [categoryName, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (lowerText.includes(word)) {
          const matchedCategory = categoryList.find(c => 
            c.name.includes(categoryName) || categoryName.includes(c.name)
          );
          if (matchedCategory) {
            return matchedCategory;
          }
        }
      }
    }
    
    return null;
  };

  useEffect(() => {
    if (filteredCategories.length > 0) {
      setSelectedCategory(filteredCategories[0]);
    }
  }, [transactionType]);

  useEffect(() => {
    loadTodayStats();
    loadMonthStats();
    loadRecentTransactions();
    loadCalendarData();
  }, [transactions]);

  const loadCalendarData = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthRange = getDateRange('month');
    
    const dailyMap = new Map<string, DailyExpense>();
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      if (t.date >= monthRange.start && t.date <= monthRange.end) {
        const dateKey = format(date, 'yyyy-MM-dd');
        const existing = dailyMap.get(dateKey) || { date, expense: 0, income: 0, count: 0 };
        
        if (t.type === 'expense') {
          existing.expense += t.amount;
        } else {
          existing.income += t.amount;
        }
        existing.count++;
        
        dailyMap.set(dateKey, existing);
      }
    });
    
    setCalendarData(dailyMap);
  };

  const loadTodayStats = async () => {
    const todayRange = getDateRange('day');
    const todayTransactions = transactions.filter(t => 
      t.date >= todayRange.start && t.date <= todayRange.end
    );
    
    const income = todayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = todayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    setTodayStats({ income, expense, count: todayTransactions.length });
  };

  const loadMonthStats = async () => {
    const monthRange = getDateRange('month');
    const monthTransactions = transactions.filter(t => 
      t.date >= monthRange.start && t.date <= monthRange.end
    );
    
    const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    setMonthStats({ income, expense, count: monthTransactions.length });
  };

  const loadRecentTransactions = () => {
    const sorted = [...transactions].sort((a, b) => b.date - a.date);
    setRecentTransactions(sorted.slice(0, 5));
  };

  const changeMonth = (delta: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setCurrentMonth(newMonth);
  };

  const getSelectedDateExpense = (): number => {
    if (!selectedDate) return 0;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return calendarData.get(dateKey)?.expense || 0;
  };

  const getSelectedDateIncome = (): number => {
    if (!selectedDate) return 0;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return calendarData.get(dateKey)?.income || 0;
  };

  const getExpenseColor = (expense: number): string => {
    if (expense === 0) return 'transparent';
    if (expense < 50) return 'rgba(239, 68, 68, 0.2)';
    if (expense < 200) return 'rgba(239, 68, 68, 0.4)';
    if (expense < 500) return 'rgba(239, 68, 68, 0.6)';
    return 'rgba(239, 68, 68, 0.8)';
  };

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    
    const dayElements: JSX.Element[] = [];
    
    for (let i = 0; i < startDay; i++) {
      dayElements.push(
        <View key={`empty-${i}`} style={styles.calendarDayEmpty} />
      );
    }
    
    days.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayData = calendarData.get(dateKey);
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      const isCurrentDay = isToday(day);
      const hasExpense = dayData && dayData.expense > 0;
      
      dayElements.push(
        <TouchableOpacity
          key={dateKey}
          style={[
            styles.calendarDay,
            isSelected && styles.calendarDaySelected,
            isCurrentDay && !isSelected && styles.calendarDayToday
          ]}
          onPress={() => setSelectedDate(day)}
        >
          <Text style={[
            styles.calendarDayText,
            isSelected && styles.calendarDayTextSelected,
            isCurrentDay && !isSelected && { color: colors.primary }
          ]}>
            {format(day, 'd')}
          </Text>
          {hasExpense && (
            <View style={[
              styles.calendarExpenseDot,
              { backgroundColor: getExpenseColor(dayData.expense) }
            ]} />
          )}
          {dayData && dayData.count > 0 && (
            <Text style={styles.calendarDayCount}>{dayData.count}</Text>
          )}
        </TouchableOpacity>
      );
    });
    
    return dayElements;
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshAccount(),
        refreshBudget(),
        refreshTransactions()
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const animateBalance = (type: 'income' | 'expense') => {
    Animated.sequence([
      Animated.timing(balanceAnim, {
        toValue: type === 'income' ? 1.1 : 0.9,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(balanceAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();

    setBalanceColor(type === 'income' ? colors.successLight : colors.dangerLight);
    setTimeout(() => setBalanceColor('#FFFFFF'), 1000);
  };

  const showNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleAmountChange = (text: string) => {
    setAmount(text);
    
    const parsed = parseAmountFromText(text);
    if (parsed) {
      setAmount(parsed.amount.toString());
      if (parsed.note) {
        setNote(parsed.note);
      }
    }
    
    const suggestedCategory = suggestCategoryByText(text, categories);
    if (suggestedCategory) {
      setSelectedCategory(suggestedCategory);
      setTransactionType(suggestedCategory.type);
    } else {
      const otherCategory = categories.find(c => 
        c.type === transactionType && c.name.includes('其他')
      );
      if (otherCategory) {
        setSelectedCategory(otherCategory);
      }
    }
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    
    if (!numAmount || numAmount <= 0) {
      showAlert('错误', '请输入有效金额');
      return;
    }

    if (!selectedCategory) {
      showAlert('错误', '请选择分类');
      return;
    }

    if (account) {
      const validation = validateAmount(numAmount, account.balance, transactionType);
      if (!validation.valid) {
        showAlert('无法完成操作', validation.message);
        return;
      }

      if (numAmount >= account.largeAmountThreshold) {
        showAlert(
          '大额确认',
          `这是一笔${transactionType === 'income' ? '收入' : '支出'}${formatCurrency(numAmount)}，确认提交吗？`,
          [
            { text: '取消', style: 'cancel' },
            { 
              text: '确认', 
              onPress: async () => {
                await processTransaction(numAmount);
              }
            }
          ]
        );
        return;
      }
    }

    await processTransaction(numAmount);
  };

  const processTransaction = async (numAmount: number) => {
    if (!selectedCategory) return;

    const transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
      amount: numAmount,
      type: transactionType,
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      categoryIcon: selectedCategory.icon,
      note: note,
      tags: [],
      attachments: [],
      date: Date.now()
    };

    await addTransaction(transaction);
    
    animateBalance(transactionType);
    
    const newBalance = (account?.balance || 0) + (transactionType === 'income' ? numAmount : -numAmount);
    showNotification(
      `${transactionType === 'income' ? '💰 收入' : '💸 支出'} ${formatCurrency(numAmount)}`
    );

    setShowAddModal(false);
    setAmount('');
    setNote('');
    setSelectedCategory(filteredCategories[0] || null);
  };

  const handleQuickAmount = async (quickAmount: { amount: number; type: 'income' | 'expense'; categoryId: string; categoryName: string; categoryIcon: string }) => {
    if (account) {
      const validation = validateAmount(quickAmount.amount, account.balance, quickAmount.type);
      if (!validation.valid) {
        showAlert('无法完成操作', validation.message);
        return;
      }
    }

    const transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
      amount: quickAmount.amount,
      type: quickAmount.type,
      categoryId: quickAmount.categoryId,
      categoryName: quickAmount.categoryName,
      categoryIcon: quickAmount.categoryIcon,
      note: '',
      tags: [],
      attachments: [],
      date: Date.now()
    };

    await addTransaction(transaction);
    animateBalance(quickAmount.type);
    
    showNotification(
      `${quickAmount.type === 'income' ? '💰' : '💸'} ${quickAmount.categoryName} ${formatCurrency(quickAmount.amount)}`
    );
  };

  const handleButtonPress = (type: 'income' | 'expense') => {
    setTransactionType(type);
    setShowAddModal(true);
  };

  const handleButtonLongPress = (type: 'income' | 'expense') => {
    const filtered = quickAmounts.filter(q => q.type === type);
    if (filtered.length > 0) {
      setTransactionType(type);
      setShowQuickAmounts(true);
    } else {
      showAlert('提示', '暂无快捷金额，请在设置中添加');
    }
  };

  const getTransactionDateLabel = (date: number) => {
    const d = new Date(date);
    if (isToday(d)) return '今天';
    if (isYesterday(d)) return '昨天';
    return formatDate(date, 'MM-dd');
  };

  const renderRecentTransaction = (transaction: Transaction) => (
    <TouchableOpacity 
      key={transaction.id} 
      style={styles.transactionItem}
      onPress={() => router.push('/records')}
    >
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionIcon}>{transaction.categoryIcon}</Text>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionCategory}>{transaction.categoryName}</Text>
          {transaction.note ? (
            <Text style={styles.transactionNote} numberOfLines={1}>{transaction.note}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[
          styles.transactionAmount,
          { color: transaction.type === 'income' ? colors.success : colors.danger }
        ]}>
          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
        </Text>
        <Text style={styles.transactionTime}>{getTransactionDateLabel(transaction.date)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.cardTop}>
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color="#FBBF24" />
              <Text style={styles.streakText}>已记账 {settings?.streakDays || 0} 天</Text>
            </View>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.balanceLabel}>当前余额</Text>
          <Animated.Text 
            style={[
              styles.balanceAmount, 
              { 
                color: isBalanceWarning ? colors.warning : balanceColor,
                transform: [{ scale: balanceAnim }]
              }
            ]}
          >
            {formatCurrency(account?.balance || 0)}
          </Animated.Text>
          
          {isBalanceWarning && (
            <View style={styles.warningBadge}>
              <Ionicons name="warning" size={14} color={colors.warning} />
              <Text style={styles.warningText}>余额低于预警值</Text>
            </View>
          )}
          
          <View style={styles.todayStats}>
            <View style={styles.todayStatItem}>
              <Text style={styles.todayStatLabel}>今日收入</Text>
              <Text style={[styles.todayStatValue, { color: '#86EFAC' }]}>
                +{formatCurrency(todayStats.income)}
              </Text>
            </View>
            <View style={styles.todayStatDivider} />
            <View style={styles.todayStatItem}>
              <Text style={styles.todayStatLabel}>今日支出</Text>
              <Text style={[styles.todayStatValue, { color: '#FCA5A5' }]}>
                -{formatCurrency(todayStats.expense)}
              </Text>
            </View>
            <View style={styles.todayStatDivider} />
            <View style={styles.todayStatItem}>
              <Text style={styles.todayStatLabel}>今日笔数</Text>
              <Text style={styles.todayStatValue}>
                {todayStats.count}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.monthStatsCard}>
          <View style={styles.monthStatsHeader}>
            <Text style={styles.monthStatsTitle}>本月统计</Text>
            <TouchableOpacity onPress={() => router.push('/statistics')}>
              <Text style={styles.monthStatsMore}>详情 →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.monthStatsContent}>
            <View style={styles.monthStatItem}>
              <Text style={styles.monthStatLabel}>月收入</Text>
              <Text style={[styles.monthStatValue, { color: colors.success }]}>
                +{formatCurrency(monthStats.income)}
              </Text>
            </View>
            <View style={styles.monthStatDivider} />
            <View style={styles.monthStatItem}>
              <Text style={styles.monthStatLabel}>月支出</Text>
              <Text style={[styles.monthStatValue, { color: colors.danger }]}>
                -{formatCurrency(monthStats.expense)}
              </Text>
            </View>
            <View style={styles.monthStatDivider} />
            <View style={styles.monthStatItem}>
              <Text style={styles.monthStatLabel}>月结余</Text>
              <Text style={[
                styles.monthStatValue, 
                { color: monthStats.income - monthStats.expense >= 0 ? colors.success : colors.danger }
              ]}>
                {monthStats.income - monthStats.expense >= 0 ? '+' : ''}{formatCurrency(monthStats.income - monthStats.expense)}
              </Text>
            </View>
          </View>
        </View>

        {selectedDate && (
          <View style={styles.selectedDateInfo}>
            <View style={styles.selectedDateHeader}>
              <View style={styles.selectedDateLeft}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <Text style={styles.selectedDateTitle}>
                  {format(selectedDate, 'MM月dd日', { locale: zhCN })}
                </Text>
                {isToday(selectedDate) && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>今天</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.selectedDateStats}>
              <View style={styles.selectedDateStat}>
                <View style={[styles.selectedDateIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Ionicons name="arrow-up" size={16} color={colors.danger} />
                </View>
                <View>
                  <Text style={styles.selectedDateLabel}>支出</Text>
                  <Text style={[styles.selectedDateValue, { color: colors.danger }]}>
                    {formatCurrency(getSelectedDateExpense())}
                  </Text>
                </View>
              </View>
              <View style={styles.selectedDateStatDivider} />
              <View style={styles.selectedDateStat}>
                <View style={[styles.selectedDateIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="arrow-down" size={16} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.selectedDateLabel}>收入</Text>
                  <Text style={[styles.selectedDateValue, { color: colors.success }]}>
                    {formatCurrency(getSelectedDateIncome())}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton, 
              styles.incomeButton,
              pressed && styles.buttonPressed
            ]}
            onPress={() => handleButtonPress('income')}
            onLongPress={() => handleButtonLongPress('income')}
            delayLongPress={500}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <Ionicons name="add-circle" size={26} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>记收入</Text>
            </LinearGradient>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.actionButton, 
              styles.expenseButton,
              pressed && styles.buttonPressed
            ]}
            onPress={() => handleButtonPress('expense')}
            onLongPress={() => handleButtonLongPress('expense')}
            delayLongPress={500}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <Ionicons name="remove-circle" size={26} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>记支出</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {quickAmounts.length > 0 && (
          <View style={styles.quickActions}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>快捷记账</Text>
              <Text style={styles.sectionHint}>长按收入/支出按钮查看更多</Text>
            </View>
            <View style={styles.quickActionGrid}>
              {quickAmounts.slice(0, 6).map((quick) => (
                <TouchableOpacity
                  key={quick.id}
                  style={[
                    styles.quickActionItem,
                    quick.type === 'income' ? styles.quickIncome : styles.quickExpense
                  ]}
                  onPress={() => handleQuickAmount(quick)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickActionIcon}>{quick.categoryIcon}</Text>
                  <Text style={styles.quickActionAmount}>{formatCurrency(quick.amount)}</Text>
                  <Text style={styles.quickActionCategory} numberOfLines={1}>{quick.categoryName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {recentTransactions.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>最近交易</Text>
              <TouchableOpacity onPress={() => router.push('/records')}>
                <Text style={styles.seeAllText}>查看全部</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.transactionList}>
              {recentTransactions.map(renderRecentTransaction)}
            </View>
          </View>
        )}

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calendarNavBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text.primary.light} />
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>{format(currentMonth, 'yyyy年MM月', { locale: zhCN })}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.calendarNavBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text.primary.light} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.calendarWeekDays}>
            {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
              <Text key={index} style={[
                styles.calendarWeekDay,
                index === 0 && { color: colors.danger },
                index === 6 && { color: colors.primary }
              ]}>{day}</Text>
            ))}
          </View>
          
          <View style={styles.calendarGrid}>
            {renderCalendarDays()}
          </View>
        </View>

        {budget && budgetWarning.level !== 'safe' && (
          <View style={[
            styles.budgetWarning,
            budgetWarning.level === 'danger' ? styles.budgetDanger : styles.budgetWarningStyle
          ]}>
            <Ionicons 
              name={budgetWarning.level === 'danger' ? 'alert-circle' : 'warning'} 
              size={20} 
              color={budgetWarning.level === 'danger' ? colors.danger : colors.warning} 
            />
            <Text style={[
              styles.budgetWarningText,
              { color: budgetWarning.level === 'danger' ? colors.danger : colors.warning }
            ]}>
              {budgetWarning.message}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {transactionType === 'income' ? '💰 添加收入' : '💸 添加支出'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                <Ionicons name="close-circle" size={28} color={colors.text.secondary.light} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeSwitch}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionType === 'income' && styles.typeButtonActive
                ]}
                onPress={() => setTransactionType('income')}
              >
                <Text style={[
                  styles.typeButtonText,
                  transactionType === 'income' && styles.typeButtonTextActive
                ]}>
                  收入
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionType === 'expense' && styles.typeButtonActiveExpense
                ]}
                onPress={() => setTransactionType('expense')}
              >
                <Text style={[
                  styles.typeButtonText,
                  transactionType === 'expense' && styles.typeButtonTextActiveExpense
                ]}>
                  支出
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.amountInput}
              placeholder="输入金额（如：奶茶 25）"
              placeholderTextColor={colors.text.secondary.light}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={handleAmountChange}
            />

            <TextInput
              style={styles.noteInput}
              placeholder="备注（可选）"
              placeholderTextColor={colors.text.secondary.light}
              value={note}
              onChangeText={setNote}
              multiline
            />

            <Text style={styles.categoryLabel}>选择分类</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList}>
              {filteredCategories.map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    selectedCategory?.id === category.id && styles.categoryItemActive
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.submitButton,
                transactionType === 'income' ? styles.submitIncome : styles.submitExpense
              ]}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>确认提交</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showQuickAmounts}
        animationType="fade"
        transparent
        onRequestClose={() => setShowQuickAmounts(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowQuickAmounts(false)}>
          <View style={styles.quickAmountModal}>
            <Text style={styles.quickAmountTitle}>
              选择快捷{transactionType === 'income' ? '收入' : '支出'}
            </Text>
            <View style={styles.quickAmountList}>
              {quickAmounts
                .filter(q => q.type === transactionType)
                .map(quick => (
                  <TouchableOpacity
                    key={quick.id}
                    style={styles.quickAmountItem}
                    onPress={() => {
                      handleQuickAmount(quick);
                      setShowQuickAmounts(false);
                    }}
                  >
                    <Text style={styles.quickAmountIcon}>{quick.categoryIcon}</Text>
                    <Text style={styles.quickAmountName}>{quick.categoryName}</Text>
                    <Text style={styles.quickAmountValue}>{formatCurrency(quick.amount)}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            <TouchableOpacity
              style={styles.quickAmountCancel}
              onPress={() => setShowQuickAmounts(false)}
            >
              <Text style={styles.quickAmountCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {showToast && (
        <Animated.View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing.md
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary.light
  },
  balanceCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.lg
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full
  },
  streakText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: spacing.xs,
    fontWeight: fontWeight.medium
  },
  settingsBtn: {
    padding: spacing.xs
  },
  balanceLabel: {
    fontSize: fontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    marginBottom: spacing.sm
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing.md
  },
  warningText: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginLeft: spacing.xs
  },
  todayStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  todayStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  todayStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs
  },
  todayStatValue: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF'
  },
  todayStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)'
  },
  monthStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm
  },
  monthStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  monthStatsTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  monthStatsMore: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: fontWeight.medium
  },
  monthStatsContent: {
    flexDirection: 'row',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md
  },
  monthStatItem: {
    flex: 1,
    alignItems: 'center'
  },
  monthStatLabel: {
    fontSize: 12,
    color: colors.text.secondary.light,
    marginBottom: spacing.xs
  },
  monthStatValue: {
    fontSize: 14,
    fontWeight: fontWeight.bold
  },
  monthStatDivider: {
    width: 1,
    backgroundColor: colors.border.light
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  calendarNavBtn: {
    padding: spacing.xs
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: spacing.sm
  },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.text.secondary.light,
    fontWeight: fontWeight.medium
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  calendarDay: {
    width: `${100/7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    position: 'relative'
  },
  calendarDayEmpty: {
    width: `${100/7}%`,
    aspectRatio: 1
  },
  calendarDayToday: {
    backgroundColor: `${colors.primary}15`
  },
  calendarDaySelected: {
    backgroundColor: colors.primary
  },
  calendarDayText: {
    fontSize: 14,
    color: colors.text.primary.light,
    fontWeight: fontWeight.medium
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold
  },
  calendarExpenseDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3
  },
  calendarDayCount: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 8,
    color: colors.text.secondary.light
  },
  selectedDateInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm
  },
  selectedDateHeader: {
    marginBottom: spacing.md
  },
  selectedDateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  selectedDateTitle: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full
  },
  todayBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: fontWeight.medium
  },
  selectedDateStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm
  },
  selectedDateStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'center'
  },
  selectedDateStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light
  },
  selectedDateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedDateLabel: {
    fontSize: 12,
    color: colors.text.secondary.light,
    marginBottom: 2
  },
  selectedDateValue: {
    fontSize: 15,
    fontWeight: fontWeight.bold
  },
  budgetWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    ...shadows.sm
  },
  budgetWarningStyle: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning
  },
  budgetDanger: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger
  },
  budgetWarningText: {
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.medium
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs
  },
  incomeButton: {},
  expenseButton: {},
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF'
  },
  quickActions: {
    marginBottom: spacing.sm
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  sectionHint: {
    fontSize: 10,
    color: colors.text.secondary.light
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  quickActionItem: {
    width: (width - spacing.sm * 2 - spacing.xs * 2) / 3,
    minHeight: 70,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...shadows.sm
  },
  quickIncome: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success
  },
  quickExpense: {
    borderLeftWidth: 3,
    borderLeftColor: colors.danger
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4
  },
  quickActionAmount: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  quickActionCategory: {
    fontSize: 10,
    color: colors.text.secondary.light,
    marginTop: 2
  },
  recentSection: {
    marginBottom: spacing.sm
  },
  seeAllText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium
  },
  transactionList: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  transactionIcon: {
    fontSize: 20,
    marginRight: spacing.sm
  },
  transactionInfo: {
    flex: 1
  },
  transactionCategory: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  transactionNote: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light,
    marginTop: 2
  },
  transactionRight: {
    alignItems: 'flex-end'
  },
  transactionAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold
  },
  transactionTime: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light,
    marginTop: 2
  },
  bottomSpace: {
    height: spacing.xxl
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  closeButton: {
    padding: spacing.xs
  },
  typeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center'
  },
  typeButtonActive: {
    backgroundColor: colors.success
  },
  typeButtonActiveExpense: {
    backgroundColor: colors.danger
  },
  typeButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary.light
  },
  typeButtonTextActive: {
    color: '#FFFFFF'
  },
  typeButtonTextActiveExpense: {
    color: '#FFFFFF'
  },
  amountInput: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light,
    textAlign: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md
  },
  noteInput: {
    fontSize: fontSize.md,
    color: colors.text.primary.light,
    padding: spacing.md,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  categoryLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light,
    marginBottom: spacing.sm
  },
  categoryList: {
    marginBottom: spacing.lg
  },
  categoryItem: {
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.light
  },
  categoryItemActive: {
    backgroundColor: colors.primary
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: spacing.xs
  },
  categoryName: {
    fontSize: fontSize.sm,
    color: colors.text.primary.light
  },
  submitButton: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.md
  },
  submitIncome: {
    backgroundColor: colors.success
  },
  submitExpense: {
    backgroundColor: colors.danger
  },
  submitButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF'
  },
  quickAmountModal: {
    backgroundColor: '#FFFFFF',
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg
  },
  quickAmountTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  quickAmountList: {
    marginBottom: spacing.md
  },
  quickAmountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm
  },
  quickAmountIcon: {
    fontSize: 24,
    marginRight: spacing.md
  },
  quickAmountName: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary.light
  },
  quickAmountValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary.light
  },
  quickAmountCancel: {
    padding: spacing.md,
    alignItems: 'center'
  },
  quickAmountCancelText: {
    fontSize: fontSize.md,
    color: colors.text.secondary.light
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.lg
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    textAlign: 'center',
    fontWeight: fontWeight.medium
  }
});
