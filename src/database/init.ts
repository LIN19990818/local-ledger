import { Platform } from 'react-native';
import { Transaction, Category, Account, Budget, Settings, QuickAmount } from '../types';

let isWeb = Platform.OS === 'web';

export const initDatabase = async (): Promise<void> => {
  if (isWeb) {
    const { initDatabase: initWeb } = await import('./webStorage');
    return initWeb();
  }
  
  const { initNativeDatabase } = await import('./native');
  return initNativeDatabase();
};

export const getDatabase = () => {
  if (isWeb) {
    return { isWeb: true };
  }
  const { getNativeDatabase } = require('./native');
  return getNativeDatabase();
};

export const closeDatabase = async (): Promise<void> => {
  if (!isWeb) {
    const { closeNativeDatabase } = await import('./native');
    return closeNativeDatabase();
  }
};

export { isWeb };
