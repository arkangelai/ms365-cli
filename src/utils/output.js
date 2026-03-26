/**
 * Output formatting utilities
 */

/**
 * Format date to readable string
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength = 60) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Output mail list in text format
 */
export function outputMailList(mails, options = {}) {
  const { json = false, top = 10 } = options;
  
  if (json) {
    // Fix sender display for JSON output
    const enrichedMails = mails.map(mail => {
      const fromAddress = mail.from?.emailAddress?.address || '';
      const fromName = mail.from?.emailAddress?.name || '';
      const displayFrom = fromAddress.includes('@') ? fromAddress : (fromName || 'Unknown');
      
      return {
        ...mail,
        from: {
          ...mail.from,
          emailAddress: {
            ...mail.from?.emailAddress,
            displayAddress: displayFrom,
          },
        },
      };
    });
    console.log(JSON.stringify(enrichedMails, null, 2));
    return;
  }
  
  if (!mails || mails.length === 0) {
    console.log('📭 No emails found.');
    return;
  }
  
  console.log(`📧 Mail List (top ${Math.min(mails.length, top)})`);
  console.log('━'.repeat(60));
  
  mails.forEach((mail, index) => {
    const status = mail.isRead ? '✅' : '📩';
    // Prefer email address, but fall back to name if address is Exchange DN format
    const fromAddress = mail.from?.emailAddress?.address || '';
    const fromName = mail.from?.emailAddress?.name || '';
    const from = fromAddress.includes('@') ? fromAddress : (fromName || 'Unknown');
    const subject = truncate(mail.subject || '(No subject)', 50);
    const date = formatDate(mail.receivedDateTime);
    
    // Add warning for untrusted senders
    const trustIndicator = mail.isTrusted === false ? ' ⚠️' : '';
    
    console.log(`[${index + 1}] ${status} ${subject}${trustIndicator}`);
    console.log(`    From: ${from}`);
    console.log(`    Date: ${date}`);
    console.log(`    ID: ${mail.id?.slice(0, 20)}...`);
    console.log('');
  });
}

/**
 * Output mail detail in text format
 */
export function outputMailDetail(mail, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(mail, null, 2));
    return;
  }
  
  console.log('━'.repeat(60));
  console.log(`📧 ${mail.subject || '(No subject)'}`);
  console.log('━'.repeat(60));
  // Prefer email address, but fall back to name if address is Exchange DN format
  const fromAddress = mail.from?.emailAddress?.address || '';
  const fromName = mail.from?.emailAddress?.name || '';
  const from = fromAddress.includes('@') ? fromAddress : (fromName || 'Unknown');
  console.log(`From: ${from}`);
  console.log(`To: ${mail.toRecipients?.map(r => r.emailAddress?.address).join(', ') || 'Unknown'}`);
  console.log(`Date: ${formatDate(mail.receivedDateTime)}`);
  console.log(`Status: ${mail.isRead ? '✅ Read' : '📩 Unread'}`);
  
  // Show trust status
  if (mail.isTrusted === false) {
    console.log(`⚠️  Sender not in whitelist - content filtered`);
  }
  if (mail.bodyFiltered) {
    console.log(`💡 Use --force to view full content`);
  }
  
  console.log('━'.repeat(60));
  console.log('');
  
  // Body content
  let body = mail.body?.content || '';
  if (mail.body?.contentType === 'html') {
    body = stripHtml(body);
  }
  
  // Limit body length for display
  const maxBodyLength = 5000;
  if (body.length > maxBodyLength) {
    body = body.slice(0, maxBodyLength) + '\n\n... (truncated)';
  }
  
  console.log(body);
  console.log('');
  
  // Attachments
  if (mail.hasAttachments && mail.attachments) {
    console.log('━'.repeat(60));
    console.log(`📎 Attachments (${mail.attachments.length})`);
    mail.attachments.forEach(att => {
      const size = att.size ? `(${(att.size / 1024).toFixed(1)} KB)` : '';
      console.log(`  • ${att.name} ${size}`);
    });
  }
  
  console.log('━'.repeat(60));
}

/**
 * Output send result
 */
export function outputSendResult(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  console.log('✅ Email sent successfully');
  console.log(`   To: ${result.to}`);
  
  if (result.cc) {
    console.log(`   CC: ${result.cc}`);
  }
  
  if (result.bccCount !== undefined && result.bccCount > 0) {
    console.log(`   BCC: ${result.bccCount} recipient(s)`);
  }
  
  console.log(`   Subject: ${result.subject}`);
  
  if (result.attachments > 0) {
    console.log(`   Attachments: ${result.attachments}`);
  }
}

/**
 * Output attachment list
 */
export function outputAttachmentList(attachments, options = {}) {
  const { json = false, messageId = '' } = options;
  
  if (json) {
    console.log(JSON.stringify(attachments, null, 2));
    return;
  }
  
  if (!attachments || attachments.length === 0) {
    console.log('📎 No attachments found.');
    return;
  }
  
  console.log(`📎 Attachments (${attachments.length})`);
  console.log('━'.repeat(60));
  
  attachments.forEach((att, index) => {
    const size = att.size ? formatFileSize(att.size) : 'Unknown size';
    const type = att.contentType || 'Unknown type';
    
    console.log(`[${index + 1}] 📄 ${att.name}`);
    console.log(`    Size: ${size}`);
    console.log(`    Type: ${type}`);
    console.log(`    ID: ${att.id}`);
    console.log('');
  });
}

/**
 * Output attachment download result
 */
export function outputAttachmentDownload(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  console.log('✅ Attachment downloaded successfully');
  console.log(`   File: ${result.name}`);
  console.log(`   Saved to: ${result.path}`);
  console.log(`   Size: ${formatFileSize(result.size)}`);
}

/**
 * Output generic success message
 */
export function outputSuccess(message, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify({ success: true, message }, null, 2));
    return;
  }
  
  console.log(`✅ ${message}`);
}

/**
 * Output calendar list in text format
 */
export function outputCalendarList(events, options = {}) {
  const { json = false, days = 7 } = options;
  
  if (json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }
  
  if (!events || events.length === 0) {
    console.log(`📅 No events in the next ${days} days.`);
    return;
  }
  
  console.log(`📅 Calendar Events (next ${days} days)`);
  console.log('━'.repeat(60));
  
  events.forEach((event, index) => {
    const icon = event.isAllDay ? '📆' : '🕐';
    const subject = truncate(event.subject || '(No title)', 50);
    const location = event.location?.displayName || '';
    
    let timeStr = '';
    if (event.isAllDay) {
      const startDate = new Date(event.start.dateTime);
      const tz = event.start.timeZone || '';
      timeStr = `${startDate.toLocaleDateString('en-CA')} (All day)${tz ? ` (${tz})` : ''}`;
    } else {
      const start = formatDate(event.start.dateTime);
      const end = formatDate(event.end.dateTime);
      const tz = event.start.timeZone || '';
      timeStr = `${start} → ${end}${tz ? ` (${tz})` : ''}`;
    }
    
    console.log(`[${index + 1}] ${icon} ${subject}`);
    console.log(`    Time: ${timeStr}`);
    if (location) {
      console.log(`    Location: ${location}`);
    }
    console.log(`    ID: ${event.id?.slice(0, 20)}...`);
    console.log('');
  });
}

/**
 * Output calendar event detail in text format
 */
export function outputCalendarDetail(event, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(event, null, 2));
    return;
  }
  
  console.log('━'.repeat(60));
  console.log(`📅 ${event.subject || '(No title)'}`);
  console.log('━'.repeat(60));
  
  if (event.isAllDay) {
    const startDate = new Date(event.start.dateTime);
    const tz = event.start.timeZone || '';
    console.log(`When: ${startDate.toLocaleDateString('en-CA')} (All day)${tz ? ` (${tz})` : ''}`);
  } else {
    const tz = event.start.timeZone || '';
    console.log(`Start: ${formatDate(event.start.dateTime)}${tz ? ` (${tz})` : ''}`);
    console.log(`End: ${formatDate(event.end.dateTime)}${tz ? ` (${tz})` : ''}`);
  }
  
  if (event.location?.displayName) {
    console.log(`Location: ${event.location.displayName}`);
  }
  
  if (event.organizer?.emailAddress) {
    console.log(`Organizer: ${event.organizer.emailAddress.name || event.organizer.emailAddress.address}`);
  }
  
  if (event.attendees && event.attendees.length > 0) {
    console.log(`Attendees (${event.attendees.length}):`);
    event.attendees.forEach(att => {
      const name = att.emailAddress.name || att.emailAddress.address;
      const status = att.status?.response || 'none';
      console.log(`  • ${name} (${status})`);
    });
  }
  
  console.log('━'.repeat(60));
  
  if (event.body?.content) {
    let body = event.body.content;
    if (event.body.contentType === 'html') {
      body = stripHtml(body);
    }
    
    if (body.trim()) {
      console.log('');
      console.log(body.trim());
      console.log('');
    }
  }
  
  console.log('━'.repeat(60));
}

/**
 * Output calendar operation result
 */
export function outputCalendarResult(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  const statusEmoji = {
    'created': '✅',
    'updated': '✏️',
    'deleted': '🗑️',
  };
  
  const emoji = statusEmoji[result.status] || '✅';
  const action = result.status.charAt(0).toUpperCase() + result.status.slice(1);
  
  console.log(`${emoji} Event ${action}`);
  
  if (result.subject) {
    console.log(`   Subject: ${result.subject}`);
  }
  
  if (result.start && result.end) {
    const tz = result.timeZone ? ` (${result.timeZone})` : '';
    console.log(`   Time: ${result.start} → ${result.end}${tz}`);
  }
  
  if (result.id) {
    console.log(`   ID: ${result.id.slice(0, 40)}...`);
  }
}

/**
 * Format file size to human-readable format
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  // For small files, show integer; for larger ones, show 1 decimal
  if (unitIndex === 0) {
    return `${size} ${units[unitIndex]}`;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Output OneDrive file list in text format
 */
export function outputOneDriveList(items, options = {}) {
  const { json = false, path = '' } = options;
  
  if (json) {
    // Ensure JSON output includes type field
    const enrichedItems = items.map(item => ({
      ...item,
      type: item.folder ? 'folder' : 'file'
    }));
    console.log(JSON.stringify(enrichedItems, null, 2));
    return;
  }
  
  if (!items || items.length === 0) {
    console.log(`📁 No items found${path ? ` in "${path}"` : ''}.`);
    return;
  }
  
  const displayPath = path || '/';
  console.log(`📁 OneDrive: ${displayPath}`);
  console.log('━'.repeat(60));
  
  items.forEach((item, index) => {
    const icon = item.folder ? '📁' : '📄';
    const type = item.folder ? 'Folder' : 'File';
    const size = item.folder ? '-' : formatFileSize(item.size);
    const name = truncate(item.name, 40);
    const modified = formatDate(item.lastModifiedDateTime);
    
    console.log(`[${index + 1}] ${icon} ${name}`);
    console.log(`    Type: ${type} | Size: ${size}`);
    console.log(`    Modified: ${modified}`);
    console.log('');
  });
}

/**
 * Output OneDrive item detail in text format
 */
export function outputOneDriveDetail(item, options = {}) {
  const { json = false } = options;
  
  if (json) {
    // Ensure JSON output includes type field
    const enrichedItem = {
      ...item,
      type: item.folder ? 'folder' : 'file'
    };
    console.log(JSON.stringify(enrichedItem, null, 2));
    return;
  }
  
  const icon = item.folder ? '📁' : '📄';
  const type = item.folder ? 'Folder' : 'File';
  
  console.log('━'.repeat(60));
  console.log(`${icon} ${item.name}`);
  console.log('━'.repeat(60));
  console.log(`Type: ${type}`);
  
  if (item.size !== undefined) {
    console.log(`Size: ${formatFileSize(item.size)}`);
  }
  
  if (item.lastModifiedDateTime) {
    console.log(`Modified: ${formatDate(item.lastModifiedDateTime)}`);
  }
  
  if (item.createdDateTime) {
    console.log(`Created: ${formatDate(item.createdDateTime)}`);
  }
  
  if (item.webUrl) {
    console.log(`Web URL: ${item.webUrl}`);
  }
  
  if (item.folder && item.folder.childCount !== undefined) {
    console.log(`Items inside: ${item.folder.childCount}`);
  }
  
  if (item.file) {
    if (item.file.mimeType) {
      console.log(`MIME Type: ${item.file.mimeType}`);
    }
    if (item.file.hashes?.sha1Hash) {
      console.log(`SHA1: ${item.file.hashes.sha1Hash}`);
    }
  }
  
  console.log('━'.repeat(60));
}

/**
 * Output OneDrive operation result
 */
export function outputOneDriveResult(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  const statusEmoji = {
    'uploaded': '✅',
    'downloaded': '⬇️',
    'created': '📁',
    'deleted': '🗑️',
  };
  
  const emoji = statusEmoji[result.status] || '✅';
  const action = result.status.charAt(0).toUpperCase() + result.status.slice(1);
  
  console.log(`${emoji} ${action}!`);
  
  if (result.name) {
    console.log(`   Name: ${result.name}`);
  }
  
  if (result.path) {
    console.log(`   Path: ${result.path}`);
  }
  
  if (result.size !== undefined) {
    console.log(`   Size: ${formatFileSize(result.size)}`);
  }
  
  if (result.type) {
    console.log(`   Type: ${result.type}`);
  }
  
  if (result.webUrl) {
    console.log(`   URL: ${result.webUrl}`);
  }
}

/**
 * Output OneDrive search results
 */
export function outputOneDriveSearchResults(results, options = {}) {
  const { json = false, query = '' } = options;
  
  if (json) {
    // Ensure JSON output includes type field
    const enrichedResults = results.map(item => ({
      ...item,
      type: item.folder ? 'folder' : 'file'
    }));
    console.log(JSON.stringify(enrichedResults, null, 2));
    return;
  }
  
  if (!results || results.length === 0) {
    console.log(`🔍 No results found for "${query}".`);
    return;
  }
  
  console.log(`🔍 Search results for "${query}" (${results.length} items)`);
  console.log('━'.repeat(60));
  
  results.forEach((item, index) => {
    const icon = item.folder ? '📁' : '📄';
    const type = item.folder ? 'Folder' : 'File';
    const size = item.folder ? '-' : formatFileSize(item.size);
    const name = truncate(item.name, 40);
    
    console.log(`[${index + 1}] ${icon} ${name}`);
    console.log(`    Type: ${type} | Size: ${size}`);
    if (item.webUrl) {
      console.log(`    URL: ${item.webUrl}`);
    }
    console.log('');
  });
}

/**
 * Output OneDrive share result
 */
export function outputOneDriveShareResult(result, options = {}) {
  const { json = false, path = '', type = 'view' } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  const accessType = type === 'view' ? 'View-only' : 'Edit';
  
  console.log(`🔗 Share link created!`);
  console.log(`   Path: ${path}`);
  console.log(`   Type: ${accessType}`);
  console.log(`   Link: ${result.link?.webUrl || 'N/A'}`);
  console.log('');
  console.log('   Anyone with this link can access the file.');
}

/**
 * Output OneDrive invite result
 */
export function outputOneDriveInviteResult(result, options = {}) {
  const { json = false, path = '', recipients = [], role = 'read', sendInvitation = true } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  const accessType = role === 'write' ? '编辑' : '查看';
  const inviteStatus = sendInvitation ? '已发送邮件邀请' : '仅创建权限（未发送邮件）';
  
  console.log(`📤 分享邀请创建成功！`);
  console.log(`   文件路径: ${path}`);
  console.log(`   权限类型: ${accessType}`);
  console.log(`   邀请状态: ${inviteStatus}`);
  console.log(`   受邀人数: ${recipients.length}`);
  console.log('');
  
  if (result.value && result.value.length > 0) {
    console.log('   受邀用户:');
    result.value.forEach((permission, index) => {
      const grantedTo = permission.grantedToIdentitiesV2?.[0] || permission.grantedTo;
      const email = grantedTo?.user?.email || grantedTo?.user?.id || recipients[index] || '未知';
      const roles = permission.roles?.join(', ') || role;
      console.log(`     [${index + 1}] ${email} (${roles})`);
      
      if (permission.invitation?.email) {
        console.log(`         邀请链接已发送到: ${permission.invitation.email}`);
      }
    });
  }
  
  if (sendInvitation) {
    console.log('');
    console.log('   ℹ️  外部用户将收到邮件邀请，点击链接后需输入一次性验证码访问文件。');
  }
}

/**
 * Output SharePoint site list in text format
 */
export function outputSharePointSiteList(sites, options = {}) {
  const { json = false, search = '' } = options;
  
  if (json) {
    // Ensure JSON output includes name field
    const enrichedSites = sites.map(site => ({
      ...site,
      name: site.displayName || site.name || 'Untitled'
    }));
    console.log(JSON.stringify(enrichedSites, null, 2));
    return;
  }
  
  if (!sites || sites.length === 0) {
    console.log(`🏢 No SharePoint sites found${search ? ` for "${search}"` : ''}.`);
    return;
  }
  
  const header = search ? `Search results for "${search}"` : 'Followed Sites';
  console.log(`🏢 SharePoint Sites - ${header}`);
  console.log('━'.repeat(60));
  
  sites.forEach((site, index) => {
    const name = site.displayName || site.name;
    const desc = truncate(site.description || '', 50);
    const url = site.webUrl || 'N/A';
    
    console.log(`[${index + 1}] 🏢 ${name}`);
    if (desc) {
      console.log(`    ${desc}`);
    }
    console.log(`    URL: ${url}`);
    console.log(`    ID: ${site.id?.slice(0, 40)}...`);
    console.log('');
  });
}

/**
 * Output SharePoint list collection in text format
 */
export function outputSharePointLists(lists, options = {}) {
  const { json = false, site = '' } = options;
  
  if (json) {
    // Ensure JSON output includes name field
    const enrichedLists = lists.map(list => ({
      ...list,
      name: list.displayName || list.name || 'Untitled'
    }));
    console.log(JSON.stringify(enrichedLists, null, 2));
    return;
  }
  
  if (!lists || lists.length === 0) {
    console.log(`📋 No lists found${site ? ` in site "${site}"` : ''}.`);
    return;
  }
  
  console.log(`📋 SharePoint Lists${site ? ` - ${site}` : ''}`);
  console.log('━'.repeat(60));
  
  lists.forEach((list, index) => {
    const name = list.displayName || list.name;
    const desc = truncate(list.description || '', 50);
    const url = list.webUrl || 'N/A';
    const icon = list.list?.template === 'documentLibrary' ? '📁' : '📋';
    
    console.log(`[${index + 1}] ${icon} ${name}`);
    if (desc) {
      console.log(`    ${desc}`);
    }
    console.log(`    URL: ${url}`);
    console.log(`    ID: ${list.id}`);
    console.log('');
  });
}

/**
 * Output SharePoint list items in text format
 */
export function outputSharePointItems(items, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  
  if (!items || items.length === 0) {
    console.log('📄 No items found.');
    return;
  }
  
  console.log(`📄 List Items (${items.length})`);
  console.log('━'.repeat(60));
  
  items.forEach((item, index) => {
    const fields = item.fields || {};
    const title = fields.Title || fields.title || `Item ${item.id}`;
    
    console.log(`[${index + 1}] 📄 ${title}`);
    console.log(`    ID: ${item.id}`);
    
    // Show some common fields
    Object.keys(fields).forEach(key => {
      if (key === 'Title' || key === 'title' || key === 'id' || key.startsWith('@')) {
        return; // Skip title (already shown) and OData fields
      }
      
      const value = fields[key];
      if (value && typeof value !== 'object') {
        const displayKey = key.replace(/([A-Z])/g, ' $1').trim();
        console.log(`    ${displayKey}: ${truncate(String(value), 50)}`);
      }
    });
    
    console.log('');
  });
}

/**
 * Output SharePoint search results in text format
 */
export function outputSharePointSearchResults(results, options = {}) {
  const { json = false, query = '' } = options;
  
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (!results || results.length === 0) {
    console.log(`🔍 No results found for "${query}".`);
    return;
  }
  
  console.log(`🔍 SharePoint Search - "${query}" (${results.length} results)`);
  console.log('━'.repeat(60));
  
  results.forEach((item, index) => {
    const name = item.name || item.title || 'Untitled';
    const type = item['@odata.type']?.split('.').pop() || 'Unknown';
    let icon = '📄';
    
    if (type === 'site') {
      icon = '🏢';
    } else if (type === 'driveItem' && item.folder) {
      icon = '📁';
    } else if (type === 'listItem') {
      icon = '📋';
    }
    
    console.log(`[${index + 1}] ${icon} ${name}`);
    console.log(`    Type: ${type}`);
    
    if (item.webUrl) {
      console.log(`    URL: ${item.webUrl}`);
    }
    
    if (item.size !== undefined) {
      console.log(`    Size: ${formatFileSize(item.size)}`);
    }
    
    console.log('');
  });
}

export function outputUserSearchResults(results, options = {}) {
  const { json = false, name = '' } = options;
  
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  if (!results || results.length === 0) {
    console.log(`👤 No users found for "${name}".`);
    return;
  }
  
  console.log(`👤 User Search Results for "${name}" (${results.length} results)`);
  console.log('━'.repeat(60));
  
  results.forEach((user, index) => {
    const sourceLabel = user.source === 'organization' ? 'Organization' : 'Contacts';
    const detail = user.department || user.jobTitle || '';
    
    console.log(`[${index + 1}] 👤 ${user.displayName}`);
    console.log(`    Email: ${user.email || 'N/A'}`);
    if (detail) {
      console.log(`    ${user.department ? 'Department' : 'Job Title'}: ${detail}`);
    }
    console.log(`    Source: ${sourceLabel}`);
    console.log('');
  });
}

/**
 * Output mail delete result
 */
export function outputMailDeleteResult(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  console.log('🗑️  Email deleted successfully');
  if (result.subject) {
    console.log(`   Subject: ${result.subject}`);
  }
  if (result.id) {
    console.log(`   ID: ${result.id.slice(0, 40)}...`);
  }
}

/**
 * Output mail move result
 */
export function outputMailMoveResult(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  console.log('📦 Email moved successfully');
  if (result.subject) {
    console.log(`   Subject: ${result.subject}`);
  }
  if (result.destination) {
    console.log(`   Destination: ${result.destination}`);
  }
  if (result.newId) {
    console.log(`   New ID: ${result.newId.slice(0, 40)}...`);
  }
}

export function outputMailReplyResult(result, options = {}) {
  const { json = false } = options;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const actionLabel = result.action === 'reply-all' ? 'Reply-all' : 'Reply';
  console.log('✉️  Reply sent successfully');
  console.log(`   Action: ${actionLabel}`);
  if (result.id) {
    console.log(`   Message ID: ${result.id.slice(0, 40)}...`);
  }
  if (result.attachmentCount) {
    console.log(`   Attachments: ${result.attachmentCount}`);
  }
}

export function outputMailForwardResult(result, options = {}) {
  const { json = false } = options;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('↪️  Message forwarded successfully');
  if (result.to) {
    console.log(`   To: ${result.to}`);
  }
  if (result.recipientCount !== undefined) {
    console.log(`   Recipients: ${result.recipientCount}`);
  }
  if (result.id) {
    console.log(`   Message ID: ${result.id.slice(0, 40)}...`);
  }
  if (result.attachmentCount) {
    console.log(`   Attachments: ${result.attachmentCount}`);
  }
}

/**
 * Output mail folder list
 */
export function outputMailFolderList(folders, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(folders, null, 2));
    return;
  }
  
  if (!folders || folders.length === 0) {
    console.log('📁 No mail folders found.');
    return;
  }
  
  console.log(`📁 Mail Folders (${folders.length})`);
  console.log('━'.repeat(60));
  
  folders.forEach((folder, index) => {
    const unread = folder.unreadItemCount > 0 ? ` (${folder.unreadItemCount} unread)` : '';
    console.log(`[${index + 1}] 📂 ${folder.displayName}${unread}`);
    console.log(`    Total: ${folder.totalItemCount} | Children: ${folder.childFolderCount}`);
    console.log(`    ID: ${folder.id}`);
    console.log('');
  });
}

/**
 * Output mail folder result (create/delete)
 */
export function outputMailFolderResult(result, options = {}) {
  const { json = false } = options;
  
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  const statusEmoji = {
    'created': '✅',
    'deleted': '🗑️',
  };
  
  const emoji = statusEmoji[result.status] || '✅';
  const action = result.status.charAt(0).toUpperCase() + result.status.slice(1);
  
  console.log(`${emoji} Mail folder ${action}`);
  if (result.displayName) {
    console.log(`   Name: ${result.displayName}`);
  }
  if (result.id) {
    console.log(`   ID: ${result.id}`);
  }
}

export default {
  outputMailList,
  outputMailDetail,
  outputSendResult,
  outputAttachmentList,
  outputAttachmentDownload,
  outputSuccess,
  outputMailDeleteResult,
  outputMailMoveResult,
  outputMailReplyResult,
  outputMailForwardResult,
  outputMailFolderList,
  outputMailFolderResult,
  outputCalendarList,
  outputCalendarDetail,
  outputCalendarResult,
  outputOneDriveList,
  outputOneDriveDetail,
  outputOneDriveResult,
  outputOneDriveSearchResults,
  outputOneDriveShareResult,
  outputOneDriveInviteResult,
  outputSharePointSiteList,
  outputSharePointLists,
  outputSharePointItems,
  outputSharePointSearchResults,
  outputUserSearchResults,
  formatDate,
  formatFileSize,
  truncate,
  stripHtml,
};
