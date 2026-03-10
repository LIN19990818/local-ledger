import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, isAfter, isBefore, differenceInDays } from 'date-fns';
import { Platform, Alert as RNAlert } from 'react-native';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const confirmBtn = buttons.find(b => b.style !== 'cancel');
      const cancelBtn = buttons.find(b => b.style === 'cancel');
      
      const fullMessage = message ? `${title}\n\n${message}` : title;
      const result = window.confirm(fullMessage);
      
      if (result && confirmBtn?.onPress) {
        confirmBtn.onPress();
      } else if (!result && cancelBtn?.onPress) {
        cancelBtn.onPress();
      }
    } else {
      window.alert(message ? `${title}\n\n${message}` : title);
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    RNAlert.alert(title, message, buttons);
  }
};

export const formatCurrency = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};

export const formatDate = (date: number | Date, formatStr: string = 'yyyy-MM-dd'): string => {
  return format(typeof date === 'number' ? new Date(date) : date, formatStr);
};

export const parseAmountFromText = (text: string): { amount: number; note: string } | null => {
  const patterns = [
    /(\d+(?:\.\d{1,2})?)\s*元?/,
    /(\d+(?:\.\d{1,2})?)\s*块?/,
    /￥(\d+(?:\.\d{1,2})?)/,
    /¥(\d+(?:\.\d{1,2})?)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const note = text.replace(pattern, '').trim();
      return { amount, note };
    }
  }
  
  return null;
};

export const suggestCategoryFromText = (text: string): string | null => {
  const keywords: Record<string, string[]> = {
    food: ['餐', '吃', '饭', '外卖', '奶茶', '咖啡', '早餐', '午餐', '晚餐', '夜宵', '零食', '饮料', '水果'],
    transport: ['交通', '地铁', '公交', '打车', '滴滴', '出租', '加油', '停车', '高铁', '火车', '飞机'],
    shopping: ['购物', '买', '淘宝', '京东', '超市', '衣服', '鞋', '包'],
    entertainment: ['娱乐', '电影', '游戏', 'KTV', '酒吧', '演唱会'],
    medical: ['医疗', '药', '医院', '看病', '体检'],
    education: ['教育', '学习', '课程', '书', '培训'],
    housing: ['房租', '水电', '物业', '维修'],
    communication: ['话费', '流量', '宽带', '充值'],
    salary: ['工资', '薪水', '薪资'],
    bonus: ['奖金', '年终', '提成'],
    investment: ['投资', '理财', '股', '基金', '利息'],
    parttime: ['兼职', '外快'],
    reimbursement: ['报销', '退款']
  };
  
  const lowerText = text.toLowerCase();
  
  for (const [categoryId, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (lowerText.includes(word)) {
        return categoryId;
      }
    }
  }
  
  return null;
};

export const getDateRange = (type: 'day' | 'week' | 'month' | 'year' | 'custom', customStart?: number, customEnd?: number): { start: number; end: number } => {
  const now = new Date();
  
  switch (type) {
    case 'day':
      return {
        start: startOfDay(now).getTime(),
        end: endOfDay(now).getTime()
      };
    case 'week':
      return {
        start: startOfDay(subDays(now, 7)).getTime(),
        end: endOfDay(now).getTime()
      };
    case 'month':
      return {
        start: startOfMonth(now).getTime(),
        end: endOfMonth(now).getTime()
      };
    case 'year':
      return {
        start: startOfYear(now).getTime(),
        end: endOfYear(now).getTime()
      };
    case 'custom':
      return {
        start: customStart || startOfDay(now).getTime(),
        end: customEnd || endOfDay(now).getTime()
      };
  }
};

export const getYesterdayBalance = async (): Promise<number> => {
  return 0;
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export const generateCSV = (transactions: any[]): string => {
  const headers = ['日期', '类型', '分类', '金额', '备注', '标签'];
  const rows = transactions.map(t => [
    formatDate(t.date, 'yyyy-MM-dd HH:mm'),
    t.type === 'income' ? '收入' : '支出',
    t.categoryName,
    t.amount.toFixed(2),
    t.note || '',
    t.tags?.join(',') || ''
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

export const parseCSV = (csvContent: string): Array<{
  date: string;
  type: string;
  category: string;
  amount: number;
  note: string;
  tags: string[];
}> => {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    const parts = line.split(',').map(p => p.trim());
    return {
      date: parts[0] || '',
      type: parts[1] || '支出',
      category: parts[2] || '其他支出',
      amount: parseFloat(parts[3]) || 0,
      note: parts[4] || '',
      tags: parts[5]?.split(';').filter(Boolean) || []
    };
  });
};

export const validateAmount = (amount: number, balance: number, type: 'income' | 'expense'): { valid: boolean; message?: string } => {
  if (amount <= 0) {
    return { valid: false, message: '金额必须大于0' };
  }
  
  if (amount > 999999999) {
    return { valid: false, message: '金额超出限制' };
  }
  
  if (type === 'expense' && amount > balance) {
    return { valid: false, message: '余额不足，无法完成支出' };
  }
  
  return { valid: true };
};

export const checkBudgetWarning = (spent: number, budget: number): { level: 'safe' | 'warning' | 'danger'; message?: string } => {
  const percentage = calculatePercentage(spent, budget);
  
  if (percentage >= 100) {
    return { level: 'danger', message: '本月支出已超过预算！' };
  }
  
  if (percentage >= 90) {
    return { level: 'warning', message: '本月支出已达预算的90%，请注意控制' };
  }
  
  return { level: 'safe' };
};

export const checkBalanceWarning = (balance: number, threshold: number): boolean => {
  return balance < threshold;
};
