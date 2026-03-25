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
  console.log('=== 获取备份目录 ===');
  console.log('Platform:', Platform.OS);
  
  try {
    console.log('Paths.cache:', Paths.cache?.uri);
    console.log('Paths.document:', Paths.document?.uri);
    
    const candidates = [
      { dir: Paths.document, name: 'document目录' },
      { dir: Paths.cache, name: 'cache目录' },
    ];
    
    for (const candidate of candidates) {
      if (!candidate.dir) {
        console.log(`跳过 ${candidate.name}: 目录为空`);
        continue;
      }
      
      console.log(`检查 ${candidate.name}: ${candidate.dir.uri}`);
      
      try {
        const exists = candidate.dir.exists;
        console.log(`${candidate.name} exists:`, exists);
        
        if (!exists) {
          console.log(`创建 ${candidate.name}...`);
          candidate.dir.create({ intermediates: true });
          console.log(`${candidate.name} 创建成功`);
        }
        
        const backupDir = new Directory(candidate.dir, BACKUP_DIR_NAME);
        console.log(`备份目录路径: ${backupDir.uri}`);
        
        const backupExists = backupDir.exists;
        console.log(`备份目录 exists:`, backupExists);
        
        if (!backupExists) {
          console.log('创建备份目录...');
          backupDir.create({ intermediates: true });
          console.log('备份目录创建成功');
        }
        
        const testFileName = `test_${Date.now()}.txt`;
        const testFile = new File(backupDir, testFileName);
        
        console.log(`测试写入文件: ${testFile.uri}`);
        await testFile.write('test', { encoding: 'utf8' });
        console.log('写入成功');
        
        await testFile.delete();
        console.log('测试文件删除成功');
        
        console.log(`✅ 备份目录可用: ${backupDir.uri}`);
        return backupDir;
      } catch (dirError) {
        console.warn(`❌ ${candidate.name} 不可用:`, dirError);
        continue;
      }
    }
    
    console.error('所有存储目录都不可用');
    return null;
  } catch (error) {
    console.error('获取备份目录失败:', error);
    return null;
  }
}

export async function getBackupFiles(): Promise<BackupInfo[]> {
  try {
    const backupDir = await getBackupDirectory();
    if (!backupDir) return [];
    
    const files = backupDir.list();
    console.log('备份目录文件列表:', files?.length || 0);
    
    const backupFiles: BackupInfo[] = [];
    
    for (const file of files) {
      if (file instanceof File && file.name.endsWith('.json')) {
        try {
          const info = file.info();
          backupFiles.push({
            fileName: file.name,
            uri: file.uri,
            createdAt: info?.modificationTime || 0,
            size: info?.size || 0
          });
        } catch (e) {
          console.warn('获取文件信息失败:', file.name, e);
        }
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
      return { success: false, message: '无法获取备份目录，请检查应用存储权限' };
    }
    
    console.log('获取数据...');
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
    console.log('备份文件路径:', backupFile.uri);
    console.log('备份内容长度:', content.length);
    
    console.log('开始写入文件...');
    await backupFile.write(content, { encoding: 'utf8' });
    console.log('备份文件创建成功:', fileName);
    
    const existingBackups = await getBackupFiles();
    console.log('现有备份文件数:', existingBackups.length);
    
    while (existingBackups.length > MAX_BACKUP_FILES) {
      const oldestBackup = existingBackups.pop();
      if (oldestBackup) {
        try {
          const oldFile = new File(oldestBackup.uri);
          await oldFile.delete();
          console.log('删除旧备份:', oldestBackup.fileName);
        } catch (e) {
          console.warn('删除旧备份失败:', oldestBackup.fileName, e);
        }
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
      message: error instanceof Error ? error.message : '备份失败，请查看日志'
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
