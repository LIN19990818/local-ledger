import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../../src/theme/colors';
import { formatCurrency, formatDate, getDateRange, showAlert } from '../../src/utils/helpers';
import { Transaction } from '../../src/types';
import { TransactionRepository } from '../../src/database/repository';
import { format } from 'date-fns';
import { PasswordModal } from '../../src/components/PasswordModal';

type TimeFilter = 'day' | 'week' | 'month' | 'year' | 'all';
type TypeFilter = 'all' | 'income' | 'expense';

export default function RecordsScreen() {
  const { categories, deleteTransactions, refreshTransactions, transactions: storeTransactions, settings } = useAppStore();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [timeFilter, typeFilter, selectedCategory, storeTransactions]);

  const loadTransactions = async () => {
    setRefreshing(true);
    
    let options: any = {};
    
    if (timeFilter !== 'all') {
      const { start, end } = getDateRange(timeFilter);
      options.startDate = start;
      options.endDate = end;
    }
    
    if (typeFilter !== 'all') {
      options.type = typeFilter;
    }
    
    if (selectedCategory) {
      options.categoryId = selectedCategory;
    }
    
    const data = await TransactionRepository.getAll(options);
    setTransactions(data);
    setRefreshing(false);
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === transactions.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(transactions.map(t => t.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) return;
    
    showAlert(
      '确认删除',
      `确定要删除选中的 ${selectedItems.size} 条记录吗？删除后无法恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteTransactions(Array.from(selectedItems));
            setSelectedItems(new Set());
            setIsSelectMode(false);
            loadTransactions();
          }
        }
      ]
    );
  };

  const handleDeleteSingle = (transaction: Transaction) => {
    showAlert(
      '确认删除',
      `确定要删除这条${formatCurrency(transaction.amount)}的${transaction.type === 'income' ? '收入' : '支出'}记录吗？删除后无法恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteTransactions([transaction.id]);
            loadTransactions();
          }
        }
      ]
    );
  };

  const handleEditTransaction = (transaction: Transaction) => {
    if (settings?.operationPassword) {
      setPendingAction(() => () => {
        setEditingTransaction(transaction);
        setEditAmount(String(transaction.amount));
        setEditNote(transaction.note || '');
        setShowEditModal(true);
      });
      setShowPasswordModal(true);
    } else {
      setEditingTransaction(transaction);
      setEditAmount(String(transaction.amount));
      setEditNote(transaction.note || '');
      setShowEditModal(true);
    }
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

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;
    
    const newAmount = parseFloat(editAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      showAlert('错误', '请输入有效金额');
      return;
    }
    
    await TransactionRepository.update(editingTransaction.id, {
      amount: newAmount,
      note: editNote
    });
    
    setShowEditModal(false);
    setEditingTransaction(null);
    setEditAmount('');
    setEditNote('');
    loadTransactions();
    
    showAlert('成功', '交易记录已修正');
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItems(new Set());
  };

  const groupTransactionsByDate = (data: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    
    data.forEach(transaction => {
      const dateKey = formatDate(transaction.date, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
    });
    
    return Object.entries(groups).map(([date, items]) => ({
      date,
      data: items,
      totalIncome: items.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0),
      totalExpense: items.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0)
    }));
  };

  const groupedData = groupTransactionsByDate(
    searchText 
      ? transactions.filter(t => 
          t.note.toLowerCase().includes(searchText.toLowerCase()) ||
          t.categoryName.toLowerCase().includes(searchText.toLowerCase())
        )
      : transactions
  );

  const renderDateHeader = ({ date, totalIncome, totalExpense }: { date: string; totalIncome: number; totalExpense: number }) => (
    <View style={styles.dateHeader}>
      <View style={styles.dateInfo}>
        <Text style={styles.dateText}>{formatDate(new Date(date), 'M月d日 EEEE')}</Text>
        <Text style={styles.dateSubtext}>{formatDate(new Date(date), 'yyyy年')}</Text>
      </View>
      <View style={styles.dateSummary}>
        {totalIncome > 0 && (
          <Text style={[styles.dateSummaryText, { color: colors.success }]}>
            +{formatCurrency(totalIncome)}
          </Text>
        )}
        {totalExpense > 0 && (
          <Text style={[styles.dateSummaryText, { color: colors.danger }]}>
            -{formatCurrency(totalExpense)}
          </Text>
        )}
      </View>
    </View>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.transactionItem,
          isSelected && styles.transactionItemSelected
        ]}
        onLongPress={() => {
          setIsSelectMode(true);
          handleSelectItem(item.id);
        }}
        onPress={() => {
          if (isSelectMode) {
            handleSelectItem(item.id);
          }
        }}
      >
        {isSelectMode && (
          <View style={styles.checkbox}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={24}
              color={isSelected ? colors.primary : colors.text.secondary.light}
            />
          </View>
        )}
        
        <View style={styles.transactionIcon}>
          <Text style={styles.iconText}>{item.categoryIcon}</Text>
        </View>
        
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionCategory}>{item.categoryName}</Text>
          {item.note ? (
            <Text style={styles.transactionNote} numberOfLines={1}>{item.note}</Text>
          ) : null}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 2).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: item.type === 'income' ? colors.success : colors.danger }
          ]}>
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <Text style={styles.timeText}>
            {formatDate(item.date, 'HH:mm')}
          </Text>
        </View>
        
        {!isSelectMode && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditTransaction(item)}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteSingle(item)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = ({ item }: { item: { date: string; data: Transaction[]; totalIncome: number; totalExpense: number } }) => (
    <View style={styles.section}>
      {renderDateHeader(item)}
      {item.data.map(transaction => (
        <View key={transaction.id}>
          {renderTransactionItem({ item: transaction })}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.filterRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['day', 'week', 'month', 'year', 'all'] as TimeFilter[]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  timeFilter === item && styles.filterChipActive
                ]}
                onPress={() => setTimeFilter(item)}
              >
                <Text style={[
                  styles.filterChipText,
                  timeFilter === item && styles.filterChipTextActive
                ]}>
                  {item === 'day' ? '今日' : item === 'week' ? '本周' : item === 'month' ? '本月' : item === 'year' ? '本年' : '全部'}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.filterList}
          />
        </View>
        
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter" size={20} color={colors.primary} />
            <Text style={styles.filterButtonText}>筛选</Text>
          </TouchableOpacity>
          
          {isSelectMode ? (
            <View style={styles.selectActions}>
              <TouchableOpacity onPress={handleSelectAll}>
                <Text style={styles.selectActionText}>
                  {selectedItems.size === transactions.length ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteSelected} disabled={selectedItems.size === 0}>
                <Text style={[
                  styles.selectActionText,
                  selectedItems.size === 0 && styles.selectActionDisabled
                ]}>
                  删除({selectedItems.size})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={exitSelectMode}>
                <Text style={styles.selectActionText}>取消</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setIsSelectMode(true)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={groupedData}
        keyExtractor={(item) => item.date}
        renderItem={renderSection}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={loadTransactions}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.text.secondary.light} />
            <Text style={styles.emptyText}>暂无账单记录</Text>
          </View>
        }
      />

      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>筛选条件</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary.light} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>类型</Text>
            <View style={styles.filterOptions}>
              {['all', 'income', 'expense'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterOption,
                    typeFilter === type && styles.filterOptionActive
                  ]}
                  onPress={() => setTypeFilter(type as TypeFilter)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    typeFilter === type && styles.filterOptionTextActive
                  ]}>
                    {type === 'all' ? '全部' : type === 'income' ? '收入' : '支出'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>分类</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  selectedCategory === null && styles.filterOptionActive
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[
                  styles.filterOptionText,
                  selectedCategory === null && styles.filterOptionTextActive
                ]}>
                  全部分类
                </Text>
              </TouchableOpacity>
              {categories.slice(0, 8).map(category => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.filterOption,
                    selectedCategory === category.id && styles.filterOptionActive
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <Text style={styles.filterOptionIcon}>{category.icon}</Text>
                  <Text style={[
                    styles.filterOptionText,
                    selectedCategory === category.id && styles.filterOptionTextActive
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                setShowFilterModal(false);
                loadTransactions();
              }}
            >
              <Text style={styles.applyButtonText}>应用筛选</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>修正交易记录</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary.light} />
              </TouchableOpacity>
            </View>

            {editingTransaction && (
              <>
                <View style={styles.editInfo}>
                  <Text style={styles.editCategory}>
                    {editingTransaction.categoryIcon} {editingTransaction.categoryName}
                  </Text>
                  <Text style={[
                    styles.editType,
                    { color: editingTransaction.type === 'income' ? colors.success : colors.danger }
                  ]}>
                    {editingTransaction.type === 'income' ? '收入' : '支出'}
                  </Text>
                </View>

                <Text style={styles.editLabel}>金额</Text>
                <TextInput
                  style={styles.editInput}
                  placeholder="输入金额"
                  placeholderTextColor={colors.text.secondary.light}
                  keyboardType="decimal-pad"
                  value={editAmount}
                  onChangeText={setEditAmount}
                />

                <Text style={styles.editLabel}>备注</Text>
                <TextInput
                  style={[styles.editInput, styles.editInputNote]}
                  placeholder="输入备注（可选）"
                  placeholderTextColor={colors.text.secondary.light}
                  value={editNote}
                  onChangeText={setEditNote}
                  multiline
                />

                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[styles.editButtonModal, styles.editButtonCancel]}
                    onPress={() => {
                      setShowEditModal(false);
                      setEditingTransaction(null);
                    }}
                  >
                    <Text style={styles.editButtonCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButtonModal, styles.editButtonConfirm]}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.editButtonConfirmText}>保存</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <PasswordModal
        visible={showPasswordModal}
        title="验证密码"
        message="请输入操作密码以修改交易记录"
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordError(false);
          setPendingAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        isError={passwordError}
        errorMessage="密码错误，请重试"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light
  },
  header: {
    backgroundColor: colors.card.light,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light
  },
  filterRow: {
    marginBottom: spacing.sm
  },
  filterList: {
    gap: spacing.xs
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.light,
    marginRight: spacing.xs
  },
  filterChipActive: {
    backgroundColor: colors.primary
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: fontWeight.medium
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.light
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginLeft: spacing.xs
  },
  selectButton: {
    padding: spacing.sm
  },
  selectActions: {
    flexDirection: 'row',
    gap: spacing.md
  },
  selectActionText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.medium
  },
  selectActionDisabled: {
    color: colors.text.secondary.light
  },
  listContent: {
    padding: spacing.md
  },
  section: {
    marginBottom: spacing.md
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm
  },
  dateText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light
  },
  dateSubtext: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light
  },
  dateSummary: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  dateSummaryText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card.light,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
    ...shadows.sm
  },
  transactionItemSelected: {
    backgroundColor: colors.primaryLight + '20'
  },
  checkbox: {
    marginRight: spacing.sm
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  iconText: {
    fontSize: 22
  },
  transactionInfo: {
    flex: 1
  },
  transactionCategory: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  transactionNote: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginTop: spacing.xs
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.xs
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.sm
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.primary
  },
  transactionAmount: {
    alignItems: 'flex-end'
  },
  amountText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary.light,
    marginTop: spacing.xs
  },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  editButton: {
    padding: spacing.sm
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary.light,
    marginTop: spacing.md
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: colors.background.light,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '70%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light
  },
  filterLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light,
    marginBottom: spacing.sm
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.light
  },
  filterOptionActive: {
    backgroundColor: colors.primary
  },
  filterOptionIcon: {
    fontSize: 16,
    marginRight: spacing.xs
  },
  filterOptionText: {
    fontSize: fontSize.sm,
    color: colors.text.primary.light
  },
  filterOptionTextActive: {
    color: '#FFFFFF'
  },
  applyButton: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center'
  },
  applyButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: '#FFFFFF'
  },
  editInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg
  },
  editCategory: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  editType: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold
  },
  editLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light,
    marginBottom: spacing.xs
  },
  editInput: {
    fontSize: fontSize.lg,
    color: colors.text.primary.light,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  editInputNote: {
    height: 80,
    textAlignVertical: 'top'
  },
  editButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm
  },
  editButtonModal: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center'
  },
  editButtonCancel: {
    backgroundColor: colors.surface.light
  },
  editButtonConfirm: {
    backgroundColor: colors.primary
  },
  editButtonCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  editButtonConfirmText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: '#FFFFFF'
  }
});
