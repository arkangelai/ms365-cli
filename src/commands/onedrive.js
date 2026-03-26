import graphClient from '../graph/client.js';
import { 
  outputOneDriveList, 
  outputOneDriveDetail, 
  outputOneDriveResult,
  outputOneDriveSearchResults,
  outputOneDriveShareResult,
  outputOneDriveInviteResult,
} from '../utils/output.js';
import { handleError } from '../utils/error.js';
import { getAccountType } from '../auth/token-manager.js';
import { readFile, writeFile } from 'fs/promises';
import { basename } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';

/**
 * OneDrive commands
 */

/**
 * List files and folders
 */
export async function listFiles(path = '', options = {}) {
  try {
    const { top = 100, json = false } = options;
    
    const items = await graphClient.onedrive.list(path, { top });
    
    outputOneDriveList(items, { json, path });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Get file/folder metadata
 */
export async function getMetadata(path, options = {}) {
  try {
    const { json = false } = options;
    
    if (!path) {
      throw new Error('Path is required');
    }
    
    const item = await graphClient.onedrive.getMetadata(path);
    
    outputOneDriveDetail(item, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Download file
 */
export async function downloadFile(remotePath, localPath, options = {}) {
  try {
    const { json = false } = options;
    
    if (!remotePath) {
      throw new Error('Remote path is required');
    }
    
    // Get metadata first to check if it's a file and get the name
    const metadata = await graphClient.onedrive.getMetadata(remotePath);
    
    if (metadata.folder) {
      throw new Error('Cannot download folders. Please specify a file.');
    }
    
    // Determine local path
    const targetPath = localPath || metadata.name;
    
    if (!json) {
      console.log(`⬇️  Downloading: ${metadata.name}`);
      console.log(`   Size: ${formatFileSize(metadata.size)}`);
    }
    
    // Download file
    const response = await graphClient.onedrive.download(remotePath);
    
    // Write to file
    const fileStream = createWriteStream(targetPath);
    const reader = response.body.getReader();
    
    let downloadedBytes = 0;
    const totalBytes = metadata.size;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      fileStream.write(Buffer.from(value));
      downloadedBytes += value.length;
      
      // Show progress (only in non-json mode)
      if (!json && totalBytes > 0) {
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}% (${formatFileSize(downloadedBytes)} / ${formatFileSize(totalBytes)})`);
      }
    }
    
    fileStream.end();
    
    if (!json && totalBytes > 0) {
      console.log(''); // New line after progress
    }
    
    const result = {
      status: 'downloaded',
      name: metadata.name,
      path: targetPath,
      size: metadata.size,
    };
    
    outputOneDriveResult(result, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Upload file
 */
export async function uploadFile(localPath, remotePath, options = {}) {
  try {
    const { json = false } = options;
    
    if (!localPath) {
      throw new Error('Local path is required');
    }
    
    // Get file stats
    const stats = await stat(localPath);
    if (!stats.isFile()) {
      throw new Error('Local path must be a file');
    }
    
    const fileName = basename(localPath);
    const targetPath = remotePath || fileName;
    
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (!json) {
      console.log(`⬆️  Uploading: ${fileName}`);
      console.log(`   Size: ${formatFileSize(stats.size)}`);
    }
    
    // Small file upload (< 4MB)
    if (fileSizeInMB < 4) {
      const content = await readFile(localPath);
      const result = await graphClient.onedrive.upload(targetPath, content);
      
      outputOneDriveResult({
        status: 'uploaded',
        name: result.name,
        path: targetPath,
        size: result.size,
        webUrl: result.webUrl,
      }, { json });
      
      return;
    }
    
    // Large file upload with session
    if (!json) {
      console.log('   Using upload session for large file...');
    }
    
    const session = await graphClient.onedrive.createUploadSession(targetPath);
    const uploadUrl = session.uploadUrl;
    
    // Read file and upload in chunks
    const chunkSize = 320 * 1024 * 10; // 3.2MB chunks
    const fileContent = await readFile(localPath);
    const totalSize = fileContent.length;
    
    let start = 0;
    let uploadedBytes = 0;
    
    while (start < totalSize) {
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = fileContent.slice(start, end);
      
      const result = await graphClient.onedrive.uploadChunk(
        uploadUrl,
        chunk,
        start,
        end,
        totalSize
      );
      
      uploadedBytes = end;
      
      // Show progress
      if (!json) {
        const percent = ((uploadedBytes / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r   Progress: ${percent}% (${formatFileSize(uploadedBytes)} / ${formatFileSize(totalSize)})`);
      }
      
      start = end;
      
      // Check if upload is complete
      if (result.id) {
        if (!json) {
          console.log(''); // New line after progress
        }
        
        outputOneDriveResult({
          status: 'uploaded',
          name: result.name,
          path: targetPath,
          size: result.size,
          webUrl: result.webUrl,
        }, { json });
        
        return;
      }
    }
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Search files
 */
export async function searchFiles(query, options = {}) {
  try {
    const { top = 50, json = false } = options;
    
    if (!query) {
      throw new Error('Search query is required');
    }
    
    const results = await graphClient.onedrive.search(query, { top });
    
    outputOneDriveSearchResults(results, { json, query });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Create sharing link
 */
export async function shareFile(path, options = {}) {
  try {
    // Personal accounts don't support 'organization' scope, default to 'anonymous'
    const defaultScope = getAccountType() === 'personal' ? 'anonymous' : 'organization';
    const { type = 'view', scope = defaultScope, json = false } = options;
    
    if (!path) {
      throw new Error('Path is required');
    }
    
    // Validate type
    if (!['view', 'edit'].includes(type)) {
      throw new Error('Type must be "view" or "edit"');
    }
    
    // Validate scope
    if (!['organization', 'anonymous', 'users'].includes(scope)) {
      throw new Error('Scope must be "organization", "anonymous", or "users"');
    }
    
    const result = await graphClient.onedrive.share(path, { type, scope });
    
    outputOneDriveShareResult(result, { json, path, type });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Invite users to access file (external sharing)
 */
export async function inviteFile(path, email, options = {}) {
  try {
    const { role = 'read', message = '', notify = true, json = false } = options;
    
    if (!path) {
      throw new Error('文件路径不能为空');
    }
    
    if (!email) {
      throw new Error('邮箱地址不能为空');
    }
    
    // Validate role
    if (!['read', 'write'].includes(role)) {
      throw new Error('权限类型必须是 "read"（查看）或 "write"（编辑）');
    }
    
    // Parse email (support multiple emails separated by comma)
    const recipients = email.split(',').map(e => e.trim()).filter(e => e);
    
    if (recipients.length === 0) {
      throw new Error('至少需要提供一个有效的邮箱地址');
    }
    
    if (!json) {
      console.log(`📤 正在创建分享邀请...`);
      console.log(`   文件: ${path}`);
      console.log(`   受邀人: ${recipients.join(', ')}`);
      console.log(`   权限: ${role === 'write' ? '编辑' : '查看'}`);
      console.log('');
    }
    
    const result = await graphClient.onedrive.invite(path, {
      recipients,
      role,
      message,
      sendInvitation: notify,
      requireSignIn: false, // Allow external users with one-time code
    });
    
    outputOneDriveInviteResult(result, { 
      json, 
      path, 
      recipients, 
      role, 
      sendInvitation: notify 
    });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Create folder
 */
export async function createFolder(path, options = {}) {
  try {
    const { json = false } = options;
    
    if (!path) {
      throw new Error('Folder path is required');
    }
    
    const result = await graphClient.onedrive.mkdir(path);
    
    outputOneDriveResult({
      status: 'created',
      name: result.name,
      path: path,
      type: 'folder',
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Delete file or folder
 */
export async function deleteItem(path, options = {}) {
  try {
    const { force = false, json = false } = options;
    
    if (!path) {
      throw new Error('Path is required');
    }
    
    // Confirmation prompt (unless --force)
    if (!force && !json) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const answer = await new Promise((resolve) => {
        rl.question(`⚠️  Delete "${path}"? This cannot be undone. (y/N): `, resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        return;
      }
    }
    
    await graphClient.onedrive.remove(path);
    
    outputOneDriveResult({
      status: 'deleted',
      path: path,
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default {
  ls: listFiles,
  get: getMetadata,
  download: downloadFile,
  upload: uploadFile,
  search: searchFiles,
  share: shareFile,
  invite: inviteFile,
  mkdir: createFolder,
  rm: deleteItem,
};
