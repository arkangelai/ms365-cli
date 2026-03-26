import graphClient from '../graph/client.js';
import { 
  outputSharePointSiteList,
  outputSharePointLists,
  outputSharePointItems,
  outputSharePointSearchResults,
  outputOneDriveList,
  outputOneDriveDetail,
  outputOneDriveResult,
} from '../utils/output.js';
import { handleError } from '../utils/error.js';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { ensureWorkAccount } from '../utils/account.js';

/**
 * SharePoint commands
 */

/**
 * List accessible SharePoint sites
 */
export async function listSites(options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { search, top = 50, json = false } = options;
    
    const sites = await graphClient.sharepoint.sites({ search, top });
    
    outputSharePointSiteList(sites, { json, search });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * List site lists and document libraries
 */
export async function listLists(site, options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { top = 100, json = false } = options;
    
    if (!site) {
      throw new Error('Site parameter is required');
    }
    
    const lists = await graphClient.sharepoint.lists(site, { top });
    
    outputSharePointLists(lists, { json, site });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * List items in a SharePoint list
 */
export async function listItems(site, listId, options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { top = 100, json = false } = options;
    
    if (!site || !listId) {
      throw new Error('Site and list ID are required');
    }
    
    const items = await graphClient.sharepoint.items(site, listId, { top });
    
    outputSharePointItems(items, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * List files in SharePoint document library
 */
export async function listFiles(site, path = '', options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { top = 100, json = false } = options;
    
    if (!site) {
      throw new Error('Site parameter is required');
    }
    
    const files = await graphClient.sharepoint.files(site, path, { top });
    
    outputOneDriveList(files, { json, path: path || '/' });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Download file from SharePoint
 */
export async function downloadFile(site, remotePath, localPath, options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { json = false } = options;
    
    if (!site || !remotePath) {
      throw new Error('Site and remote path are required');
    }
    
    // Get metadata first to check if it's a file and get the name
    const siteId = await graphClient.sharepoint._parseSite(site);
    const cleanPath = remotePath.replace(/^\/+|\/+$/g, '');
    const metadata = await graphClient.get(`/sites/${siteId}/drive/root:/${cleanPath}`);
    
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
    const response = await graphClient.sharepoint.download(site, remotePath);
    
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
 * Upload file to SharePoint
 */
export async function uploadFile(site, localPath, remotePath, options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { json = false } = options;
    
    if (!site || !localPath) {
      throw new Error('Site and local path are required');
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
      const result = await graphClient.sharepoint.upload(site, targetPath, content);
      
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
    
    const session = await graphClient.sharepoint.createUploadSession(site, targetPath);
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
 * Search SharePoint content
 */
export async function searchContent(query, options = {}) {
  ensureWorkAccount('sharepoint');
  try {
    const { top = 50, json = false } = options;
    
    if (!query) {
      throw new Error('Search query is required');
    }
    
    const results = await graphClient.sharepoint.search(query, { top });
    
    outputSharePointSearchResults(results, { json, query });
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
  sites: listSites,
  lists: listLists,
  items: listItems,
  files: listFiles,
  download: downloadFile,
  upload: uploadFile,
  search: searchContent,
};
