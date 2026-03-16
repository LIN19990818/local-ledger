import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { TransactionRepository, CategoryRepository, AccountRepository, BudgetRepository, SettingsRepository } from '../database/repository';
import { format } from 'date-fns';

const BACKUP_DIR_NAME = 'backups';
const MAX_BACKUP_FILES = 2;
const BACKUP_VERSION = '1.0.6';

export interface BackupInfo {
  fileName: string;
  uri: string;
  createdAt: number;
  size: number;
}

export interface AutoBackupResult {
  success: boolean;
  message: string;
  backupInfo?: BackupInfo;
}

async function getBackupDirectory(): Promise<Directory | null> {
  const baseDir = Paths.document || Paths.cache;
  if (!baseDir) return null;
  
  const backupDir = new Directory(baseDir, BACKUP_DIR_NAME);
  
  if (!backupDir.exists) {
    backupDir.create({ intermediates: true });
  }
  
  return backupDir;
}

export async function getBackupFiles(): Promise<BackupInfo[]> {
  try {
    const backupDir = await getBackupDirectory();
    if (!backupDir) return [];
    
    const files = backupDir.list();
    const backupFiles: BackupInfo[] = [];
    
    for (const file of files) {
      if (file instanceof File && file.name.endsWith('.json')) {
        const info = file.info();
        backupFiles.push({
          fileName: file.name,
          uri: file.uri,
          createdAt: info.modificationTime || 0,
          size: info.size || 0
        });
      }
    }
    
    return backupFiles.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('获取备份文件列表失败:', error);
    return [];
  }
}

export async function performAutoBackup(): Promise<AutoBackupResult> {
  console.log('=== 开始自动备份 ===');
  
  try {
    const backupDir = await getBackupDirectory();
    if (!backupDir) {
      return { success: false, message: '无法获取备份目录' };
    }
    
    const transactions = await TransactionRepository.getAll();
    const categories = await CategoryRepository.getAll();
    const account = await AccountRepository.get();
    const budgets = await BudgetRepository.getAll();
    const settings = await SettingsRepository.get();
    
    const backupData = {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      transactions,
      categories,
      account: account ? [account] : [],
      budgets,
      settings
    };
    
    const fileName = `auto_backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
    const content = JSON.stringify(backupData, null, 2);
    
    const backupFile = new File(backupDir, fileName);
    await backupFile.write(content, { encoding: 'utf8' });
    
    console.log('备份文件创建成功:', fileName);
    
    const existingBackups = await getBackupFiles();
    while (existingBackups.length > MAX_BACKUP_FILES) {
      const oldestBackup = existingBackups.pop();
      if (oldestBackup) {
        const oldFile = new File(oldestBackup.uri);
        await oldFile.delete();
        console.log('删除旧备份:', oldestBackup.fileName);
      }
    }
    
    const settingsData = await SettingsRepository.get();
    if (settingsData) {
      await SettingsRepository.update({
        ...settingsData,
        lastBackupDate: Date.now()
      });
    }
    
    return {
      success: true,
      message: '自动备份成功',
      backupInfo: {
        fileName,
        uri: backupFile.uri,
        createdAt: Date.now(),
        size: content.length
      }
    };
  } catch (error) {
    console.error('自动备份失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '备份失败'
    };
  }
}

export async function checkAndPerformAutoBackup(): Promise<AutoBackupResult | null> {
  try {
    const settings = await SettingsRepository.get();
    
    if (!settings?.autoBackup) {
      console.log('自动备份已关闭');
      return null;
    }
    
    const now = Date.now();
    const lastBackup = settings.lastBackupDate || 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - lastBackup < oneDayMs) {
      console.log('距离上次备份不足一天，跳过');
      return null;
    }
    
    console.log('执行每日自动备份...');
    return await performAutoBackup();
  } catch (error) {
    console.error('检查自动备份失败:', error);
    return null;
  }
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBackupDate(timestamp: number): string {
  if (!timestamp) return '未知';
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
}
