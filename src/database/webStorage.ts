import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, Category, Account, Budget, Settings, QuickAmount } from '../types';
import { format } from 'date-fns';

const STORAGE_KEYS = {
  TRANSACTIONS: 'ledger_transactions',
  CATEGORIES: 'ledger_categories',
  ACCOUNT: 'ledger_account',
  BUDGETS: 'ledger_budgets',
  SETTINGS: 'ledger_settings',
  QUICK_AMOUNTS: 'ledger_quick_amounts'
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

let initialized = false;

const defaultCategoriesData: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'food', name: '餐饮', icon: '🍜', type: 'expense', isDefault: true, isVisible: true },
  { id: 'transport', name: '交通', icon: '🚌', type: 'expense', isDefault: true, isVisible: true },
  { id: 'shopping', name: '购物', icon: '🛒', type: 'expense', isDefault: true, isVisible: true },
  { id: 'entertainment', name: '娱乐', icon: '🎮', type: 'expense', isDefault: true, isVisible: true },
  { id: 'medical', name: '医疗', icon: '💊', type: 'expense', isDefault: true, isVisible: true },
  { id: 'education', name: '教育', icon: '📚', type: 'expense', isDefault: true, isVisible: true },
  { id: 'housing', name: '住房', icon: '🏠', type: 'expense', isDefault: true, isVisible: true },
  { id: 'communication', name: '通讯', icon: '📱', type: 'expense', isDefault: true, isVisible: true },
  { id: 'other_expense', name: '其他支出', icon: '📦', type: 'expense', isDefault: true, isVisible: true },
  { id: 'salary', name: '工资', icon: '💰', type: 'income', isDefault: true, isVisible: true },
  { id: 'bonus', name: '奖金', icon: '🎁', type: 'income', isDefault: true, isVisible: true },
  { id: 'investment', name: '投资收益', icon: '📈', type: 'income', isDefault: true, isVisible: true },
  { id: 'parttime', name: '兼职', icon: '💼', type: 'income', isDefault: true, isVisible: true },
  { id: 'reimbursement', name: '报销', icon: '🧾', type: 'income', isDefault: true, isVisible: true },
  { id: 'other_income', name: '其他收入', icon: '💵', type: 'income', isDefault: true, isVisible: true },
];

export const initDatabase = async (): Promise<void> => {
  if (initialized) return;
  
  const accountStr = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT);
  if (!accountStr) {
    const now = Date.now();
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify({
      id: 'default',
      name: '默认账户',
      balance: 0,
      warningThreshold: 100,
      largeAmountThreshold: 500,
      createdAt: now,
      updatedAt: now
    }));
  }
  
  const categoriesStr = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
  let existingCategories: Category[] = categoriesStr ? JSON.parse(categoriesStr) : [];
  
  const now = Date.now();
  let needsUpdate = false;
  
  for (const defaultCat of defaultCategoriesData) {
    const exists = existingCategories.find(c => c.id === defaultCat.id);
    if (!exists) {
      existingCategories.push({
        ...defaultCat,
        createdAt: now,
        updatedAt: now
      });
      needsUpdate = true;
    }
  }
  
  if (needsUpdate) {
    await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(existingCategories));
  }
  
  const settingsStr = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!settingsStr) {
    const now = Date.now();
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
      id: 'default',
      isAppLocked: false,
      biometricEnabled: false,
      pinCode: null,
      theme: 'system',
      defaultCategories: true,
      autoBackup: true,
      backupPath: null,
      lastBackupDate: null,
      streakDays: 0,
      lastRecordDate: null,
      unlockedThemes: [],
      createdAt: now,
      updatedAt: now
    }));
  }
  
  initialized = true;
};

export const getDatabase = () => {
  return { isWeb: true };
};

export const closeDatabase = async (): Promise<void> => {
  initialized = false;
};

const getTransactions = async (): Promise<Transaction[]> => {
  const str = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  return str ? JSON.parse(str) : [];
};

const saveTransactions = async (transactions: Transaction[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
};

const getCategories = async (): Promise<Category[]> => {
  const str = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
  return str ? JSON.parse(str) : [];
};

const saveCategories = async (categories: Category[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
};

const getAccount = async (): Promise<Account | null> => {
  const str = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT);
  return str ? JSON.parse(str) : null;
};

const saveAccount = async (account: Account) => {
  await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify(account));
};

const getBudgets = async (): Promise<Budget[]> => {
  const str = await AsyncStorage.getItem(STORAGE_KEYS.BUDGETS);
  return str ? JSON.parse(str) : [];
};

const saveBudgets = async (budgets: Budget[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
};

const getSettings = async (): Promise<Settings | null> => {
  const str = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
  return str ? JSON.parse(str) : null;
};

const saveSettings = async (settings: Settings) => {
  await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

const getQuickAmounts = async (): Promise<QuickAmount[]> => {
  const str = await AsyncStorage.getItem(STORAGE_KEYS.QUICK_AMOUNTS);
  return str ? JSON.parse(str) : [];
};

const saveQuickAmounts = async (quickAmounts: QuickAmount[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.QUICK_AMOUNTS, JSON.stringify(quickAmounts));
};

export const TransactionRepository = {
  async create(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const transactions = await getTransactions();
    const now = Date.now();
    const id = generateId();
    const newTransaction: Transaction = { ...transaction, id, createdAt: now, updatedAt: now };
    transactions.push(newTransaction);
    await saveTransactions(transactions);
    
    const account = await getAccount();
    if (account) {
      account.balance += transaction.type === 'income' ? transaction.amount : -transaction.amount;
      account.updatedAt = now;
      await saveAccount(account);
    }
    
    return newTransaction;
  },
  
  async update(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
    const transactions = await getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const oldTransaction = transactions[index];
    const now = Date.now();
    const updated = { ...oldTransaction, ...updates, updatedAt: now };
    transactions[index] = updated;
    await saveTransactions(transactions);
    
    const account = await getAccount();
    if (account && (updates.amount !== undefined || updates.type !== undefined)) {
      const oldAmount = oldTransaction.type === 'expense' ? -oldTransaction.amount : oldTransaction.amount;
      const newAmount = updated.type === 'expense' ? -updated.amount : updated.amount;
      account.balance += newAmount - oldAmount;
      account.updatedAt = now;
      await saveAccount(account);
    }
    
    return updated;
  },
  
  async delete(id: string): Promise<boolean> {
    const transactions = await getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    const transaction = transactions[index];
    const now = Date.now();
    
    const account = await getAccount();
    if (account) {
      account.balance += transaction.type === 'expense' ? transaction.amount : -transaction.amount;
      account.updatedAt = now;
      await saveAccount(account);
    }
    
    transactions.splice(index, 1);
    await saveTransactions(transactions);
    return true;
  },
  
  async getById(id: string): Promise<Transaction | null> {
    const transactions = await getTransactions();
    return transactions.find(t => t.id === id) || null;
  },
  
  async getAll(options?: {
    type?: 'income' | 'expense';
    categoryId?: string;
    startDate?: number;
    endDate?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    let transactions = await getTransactions();
    
    if (options?.type) {
      transactions = transactions.filter(t => t.type === options.type);
    }
    if (options?.categoryId) {
      transactions = transactions.filter(t => t.categoryId === options.categoryId);
    }
    if (options?.startDate) {
      transactions = transactions.filter(t => t.date >= options.startDate!);
    }
    if (options?.endDate) {
      transactions = transactions.filter(t => t.date <= options.endDate!);
    }
    if (options?.tags && options.tags.length > 0) {
      transactions = transactions.filter(t => 
        options.tags!.some(tag => t.tags?.includes(tag))
      );
    }
    
    transactions.sort((a, b) => b.date - a.date);
    
    if (options?.offset) {
      transactions = transactions.slice(options.offset);
    }
    if (options?.limit) {
      transactions = transactions.slice(0, options.limit);
    }
    
    return transactions;
  },
  
  async getDailyStats(date: number): Promise<{ income: number; expense: number; net: number }> {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);
    const transactions = await getTransactions();
    
    let income = 0;
    let expense = 0;
    
    for (const t of transactions) {
      if (t.date >= startOfDay && t.date <= endOfDay) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getWeeklyStats(date: number): Promise<{ income: number; expense: number; net: number }> {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0).getTime();
    const endOfWeek = new Date(d.getFullYear(), d.getMonth(), diff + 6, 23, 59, 59, 999).getTime();
    const transactions = await getTransactions();
    
    let income = 0;
    let expense = 0;
    
    for (const t of transactions) {
      if (t.date >= startOfWeek && t.date <= endOfWeek) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getMonthlyStats(yearMonth: string): Promise<{ income: number; expense: number; net: number }> {
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();
    const transactions = await getTransactions();
    
    let income = 0;
    let expense = 0;
    
    for (const t of transactions) {
      if (t.date >= startDate && t.date <= endDate) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getYearlyStats(year: number): Promise<{ income: number; expense: number; net: number }> {
    const startDate = new Date(year, 0, 1).getTime();
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    const transactions = await getTransactions();
    
    let income = 0;
    let expense = 0;
    
    for (const t of transactions) {
      if (t.date >= startDate && t.date <= endDate) {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getCategoryBreakdown(startDate: number, endDate: number, type: 'income' | 'expense' = 'expense'): Promise<{ categoryId: string; categoryName: string; categoryIcon: string; amount: number; count: number }[]> {
    const transactions = await getTransactions();
    const breakdown: { [key: string]: { categoryId: string; categoryName: string; categoryIcon: string; amount: number; count: number } } = {};
    
    for (const t of transactions) {
      if (t.date >= startDate && t.date <= endDate && t.type === type) {
        if (!breakdown[t.categoryId]) {
          breakdown[t.categoryId] = {
            categoryId: t.categoryId,
            categoryName: t.categoryName,
            categoryIcon: t.categoryIcon,
            amount: 0,
            count: 0
          };
        }
        breakdown[t.categoryId].amount += t.amount;
        breakdown[t.categoryId].count++;
      }
    }
    
    return Object.values(breakdown).sort((a, b) => b.amount - a.amount);
  },
  
  async getMonthlyTrend(year: number): Promise<{ month: string; income: number; expense: number }[]> {
    const result: { month: string; income: number; expense: number }[] = [];
    
    for (let month = 0; month < 12; month++) {
      const stats = await this.getMonthlyStats(`${year}-${String(month + 1).padStart(2, '0')}`);
      result.push({
        month: `${year}-${String(month + 1).padStart(2, '0')}`,
        income: stats.income,
        expense: stats.expense
      });
    }
    
    return result;
  }
};

export const CategoryRepository = {
  async create(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    const categories = await getCategories();
    const now = Date.now();
    const id = generateId();
    const newCategory: Category = { ...category, id, createdAt: now, updatedAt: now };
    categories.push(newCategory);
    await saveCategories(categories);
    return newCategory;
  },
  
  async update(id: string, updates: Partial<Category>): Promise<Category | null> {
    const categories = await getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const now = Date.now();
    categories[index] = { ...categories[index], ...updates, updatedAt: now };
    await saveCategories(categories);
    return categories[index];
  },
  
  async delete(id: string): Promise<boolean> {
    const categories = await getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1 || categories[index].isDefault) return false;
    
    categories.splice(index, 1);
    await saveCategories(categories);
    return true;
  },
  
  async getById(id: string): Promise<Category | null> {
    const categories = await getCategories();
    return categories.find(c => c.id === id) || null;
  },
  
  async getAll(type?: 'income' | 'expense'): Promise<Category[]> {
    let categories = await getCategories();
    categories = categories.filter(c => c.isVisible);
    if (type) {
      categories = categories.filter(c => c.type === type);
    }
    return categories.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }
};

export const AccountRepository = {
  async get(): Promise<Account | null> {
    return getAccount();
  },
  
  async update(updates: Partial<Account>): Promise<Account | null> {
    const account = await getAccount();
    if (!account) return null;
    
    const now = Date.now();
    const updated = { ...account, ...updates, updatedAt: now };
    await saveAccount(updated);
    return updated;
  }
};

export const BudgetRepository = {
  async create(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const budgets = await getBudgets();
    const now = Date.now();
    const id = generateId();
    const newBudget: Budget = { ...budget, id, createdAt: now, updatedAt: now };
    budgets.push(newBudget);
    await saveBudgets(budgets);
    return newBudget;
  },
  
  async getByMonth(month: string): Promise<Budget | null> {
    const budgets = await getBudgets();
    return budgets.find(b => b.month === month) || null;
  },
  
  async update(id: string, updates: Partial<Budget>): Promise<Budget | null> {
    const budgets = await getBudgets();
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    const now = Date.now();
    budgets[index] = { ...budgets[index], ...updates, updatedAt: now };
    await saveBudgets(budgets);
    return budgets[index];
  },
  
  async updateSpent(month: string): Promise<void> {
    const stats = await TransactionRepository.getMonthlyStats(month);
    const budget = await this.getByMonth(month);
    
    if (budget) {
      await this.update(budget.id, { spent: stats.expense });
    }
  }
};

export const SettingsRepository = {
  async get(): Promise<Settings | null> {
    return getSettings();
  },
  
  async update(updates: Partial<Settings>): Promise<Settings | null> {
    const settings = await getSettings();
    if (!settings) return null;
    
    const now = Date.now();
    const updated = { ...settings, ...updates, updatedAt: now };
    await saveSettings(updated);
    return updated;
  },
  
  async updateStreak(): Promise<number> {
    const settings = await getSettings();
    if (!settings) return 0;
    
    const today = new Date().setHours(0, 0, 0, 0);
    const lastRecord = settings.lastRecordDate ? new Date(settings.lastRecordDate).setHours(0, 0, 0, 0) : null;
    
    let newStreak = settings.streakDays;
    
    if (!lastRecord) {
      newStreak = 1;
    } else if (lastRecord === today) {
    } else if (today - lastRecord === 86400000) {
      newStreak = settings.streakDays + 1;
    } else {
      newStreak = 1;
    }
    
    await this.update({ streakDays: newStreak, lastRecordDate: Date.now() });
    
    if (newStreak >= 7 && !settings.unlockedThemes.includes('bronze')) {
      await this.unlockTheme('bronze');
    }
    if (newStreak >= 30 && !settings.unlockedThemes.includes('gold')) {
      await this.unlockTheme('gold');
    }
    
    return newStreak;
  },
  
  async unlockTheme(theme: string): Promise<void> {
    const settings = await getSettings();
    if (!settings) return;
    
    const unlockedThemes = [...settings.unlockedThemes];
    if (!unlockedThemes.includes(theme)) {
      unlockedThemes.push(theme);
      await this.update({ unlockedThemes });
    }
  }
};

export const QuickAmountRepository = {
  async getAll(): Promise<QuickAmount[]> {
    return getQuickAmounts();
  },
  
  async create(quickAmount: Omit<QuickAmount, 'id'>): Promise<QuickAmount> {
    const quickAmounts = await getQuickAmounts();
    const id = generateId();
    const newQuickAmount: QuickAmount = { ...quickAmount, id };
    quickAmounts.push(newQuickAmount);
    await saveQuickAmounts(quickAmounts);
    return newQuickAmount;
  },
  
  async delete(id: string): Promise<void> {
    const quickAmounts = await getQuickAmounts();
    const index = quickAmounts.findIndex(q => q.id === id);
    if (index !== -1) {
      quickAmounts.splice(index, 1);
      await saveQuickAmounts(quickAmounts);
    }
  }
};

export const clearAllData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.TRANSACTIONS,
    STORAGE_KEYS.CATEGORIES,
    STORAGE_KEYS.BUDGETS,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.QUICK_AMOUNTS
  ]);
  
  const accountStr = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT);
  if (accountStr) {
    const account = JSON.parse(accountStr);
    account.balance = 0;
    account.updatedAt = Date.now();
    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT, JSON.stringify(account));
  }
};
