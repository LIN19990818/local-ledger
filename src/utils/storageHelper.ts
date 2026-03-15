import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export interface StorageInfo {
  available: boolean;
  directory: Directory | null;
  directoryUri: string | null;
  error?: string;
}

export async function getAvailableStorageDirectory(): Promise<StorageInfo> {
  console.log('=== 开始获取存储目录 (新API) ===');
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
        
        const testFileName = `test_${Date.now()}.txt`;
        const testFile = new File(candidate.dir, testFileName);
        
        console.log(`测试写入文件: ${testFile.uri}`);
        await testFile.write('test', { encoding: 'utf8' });
        console.log('写入成功');
        
        await testFile.delete();
        console.log('测试文件删除成功');
        
        console.log(`✅ ${candidate.name} 可用`);
        
        return {
          available: true,
          directory: candidate.dir,
          directoryUri: candidate.dir.uri
        };
      } catch (dirError) {
        console.warn(`❌ ${candidate.name} 不可用:`, dirError);
        continue;
      }
    }
    
    return {
      available: false,
      directory: null,
      directoryUri: null,
      error: '所有存储目录都不可用'
    };
  } catch (error) {
    console.error('获取存储目录失败:', error);
    return {
      available: false,
      directory: null,
      directoryUri: null,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

export async function exportFile(
  fileName: string,
  content: string
): Promise<{ success: boolean; uri: string | null; error?: string }> {
  console.log('=== 开始导出文件 ===');
  console.log('文件名:', fileName);
  console.log('内容长度:', content.length);
  
  try {
    const storageInfo = await getAvailableStorageDirectory();
    
    if (!storageInfo.available || !storageInfo.directory) {
      return {
        success: false,
        uri: null,
        error: storageInfo.error || '无法获取存储目录'
      };
    }
    
    const file = new File(storageInfo.directory, fileName);
    console.log('目标文件路径:', file.uri);
    
    await file.write(content, { encoding: 'utf8' });
    console.log('文件写入成功');
    
    const info = file.info();
    console.log('文件信息:', info);
    
    return {
      success: true,
      uri: file.uri
    };
  } catch (error) {
    console.error('导出文件失败:', error);
    return {
      success: false,
      uri: null,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

export async function shareExportedFile(
  uri: string,
  mimeType: string,
  dialogTitle: string
): Promise<boolean> {
  console.log('=== 开始分享文件 ===');
  console.log('文件URI:', uri);
  console.log('MIME类型:', mimeType);
  
  try {
    const shareAvailable = await Sharing.isAvailableAsync();
    console.log('Sharing available:', shareAvailable);
    
    if (shareAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: mimeType,
        dialogTitle: dialogTitle
      });
      console.log('分享完成');
      return true;
    } else {
      console.log('Sharing 不可用');
      return false;
    }
  } catch (error) {
    console.error('分享文件失败:', error);
    return false;
  }
}
