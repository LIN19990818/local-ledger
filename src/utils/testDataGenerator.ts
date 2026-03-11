import { TransactionRepository, CategoryRepository, AccountRepository } from '../database/repository';
import { Transaction } from '../types';

export async function generateTestData() {
  const categories = await CategoryRepository.getAll();
  
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const twoDays = 2 * oneDay;
  const threeDays = 3 * oneDay;
  
  const testTransactions: Omit<Transaction, 'id'>[] = [
    {
      amount: 500,
      type: 'expense',
      categoryId: expenseCategories[0]?.id || 'expense_1',
      categoryName: expenseCategories[0]?.name || '餐饮',
      categoryIcon: expenseCategories[0]?.icon || '🍔',
      date: now,
      note: '午餐',
      tags: ['工作'],
      createdAt: now,
      updatedAt: now
    },
    {
      amount: 300,
      type: 'expense',
      categoryId: expenseCategories[1]?.id || 'expense_2',
      categoryName: expenseCategories[1]?.name || '交通',
      categoryIcon: expenseCategories[1]?.icon || '🚗',
      date: now - oneDay,
      note: '地铁',
      tags: ['通勤'],
      createdAt: now - oneDay,
      updatedAt: now - oneDay
    },
    {
      amount: 200,
      type: 'expense',
      categoryId: expenseCategories[2]?.id || 'expense_3',
      categoryName: expenseCategories[2]?.name || '购物',
      categoryIcon: expenseCategories[2]?.icon || '🛍',
      date: now - twoDays,
      note: '日用品',
      tags: ['生活'],
      createdAt: now - twoDays,
      updatedAt: now - twoDays
    },
    {
      amount: 8000,
      type: 'income',
      categoryId: incomeCategories[0]?.id || 'income_1',
      categoryName: incomeCategories[0]?.name || '工资',
      categoryIcon: incomeCategories[0]?.icon || '💰',
      date: now - threeDays,
      note: '3月工资',
      tags: ['工资'],
      createdAt: now - threeDays,
      updatedAt: now - threeDays
    },
    {
      amount: 5000,
      type: 'income',
      categoryId: incomeCategories[1]?.id || 'income_2',
      categoryName: incomeCategories[1]?.name || '奖金',
      categoryIcon: incomeCategories[1]?.icon || '🎁',
      date: now - oneDay,
      note: '项目奖金',
      tags: ['奖金'],
      createdAt: now - oneDay,
      updatedAt: now - oneDay
    },
    {
      amount: 150,
      type: 'expense',
      categoryId: expenseCategories[3]?.id || 'expense_4',
      categoryName: expenseCategories[3]?.name || '娱乐',
      categoryIcon: expenseCategories[3]?.icon || '🎮',
      date: now,
      note: '电影票',
      tags: ['娱乐'],
      createdAt: now,
      updatedAt: now
    },
    {
      amount: 80,
      type: 'expense',
      categoryId: expenseCategories[4]?.id || 'expense_5',
      categoryName: expenseCategories[4]?.name || '通讯',
      categoryIcon: expenseCategories[4]?.icon || '📱',
      date: now - oneDay,
      note: '话费',
      tags: ['通讯'],
      createdAt: now - oneDay,
      updatedAt: now - oneDay
    }
  ];
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  for (const t of testTransactions) {
    const id = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await TransactionRepository.create({
      ...t,
      id
    });
    
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  }
  
  const balance = totalIncome - totalExpense;
  await AccountRepository.update({ balance });
  
  return {
    success: true,
    count: testTransactions.length,
    totalIncome,
    totalExpense,
    balance,
    transactions: testTransactions
  };
}
