import { create } from 'zustand';
import { Transaction, Category, Account, Budget, Settings, QuickAmount } from '../types';
import { 
  TransactionRepository, 
  CategoryRepository, 
  AccountRepository, 
  BudgetRepository, 
  SettingsRepository,
  QuickAmountRepository 
} from '../database/repository';
import { format } from 'date-fns';

interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  account: Account | null;
  categories: Category[];
  settings: Settings | null;
  transactions: Transaction[];
  budget: Budget | null;
  quickAmounts: QuickAmount[];
  
  initialize: () => Promise<void>;
  
  refreshAccount: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshTransactions: (options?: {
    type?: 'income' | 'expense';
    categoryId?: string;
    startDate?: number;
    endDate?: number;
    tags?: string[];
    limit?: number;
  }) => Promise<void>;
  refreshBudget: () => Promise<void>;
  refreshQuickAmounts: () => Promise<void>;
  
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<Transaction | null>;
  deleteTransaction: (id: string) => Promise<boolean>;
  deleteTransactions: (ids: string[]) => Promise<number>;
  
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<Category | null>;
  deleteCategory: (id: string) => Promise<boolean>;
  
  updateAccount: (updates: Partial<Account>) => Promise<Account | null>;
  
  updateSettings: (updates: Partial<Settings>) => Promise<Settings | null>;
  
  setBudget: (month: string, amount: number) => Promise<Budget>;
  
  addQuickAmount: (quickAmount: Omit<QuickAmount, 'id'>) => Promise<QuickAmount>;
  deleteQuickAmount: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  isInitialized: false,
  isLoading: true,
  account: null,
  categories: [],
  settings: null,
  transactions: [],
  budget: null,
  quickAmounts: [],
  
  initialize: async () => {
    try {
      set({ isLoading: true });
      
      const [account, categories, settings, budget, quickAmounts, transactions] = await Promise.all([
        AccountRepository.get(),
        CategoryRepository.getAll(),
        SettingsRepository.get(),
        BudgetRepository.getByMonth(format(new Date(), 'yyyy-MM')),
        QuickAmountRepository.getAll(),
        TransactionRepository.getAll()
      ]);
      
      set({
        isInitialized: true,
        isLoading: false,
        account,
        categories,
        settings,
        budget,
        quickAmounts,
        transactions
      });
    } catch (error) {
      console.error('Failed to initialize:', error);
      set({ isLoading: false });
    }
  },
  
  refreshAccount: async () => {
    const account = await AccountRepository.get();
    set({ account });
  },
  
  refreshCategories: async () => {
    const categories = await CategoryRepository.getAll();
    set({ categories });
  },
  
  refreshSettings: async () => {
    const settings = await SettingsRepository.get();
    set({ settings });
  },
  
  refreshTransactions: async (options) => {
    const transactions = await TransactionRepository.getAll(options);
    set({ transactions });
  },
  
  refreshBudget: async () => {
    const budget = await BudgetRepository.getByMonth(format(new Date(), 'yyyy-MM'));
    set({ budget });
  },
  
  refreshQuickAmounts: async () => {
    const quickAmounts = await QuickAmountRepository.getAll();
    set({ quickAmounts });
  },
  
  addTransaction: async (transaction) => {
    const newTransaction = await TransactionRepository.create(transaction);
    await get().refreshAccount();
    await get().refreshTransactions();
    await SettingsRepository.updateStreak();
    await get().refreshSettings();
    await BudgetRepository.updateSpent(format(new Date(transaction.date), 'yyyy-MM'));
    await get().refreshBudget();
    return newTransaction;
  },
  
  updateTransaction: async (id, updates) => {
    const updated = await TransactionRepository.update(id, updates);
    if (updated) {
      await get().refreshAccount();
      await get().refreshTransactions();
    }
    return updated;
  },
  
  deleteTransaction: async (id) => {
    const success = await TransactionRepository.delete(id);
    if (success) {
      await get().refreshAccount();
      await get().refreshTransactions();
    }
    return success;
  },
  
  deleteTransactions: async (ids) => {
    const count = await TransactionRepository.deleteMany(ids);
    await get().refreshAccount();
    await get().refreshTransactions();
    return count;
  },
  
  addCategory: async (category) => {
    const newCategory = await CategoryRepository.create(category);
    await get().refreshCategories();
    return newCategory;
  },
  
  updateCategory: async (id, updates) => {
    const updated = await CategoryRepository.update(id, updates);
    if (updated) {
      await get().refreshCategories();
    }
    return updated;
  },
  
  deleteCategory: async (id) => {
    const success = await CategoryRepository.delete(id);
    if (success) {
      await get().refreshCategories();
    }
    return success;
  },
  
  updateAccount: async (updates) => {
    const updated = await AccountRepository.update(updates);
    if (updated) {
      set({ account: updated });
    }
    return updated;
  },
  
  updateSettings: async (updates) => {
    const updated = await SettingsRepository.update(updates);
    if (updated) {
      set({ settings: updated });
    }
    return updated;
  },
  
  setBudget: async (month, amount) => {
    let budget = await BudgetRepository.getByMonth(month);
    
    if (budget) {
      budget = await BudgetRepository.update(budget.id, { amount });
    } else {
      budget = await BudgetRepository.create({ month, amount, spent: 0 });
    }
    
    await BudgetRepository.updateSpent(month);
    set({ budget: await BudgetRepository.getByMonth(month) });
    return budget!;
  },
  
  addQuickAmount: async (quickAmount) => {
    const newQuickAmount = await QuickAmountRepository.create(quickAmount);
    await get().refreshQuickAmounts();
    return newQuickAmount;
  },
  
  deleteQuickAmount: async (id) => {
    await QuickAmountRepository.delete(id);
    await get().refreshQuickAmounts();
  }
}));
