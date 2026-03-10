import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../../src/theme/colors';
import { Category } from '../../src/types';

export default function CategoryManageScreen() {
  const router = useRouter();
  const { categories, addCategory, updateCategory, deleteCategory } = useAppStore();
  
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('📝');
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const filteredCategories = filterType === 'all' 
    ? categories 
    : categories.filter(c => c.type === filterType);

  const iconOptions = ['🍜', '🚌', '🛒', '🎮', '💊', '📚', '🏠', '📱', '📦', '💰', '🎁', '📈', '💼', '🧾', '💵', '📝', '🎯', '✨', '🌟', '💫'];

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryIcon('📝');
    setCategoryType('expense');
    setShowModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryIcon(category.icon);
    setCategoryType(category.type);
    setShowModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('错误', '请输入分类名称');
      return;
    }

    if (editingCategory) {
      await updateCategory(editingCategory.id, {
        name: categoryName.trim(),
        icon: categoryIcon,
        type: categoryType
      });
      Alert.alert('成功', '分类已更新');
    } else {
      await addCategory({
        name: categoryName.trim(),
        icon: categoryIcon,
        type: categoryType,
        isDefault: false,
        isVisible: true
      });
      Alert.alert('成功', '分类已添加');
    }

    setShowModal(false);
  };

  const handleDeleteCategory = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('无法删除', '默认分类不能删除');
      return;
    }

    Alert.alert(
      '确认删除',
      `确定要删除「${category.name}」分类吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(category.id);
            Alert.alert('成功', '分类已删除');
          }
        }
      ]
    );
  };

  const handleToggleVisibility = async (category: Category) => {
    await updateCategory(category.id, { isVisible: !category.isVisible });
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <View style={[styles.categoryItem, !item.isVisible && styles.categoryItemHidden]}>
      <View style={styles.categoryIcon}>
        <Text style={styles.iconText}>{item.icon}</Text>
      </View>
      
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryType}>
          {item.type === 'income' ? '收入' : '支出'}
          {item.isDefault ? ' · 默认' : ''}
          {!item.isVisible ? ' · 已隐藏' : ''}
        </Text>
      </View>
      
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleVisibility(item)}
        >
          <Ionicons
            name={item.isVisible ? 'eye' : 'eye-off'}
            size={20}
            color={item.isVisible ? colors.primary : colors.text.secondary.light}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditCategory(item)}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteCategory(item)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary.light} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>分类管理</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddCategory}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, filterType === type && styles.filterChipActive]}
            onPress={() => setFilterType(type)}
          >
            <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
              {type === 'all' ? '全部' : type === 'income' ? '收入' : '支出'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategoryItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={48} color={colors.text.secondary.light} />
            <Text style={styles.emptyText}>暂无分类</Text>
          </View>
        }
      />

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory ? '编辑分类' : '添加分类'}
            </Text>

            <Text style={styles.modalLabel}>分类名称</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="输入分类名称"
              placeholderTextColor={colors.text.secondary.light}
              value={categoryName}
              onChangeText={setCategoryName}
            />

            <Text style={styles.modalLabel}>分类图标</Text>
            <View style={styles.iconGrid}>
              {iconOptions.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    categoryIcon === icon && styles.iconOptionActive
                  ]}
                  onPress={() => setCategoryIcon(icon)}
                >
                  <Text style={styles.iconOptionText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>分类类型</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  categoryType === 'expense' && styles.typeOptionActive
                ]}
                onPress={() => setCategoryType('expense')}
              >
                <Text style={[
                  styles.typeOptionText,
                  categoryType === 'expense' && styles.typeOptionTextActive
                ]}>
                  支出
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  categoryType === 'income' && styles.typeOptionIncome
                ]}
                onPress={() => setCategoryType('income')}
              >
                <Text style={[
                  styles.typeOptionText,
                  categoryType === 'income' && styles.typeOptionTextActive
                ]}>
                  收入
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSaveCategory}
              >
                <Text style={styles.modalButtonConfirmText}>保存</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light
  },
  backButton: {
    padding: spacing.sm
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light
  },
  addButton: {
    padding: spacing.sm
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.light
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
  listContent: {
    padding: spacing.md
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card.light,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm
  },
  categoryItemHidden: {
    opacity: 0.6
  },
  categoryIcon: {
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
  categoryInfo: {
    flex: 1
  },
  categoryName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  categoryType: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginTop: 2
  },
  categoryActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
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
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: colors.background.light,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 400,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  modalLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginBottom: spacing.xs
  },
  modalInput: {
    fontSize: fontSize.md,
    color: colors.text.primary.light,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconOptionActive: {
    backgroundColor: colors.primaryLight + '30',
    borderWidth: 2,
    borderColor: colors.primary
  },
  iconOptionText: {
    fontSize: 22
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  typeOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.light,
    alignItems: 'center'
  },
  typeOptionActive: {
    backgroundColor: colors.danger
  },
  typeOptionIncome: {
    backgroundColor: colors.success
  },
  typeOptionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  typeOptionTextActive: {
    color: '#FFFFFF'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md
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
  }
});
