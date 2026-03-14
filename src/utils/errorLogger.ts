import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ERROR_LOG_KEY = 'ledger_error_logs';
const MAX_LOGS = 100;

export interface ErrorLog {
  timestamp: number;
  message: string;
  stack?: string;
  component?: string;
  platform: string;
}

export const ErrorLogger = {
  async log(error: Error | string, component?: string): Promise<void> {
    try {
      const logs = await this.getLogs();
      
      const newLog: ErrorLog = {
        timestamp: Date.now(),
        message: typeof error === 'string' ? error : error.message,
        stack: typeof error === 'string' ? undefined : error.stack,
        component,
        platform: Platform.OS
      };
      
      logs.unshift(newLog);
      
      if (logs.length > MAX_LOGS) {
        logs.splice(MAX_LOGS);
      }
      
      await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save error log:', e);
    }
  },
  
  async getLogs(): Promise<ErrorLog[]> {
    try {
      const logs = await AsyncStorage.getItem(ERROR_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  },
  
  async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ERROR_LOG_KEY);
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  },
  
  setupGlobalHandler(): void {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      this.log(message, 'console.error');
      originalConsoleError.apply(console, args);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.log(event.error || event.message, 'window.onerror');
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        this.log(event.reason || 'Unhandled Promise Rejection', 'unhandledrejection');
      });
    }
  }
};
