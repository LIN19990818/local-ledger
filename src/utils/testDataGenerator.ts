import { TransactionRepository, CategoryRepository, AccountRepository } from '../database/repository';
import { Transaction } from '../types';

export async function generateTestData() {
  const categories = await CategoryRepository.getAll();
  
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;
  
  const testTransactions: Omit<Transaction, 'id'>[] = [];
  
  for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
    const monthBase = now - (monthOffset * oneMonth);
    
    testTransactions.push({
      amount: 8000 + Math.floor(Math.random() * 2000),
      type: 'income',
      categoryId: incomeCategories[0]?.id || 'income_1',
      categoryName: incomeCategories[0]?.name || '工资',
      categoryIcon: incomeCategories[0]?.icon || '💰',
      date: monthBase,
      note: `${monthOffset + 1}月工资`,
      tags: ['工资'],
      createdAt: monthBase,
      updatedAt: monthBase
    });
    
    if (Math.random() > 0.5) {
      testTransactions.push({
        amount: 1000 + Math.floor(Math.random() * 3000),
        type: 'income',
        categoryId: incomeCategories[1]?.id || 'income_2',
        categoryName: incomeCategories[1]?.name || '奖金',
        categoryIcon: incomeCategories[1]?.icon || '🎁',
        date: monthBase - oneDay * 5,
        note: `${monthOffset + 1}月奖金`,
        tags: ['奖金'],
        createdAt: monthBase - oneDay * 5,
        updatedAt: monthBase - oneDay * 5
      });
    }
    
    const expenseCount = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < expenseCount; i++) {
      const categoryIndex = Math.floor(Math.random() * expenseCategories.length);
      const category = expenseCategories[categoryIndex];
      const amount = 50 + Math.floor(Math.random() * 500);
      
      testTransactions.push({
        amount,
        type: 'expense',
        categoryId: category?.id || `expense_${categoryIndex + 1}`,
        categoryName: category?.name || '餐饮',
        categoryIcon: category?.icon || '🍔',
        date: monthBase - oneDay * i,
        note: `${category?.name || '餐饮'}消费`,
        tags: ['日常'],
        createdAt: monthBase - oneDay * i,
        updatedAt: monthBase - oneDay * i
      });
    }
  }
  
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
    balance
  };
}
