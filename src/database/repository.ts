import { Platform } from 'react-native';
import { Transaction, Category, Account, Budget, Settings, QuickAmount } from '../types';
import { format } from 'date-fns';
import { isWeb } from './init';

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const mapRowToTransaction = (row: any): Transaction => {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryIcon,
    note: row.note || '',
    tags: JSON.parse(row.tags || '[]'),
    attachments: JSON.parse(row.attachments || '[]'),
    date: row.date,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const mapRowToCategory = (row: any): Category => {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    type: row.type,
    isDefault: row.isDefault === 1,
    isVisible: row.isVisible === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const mapRowToAccount = (row: any): Account => {
  return {
    id: row.id,
    name: row.name,
    balance: row.balance,
    warningThreshold: row.warningThreshold,
    largeAmountThreshold: row.largeAmountThreshold,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const mapRowToBudget = (row: any): Budget => {
  return {
    id: row.id,
    month: row.month,
    amount: row.amount,
    spent: row.spent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const mapRowToSettings = (row: any): Settings => {
  return {
    id: row.id,
    isAppLocked: row.isAppLocked === 1,
    biometricEnabled: row.biometricEnabled === 1,
    pinCode: row.pinCode,
    theme: row.theme,
    defaultCategories: row.defaultCategories === 1,
    autoBackup: row.autoBackup === 1,
    backupPath: row.backupPath,
    lastBackupDate: row.lastBackupDate,
    streakDays: row.streakDays,
    lastRecordDate: row.lastRecordDate,
    unlockedThemes: JSON.parse(row.unlockedThemes || '[]'),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const getNativeDB = async () => {
  const { getNativeDatabase } = await import('./native');
  return getNativeDatabase();
};

const updateBalance = async (type: 'income' | 'expense', amount: number): Promise<void> => {
  if (isWeb) return;
  const db = await getNativeDB();
  const now = Date.now();
  const change = type === 'income' ? amount : -amount;
  
  await db.runAsync(
    'UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?',
    [change, now, 'default']
  );
};

export const TransactionRepository = {
  async create(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.create(transaction);
    }
    
    const db = await getNativeDB();
    const now = Date.now();
    const id = generateId();
    
    await db.runAsync(
      `INSERT INTO transactions (id, amount, type, categoryId, categoryName, categoryIcon, note, tags, attachments, date, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transaction.amount,
        transaction.type,
        transaction.categoryId,
        transaction.categoryName,
        transaction.categoryIcon,
        transaction.note || '',
        JSON.stringify(transaction.tags || []),
        JSON.stringify(transaction.attachments || []),
        transaction.date,
        now,
        now
      ]
    );
    
    await updateBalance(transaction.type, transaction.amount);
    
    return { ...transaction, id, createdAt: now, updatedAt: now };
  },
  
  async update(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.update(id, updates);
    }
    
    const db = await getNativeDB();
    const existing = await this.getById(id);
    if (!existing) return null;
    
    const now = Date.now();
    const updated = { ...existing, ...updates, updatedAt: now };
    
    if (updates.amount !== undefined || updates.type !== undefined) {
      const oldAmount = existing.type === 'expense' ? -existing.amount : existing.amount;
      const newAmount = updated.type === 'expense' ? -updated.amount : updated.amount;
      const diff = newAmount - oldAmount;
      
      await db.runAsync(
        'UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?',
        [diff, now, 'default']
      );
    }
    
    await db.runAsync(
      `UPDATE transactions SET amount = ?, type = ?, categoryId = ?, categoryName = ?, categoryIcon = ?, note = ?, tags = ?, attachments = ?, date = ?, updatedAt = ? WHERE id = ?`,
      [
        updated.amount,
        updated.type,
        updated.categoryId,
        updated.categoryName,
        updated.categoryIcon,
        updated.note,
        JSON.stringify(updated.tags),
        JSON.stringify(updated.attachments),
        updated.date,
        now,
        id
      ]
    );
    
    return updated;
  },
  
  async delete(id: string): Promise<boolean> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.delete(id);
    }
    
    const db = await getNativeDB();
    const transaction = await this.getById(id);
    if (!transaction) return false;
    
    const reverseAmount = transaction.type === 'expense' ? transaction.amount : -transaction.amount;
    const now = Date.now();
    
    await db.runAsync(
      'UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?',
      [reverseAmount, now, 'default']
    );
    
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    return true;
  },
  
  async deleteMany(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (await this.delete(id)) count++;
    }
    return count;
  },
  
  async getById(id: string): Promise<Transaction | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getById(id);
    }
    
    const db = await getNativeDB();
    const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
    return row ? mapRowToTransaction(row) : null;
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
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getAll(options);
    }
    
    const db = await getNativeDB();
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params: any[] = [];
    
    if (options?.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }
    if (options?.categoryId) {
      query += ' AND categoryId = ?';
      params.push(options.categoryId);
    }
    if (options?.startDate) {
      query += ' AND date >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      query += ' AND date <= ?';
      params.push(options.endDate);
    }
    if (options?.tags && options.tags.length > 0) {
      query += ' AND (' + options.tags.map(() => 'tags LIKE ?').join(' OR ') + ')';
      params.push(...options.tags.map(tag => `%"${tag}"%`));
    }
    
    query += ' ORDER BY date DESC, createdAt DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
    
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(mapRowToTransaction);
  },
  
  async getDailyStats(date: number): Promise<{ income: number; expense: number; net: number }> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getDailyStats(date);
    }
    
    const db = await getNativeDB();
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);
    
    const rows = await db.getAllAsync<any>(
      'SELECT type, SUM(amount) as total FROM transactions WHERE date >= ? AND date <= ? GROUP BY type',
      [startOfDay, endOfDay]
    );
    
    let income = 0;
    let expense = 0;
    
    for (const row of rows) {
      if (row.type === 'income') income = row.total || 0;
      else expense = row.total || 0;
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getMonthlyStats(yearMonth: string): Promise<{ income: number; expense: number; net: number }> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getMonthlyStats(yearMonth);
    }
    
    const db = await getNativeDB();
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).getTime();
    
    const rows = await db.getAllAsync<any>(
      'SELECT type, SUM(amount) as total FROM transactions WHERE date >= ? AND date <= ? GROUP BY type',
      [startDate, endDate]
    );
    
    let income = 0;
    let expense = 0;
    
    for (const row of rows) {
      if (row.type === 'income') income = row.total || 0;
      else expense = row.total || 0;
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getYearlyStats(year: number): Promise<{ income: number; expense: number; net: number }> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getYearlyStats(year);
    }
    
    const db = await getNativeDB();
    const startDate = new Date(year, 0, 1).getTime();
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    
    const rows = await db.getAllAsync<any>(
      'SELECT type, SUM(amount) as total FROM transactions WHERE date >= ? AND date <= ? GROUP BY type',
      [startDate, endDate]
    );
    
    let income = 0;
    let expense = 0;
    
    for (const row of rows) {
      if (row.type === 'income') income = row.total || 0;
      else expense = row.total || 0;
    }
    
    return { income, expense, net: income - expense };
  },
  
  async getCategoryBreakdown(startDate: number, endDate: number, type: 'income' | 'expense' = 'expense'): Promise<{ categoryId: string; categoryName: string; categoryIcon: string; amount: number; count: number }[]> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getCategoryBreakdown(startDate, endDate, type);
    }
    
    const db = await getNativeDB();
    const rows = await db.getAllAsync<any>(
      `SELECT categoryId, categoryName, categoryIcon, SUM(amount) as amount, COUNT(*) as count 
       FROM transactions 
       WHERE date >= ? AND date <= ? AND type = ?
       GROUP BY categoryId
       ORDER BY amount DESC`,
      [startDate, endDate, type]
    );
    
    return rows.map(row => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      amount: row.amount || 0,
      count: row.count || 0
    }));
  },
  
  async getMonthlyTrend(year: number): Promise<{ month: string; income: number; expense: number }[]> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.TransactionRepository.getMonthlyTrend(year);
    }
    
    const db = await getNativeDB();
    const result: { month: string; income: number; expense: number }[] = [];
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1).getTime();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
      
      const rows = await db.getAllAsync<any>(
        'SELECT type, SUM(amount) as total FROM transactions WHERE date >= ? AND date <= ? GROUP BY type',
        [startDate, endDate]
      );
      
      let income = 0;
      let expense = 0;
      
      for (const row of rows) {
        if (row.type === 'income') income = row.total || 0;
        else expense = row.total || 0;
      }
      
      result.push({
        month: format(new Date(year, month, 1), 'yyyy-MM'),
        income,
        expense
      });
    }
    
    return result;
  }
};

export const CategoryRepository = {
  async create(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.CategoryRepository.create(category);
    }
    
    const db = await getNativeDB();
    const now = Date.now();
    const id = generateId();
    
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, type, isDefault, isVisible, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, category.name, category.icon, category.type, category.isDefault ? 1 : 0, category.isVisible ? 1 : 0, now, now]
    );
    
    return { ...category, id, createdAt: now, updatedAt: now };
  },
  
  async update(id: string, updates: Partial<Category>): Promise<Category | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.CategoryRepository.update(id, updates);
    }
    
    const db = await getNativeDB();
    const existing = await this.getById(id);
    if (!existing) return null;
    
    const now = Date.now();
    const updated = { ...existing, ...updates, updatedAt: now };
    
    await db.runAsync(
      `UPDATE categories SET name = ?, icon = ?, type = ?, isDefault = ?, isVisible = ?, updatedAt = ? WHERE id = ?`,
      [updated.name, updated.icon, updated.type, updated.isDefault ? 1 : 0, updated.isVisible ? 1 : 0, now, id]
    );
    
    return updated;
  },
  
  async delete(id: string): Promise<boolean> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.CategoryRepository.delete(id);
    }
    
    const db = await getNativeDB();
    const category = await this.getById(id);
    if (!category || category.isDefault) return false;
    
    await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    return true;
  },
  
  async getById(id: string): Promise<Category | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.CategoryRepository.getById(id);
    }
    
    const db = await getNativeDB();
    const row = await db.getFirstAsync<any>('SELECT * FROM categories WHERE id = ?', [id]);
    return row ? mapRowToCategory(row) : null;
  },
  
  async getAll(type?: 'income' | 'expense'): Promise<Category[]> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.CategoryRepository.getAll(type);
    }
    
    const db = await getNativeDB();
    let query = 'SELECT * FROM categories WHERE isVisible = 1';
    const params: any[] = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY isDefault DESC, name ASC';
    
    const rows = await db.getAllAsync<any>(query, params);
    return rows.map(mapRowToCategory);
  }
};

export const AccountRepository = {
  async get(): Promise<Account | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.AccountRepository.get();
    }
    
    const db = await getNativeDB();
    const row = await db.getFirstAsync<any>('SELECT * FROM accounts WHERE id = ?', ['default']);
    return row ? mapRowToAccount(row) : null;
  },
  
  async update(updates: Partial<Account>): Promise<Account | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.AccountRepository.update(updates);
    }
    
    const db = await getNativeDB();
    const existing = await this.get();
    if (!existing) return null;
    
    const now = Date.now();
    const updated = { ...existing, ...updates, updatedAt: now };
    
    await db.runAsync(
      `UPDATE accounts SET name = ?, balance = ?, warningThreshold = ?, largeAmountThreshold = ?, updatedAt = ? WHERE id = ?`,
      [updated.name, updated.balance, updated.warningThreshold, updated.largeAmountThreshold, now, 'default']
    );
    
    return updated;
  }
};

export const BudgetRepository = {
  async create(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.BudgetRepository.create(budget);
    }
    
    const db = await getNativeDB();
    const now = Date.now();
    const id = generateId();
    
    await db.runAsync(
      `INSERT INTO budgets (id, month, amount, spent, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, budget.month, budget.amount, budget.spent || 0, now, now]
    );
    
    return { ...budget, id, createdAt: now, updatedAt: now };
  },
  
  async getByMonth(month: string): Promise<Budget | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.BudgetRepository.getByMonth(month);
    }
    
    const db = await getNativeDB();
    const row = await db.getFirstAsync<any>('SELECT * FROM budgets WHERE month = ?', [month]);
    return row ? mapRowToBudget(row) : null;
  },
  
  async update(id: string, updates: Partial<Budget>): Promise<Budget | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.BudgetRepository.update(id, updates);
    }
    
    const db = await getNativeDB();
    const existing = await db.getFirstAsync<any>('SELECT * FROM budgets WHERE id = ?', [id]);
    if (!existing) return null;
    
    const now = Date.now();
    const updated = { ...mapRowToBudget(existing), ...updates, updatedAt: now };
    
    await db.runAsync(
      `UPDATE budgets SET month = ?, amount = ?, spent = ?, updatedAt = ? WHERE id = ?`,
      [updated.month, updated.amount, updated.spent, now, id]
    );
    
    return updated;
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
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.SettingsRepository.get();
    }
    
    const db = await getNativeDB();
    const row = await db.getFirstAsync<any>('SELECT * FROM settings WHERE id = ?', ['default']);
    return row ? mapRowToSettings(row) : null;
  },
  
  async update(updates: Partial<Settings>): Promise<Settings | null> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.SettingsRepository.update(updates);
    }
    
    const db = await getNativeDB();
    const existing = await this.get();
    if (!existing) return null;
    
    const now = Date.now();
    const updated = { ...existing, ...updates, updatedAt: now };
    
    await db.runAsync(
      `UPDATE settings SET isAppLocked = ?, biometricEnabled = ?, pinCode = ?, theme = ?, defaultCategories = ?, autoBackup = ?, backupPath = ?, lastBackupDate = ?, streakDays = ?, lastRecordDate = ?, unlockedThemes = ?, updatedAt = ? WHERE id = ?`,
      [
        updated.isAppLocked ? 1 : 0,
        updated.biometricEnabled ? 1 : 0,
        updated.pinCode,
        updated.theme,
        updated.defaultCategories ? 1 : 0,
        updated.autoBackup ? 1 : 0,
        updated.backupPath,
        updated.lastBackupDate,
        updated.streakDays,
        updated.lastRecordDate,
        JSON.stringify(updated.unlockedThemes),
        now,
        'default'
      ]
    );
    
    return updated;
  },
  
  async updateStreak(): Promise<number> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.SettingsRepository.updateStreak();
    }
    
    const settings = await this.get();
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
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.SettingsRepository.unlockTheme(theme);
    }
    
    const settings = await this.get();
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
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.QuickAmountRepository.getAll();
    }
    
    const db = await getNativeDB();
    const rows = await db.getAllAsync<any>('SELECT * FROM quick_amounts');
    return rows.map(row => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon
    }));
  },
  
  async create(quickAmount: Omit<QuickAmount, 'id'>): Promise<QuickAmount> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.QuickAmountRepository.create(quickAmount);
    }
    
    const db = await getNativeDB();
    const id = generateId();
    
    await db.runAsync(
      `INSERT INTO quick_amounts (id, amount, type, categoryId, categoryName, categoryIcon)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, quickAmount.amount, quickAmount.type, quickAmount.categoryId, quickAmount.categoryName, quickAmount.categoryIcon]
    );
    
    return { ...quickAmount, id };
  },
  
  async delete(id: string): Promise<void> {
    if (isWeb) {
      const webRepo = await import('./webStorage');
      return webRepo.QuickAmountRepository.delete(id);
    }
    
    const db = await getNativeDB();
    await db.runAsync('DELETE FROM quick_amounts WHERE id = ?', [id]);
  }
};
