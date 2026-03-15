import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface StorageInfo {
  available: boolean;
  directory: string | null;
  directoryType: 'document' | 'cache' | 'temp' | 'unknown';
  writable: boolean;
}

export async function getAvailableStorageDirectory(): Promise<StorageInfo> {
  console.log('=== 开始获取存储目录 ===');
  console.log('Platform:', Platform.OS);
  console.log('documentDirectory:', FileSystem.documentDirectory);
  console.log('cacheDirectory:', FileSystem.cacheDirectory);
  
  const candidates = [
    { dir: FileSystem.documentDirectory, type: 'document' as const, name: '应用数据目录' },
    { dir: FileSystem.cacheDirectory, type: 'cache' as const, name: '应用缓存目录' },
    { dir: `${FileSystem.documentDirectory}export/`, type: 'document' as const, name: '应用数据目录/export' },
  ];
  
  for (const candidate of candidates) {
    if (!candidate.dir) {
      console.log(`跳过 ${candidate.name}: 目录为空`);
      continue;
    }
    
    console.log(`检查 ${candidate.name}: ${candidate.dir}`);
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(candidate.dir);
      console.log(`${candidate.name} 信息:`, dirInfo);
      
      if (!dirInfo.exists) {
        console.log(`创建 ${candidate.name}...`);
        await FileSystem.makeDirectoryAsync(candidate.dir, { intermediates: true });
        console.log(`${candidate.name} 创建成功`);
      }
      
      const testFile = `${candidate.dir}test_${Date.now()}.txt`;
      console.log(`测试写入 ${testFile}...`);
      
      await FileSystem.writeAsStringAsync(testFile, 'test', {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      console.log(`测试写入成功`);
      
      await FileSystem.deleteAsync(testFile);
      console.log(`测试文件删除成功`);
      
      console.log(`✅ ${candidate.name} 可用`);
      
      return {
        available: true,
        directory: candidate.dir,
        directoryType: candidate.type,
        writable: true
      };
    } catch (error) {
      console.warn(`❌ ${candidate.name} 不可用:`, error);
      continue;
    }
  }
  
  console.log('所有候选目录都不可用');
  
  return {
    available: false,
    directory: null,
    directoryType: 'unknown',
    writable: false
  };
}
