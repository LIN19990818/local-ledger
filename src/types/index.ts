export type TransactionType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: TransactionType;
  isDefault: boolean;
  isVisible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  note: string;
  tags: string[];
  attachments: string[];
  date: number;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  warningThreshold: number;
  largeAmountThreshold: number;
  createdAt: number;
  updatedAt: number;
}

export interface Budget {
  id: string;
  month: string;
  amount: number;
  spent: number;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id: string;
  isAppLocked: boolean;
  biometricEnabled: boolean;
  pinCode: string | null;
  operationPassword: string | null;
  theme: 'light' | 'dark' | 'system';
  defaultCategories: boolean;
  autoBackup: boolean;
  backupPath: string;
  lastBackupDate: number | null;
  streakDays: number;
  lastRecordDate: number | null;
  unlockedThemes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DailyStats {
  date: string;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
}

export interface MonthlyStats {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  categoryBreakdown: CategoryBreakdown[];
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface YearlyStats {
  year: string;
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  monthlyData: MonthlyData[];
  topCategory: {
    name: string;
    amount: number;
    percentage: number;
  };
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

export interface BackupData {
  version: string;
  exportedAt: number;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  settings: Settings;
}

export interface QuickAmount {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
}
