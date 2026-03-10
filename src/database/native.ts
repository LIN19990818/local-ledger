import * as SQLite from 'expo-sqlite';
import { Transaction, Category, Account, Budget, Settings, QuickAmount } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export const initNativeDatabase = async (): Promise<void> => {
  db = await SQLite.openDatabaseAsync('local_ledger.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      type TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      isVisible INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      categoryName TEXT NOT NULL,
      categoryIcon TEXT NOT NULL,
      note TEXT,
      tags TEXT,
      attachments TEXT,
      date INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      warningThreshold REAL NOT NULL DEFAULT 100,
      largeAmountThreshold REAL NOT NULL DEFAULT 500,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      spent REAL NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      isAppLocked INTEGER NOT NULL DEFAULT 0,
      biometricEnabled INTEGER NOT NULL DEFAULT 0,
      pinCode TEXT,
      theme TEXT NOT NULL DEFAULT 'system',
      defaultCategories INTEGER NOT NULL DEFAULT 1,
      autoBackup INTEGER NOT NULL DEFAULT 1,
      backupPath TEXT,
      lastBackupDate INTEGER,
      streakDays INTEGER NOT NULL DEFAULT 0,
      lastRecordDate INTEGER,
      unlockedThemes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS quick_amounts (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      categoryName TEXT NOT NULL,
      categoryIcon TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_categoryId ON transactions(categoryId);
    CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
  `);
  
  await initDefaultData();
};

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

const initDefaultData = async (): Promise<void> => {
  if (!db) return;
  
  const settingsCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM settings');
  if (settingsCount?.count === 0) {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO settings (id, isAppLocked, biometricEnabled, theme, defaultCategories, autoBackup, streakDays, unlockedThemes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['default', 0, 0, 'system', 1, 1, 0, '[]', now, now]
    );
  }
  
  const now = Date.now();
  for (const category of defaultCategoriesData) {
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ?', [category.id]);
    if (!existing) {
      await db.runAsync(
        `INSERT INTO categories (id, name, icon, type, isDefault, isVisible, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [category.id, category.name, category.icon, category.type, category.isDefault ? 1 : 0, category.isVisible ? 1 : 0, now, now]
      );
    }
  }
  
  const accountsCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts');
  if (accountsCount?.count === 0) {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO accounts (id, name, balance, warningThreshold, largeAmountThreshold, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['default', '默认账户', 0, 100, 500, now, now]
    );
  }
};

export const getNativeDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const closeNativeDatabase = async (): Promise<void> => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};
