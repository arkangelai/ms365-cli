import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import graphClient from '../graph/client.js';
import { outputMailList, outputMailDetail, outputSendResult, outputAttachmentList, outputAttachmentDownload, outputMailDeleteResult, outputMailMoveResult, outputMailReplyResult, outputMailForwardResult, outputMailFolderList, outputMailFolderResult } from '../utils/output.js';
import { handleError } from '../utils/error.js';
import { isTrustedSender, addTrustedSender, removeTrustedSender, listTrustedSenders, getWhitelistFilePath } from '../utils/trusted-senders.js';
import { assertSafeToWrite, resolveOutputPath } from '../utils/files.js';

// Cache for current user's email
let currentUserEmailCache = null;
let currentUserEmailWarningShown = false;

function parseRecipients(emails) {
  if (!emails) return [];
  return emails
    .split(',')
    .map(email => email.trim())
    .filter(email => email)
    .map(email => ({
      emailAddress: {
        address: email,
      },
    }));
}

function buildFileAttachment(filePath) {
  const data = readFileSync(filePath);
  const name = basename(filePath);
  const contentBytes = data.toString('base64');
  return {
    '@odata.type': '#microsoft.graph.fileAttachment',
    name,
    contentBytes,
  };
}

async function getCurrentUserEmail() {
  if (currentUserEmailCache) return currentUserEmailCache;
  
  try {
    const user = await graphClient.getCurrentUser();
    currentUserEmailCache = user.mail || user.userPrincipalName || null;
    return currentUserEmailCache;
  } catch (error) {
    if (!currentUserEmailWarningShown) {
      console.error('Warning: Failed to get current user email (need User.Read permission):', error.message);
      currentUserEmailWarningShown = true;
    }
    return null;
  }
}

/**
 * Mail commands
 */

/**
 * List emails
 */
export async function listMails(options) {
  try {
    const { top = 10, folder = 'inbox', json = false, focused = false } = options;
    
    const listOptions = { top, folder };
    if (focused) {
      listOptions.filter = "inferenceClassification eq 'focused'";
    }
    
    const mails = await graphClient.mail.list(listOptions);
    
    const currentUserEmail = await getCurrentUserEmail();
    
    // Mark untrusted senders
    const mailsWithTrustStatus = mails.map(mail => {
      const senderEmail = mail.from?.emailAddress?.address;
      return {
        ...mail,
        isTrusted: senderEmail ? isTrustedSender(senderEmail, currentUserEmail) : false,
      };
    });
    
    outputMailList(mailsWithTrustStatus, { json, top });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Read email by ID
 */
export async function readMail(id, options) {
  try {
    const { json = false, force = false } = options;
    
    if (!id) {
      throw new Error('Email ID is required');
    }
    
    const mail = await graphClient.mail.get(id);
    
    const currentUserEmail = await getCurrentUserEmail();
    
    // Check whitelist unless --force is used
    const senderEmail = mail.from?.emailAddress?.address;
    const trusted = senderEmail ? isTrustedSender(senderEmail, currentUserEmail) : false;
    
    if (!trusted && !force) {
      // Filter content for untrusted senders
      mail.bodyFiltered = true;
      mail.originalBody = mail.body;
      mail.body = {
        contentType: mail.body?.contentType || 'Text',
        content: '[Content filtered - sender not in trusted senders list]\n\nUse --force to skip whitelist check.',
      };
    }
    
    mail.isTrusted = trusted;
    
    outputMailDetail(mail, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Send email
 */
export async function sendMail(to, subject, body, options) {
  try {
    const { attach = [], cc, bcc, json = false } = options;
    
    if (!to || !subject || !body) {
      throw new Error('To, subject, and body are required');
    }
    
    // Build message
    const message = {
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: parseRecipients(to),
    };
    
    // Add CC recipients if specified
    if (cc) {
      message.ccRecipients = parseRecipients(cc);
    }
    
    // Add BCC recipients if specified
    if (bcc) {
      message.bccRecipients = parseRecipients(bcc);
    }
    
    // Handle attachments
    if (attach && attach.length > 0) {
      message.attachments = [];
      
      let totalSize = 0;
      
      for (const filePath of attach) {
        try {
          const fileBuffer = readFileSync(filePath);
          const fileName = filePath.split('/').pop();
          const base64Content = fileBuffer.toString('base64');
          
          totalSize += fileBuffer.length;
          
          message.attachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: fileName,
            contentBytes: base64Content,
          });
        } catch (error) {
          throw new Error(`Failed to read attachment: ${filePath} - ${error.message}`);
        }
      }
      
      // Warn about size limit
      if (totalSize > 2360320) { // ~2.25MB
        console.warn('⚠️  Warning: Total attachment size exceeds recommended limit (~2.25MB).');
        console.warn('   Large emails may fail due to Graph API limits.');
      }
    }
    
    // Send email
    await graphClient.mail.send(message);
    
    const result = {
      status: 'sent',
      to,
      subject,
      attachments: attach.length,
    };
    
    // Add CC/BCC info to result
    if (cc) {
      result.cc = cc;
    }
    if (bcc) {
      // Don't show BCC addresses, just count
      result.bccCount = parseRecipients(bcc).length;
    }
    
    outputSendResult(result, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Search emails
 */
export async function searchMails(query, options) {
  try {
    const { top = 10, json = false } = options;
    
    if (!query) {
      throw new Error('Search query is required');
    }
    
    const mails = await graphClient.mail.search(query, { top });
    
    const currentUserEmail = await getCurrentUserEmail();
    
    const mailsWithTrustStatus = mails.map(mail => {
      const senderEmail = mail.from?.emailAddress?.address;
      return {
        ...mail,
        isTrusted: senderEmail ? isTrustedSender(senderEmail, currentUserEmail) : false,
      };
    });
    
    if (!json) {
      console.log(`🔍 Search results for: "${query}"`);
      console.log('');
    }
    
    outputMailList(mailsWithTrustStatus, { json, top });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * List attachments for an email
 */
export async function listAttachments(id, options) {
  try {
    const { json = false } = options;
    
    if (!id) {
      throw new Error('Email ID is required');
    }
    
    const attachments = await graphClient.mail.attachments(id);
    
    outputAttachmentList(attachments, { json, messageId: id });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Download email attachment
 */
export async function downloadAttachment(messageId, attachmentId, localPath, options) {
  try {
    const { json = false, force = false } = options;
    
    if (!messageId || !attachmentId) {
      throw new Error('Message ID and Attachment ID are required');
    }
    
    // Get attachment data
    const attachment = await graphClient.mail.downloadAttachment(messageId, attachmentId);
    
    if (!attachment.contentBytes) {
      throw new Error('Attachment content not found');
    }
    
    // Determine output path
    const fileName = attachment.name || 'attachment';
    const outputPath = resolveOutputPath(localPath, fileName);
    assertSafeToWrite(outputPath, { force });
    
    // Decode base64 content and save
    const buffer = Buffer.from(attachment.contentBytes, 'base64');
    writeFileSync(outputPath, buffer, { flag: force ? 'w' : 'wx' });
    
    const result = {
      name: fileName,
      path: outputPath,
      size: buffer.length,
    };
    
    outputAttachmentDownload(result, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Manage trusted senders whitelist
 */
export async function trustSender(email, options) {
  try {
    const { json = false } = options;
    
    if (!email) {
      throw new Error('Email address or domain is required');
    }
    
    addTrustedSender(email);
    
    const result = {
      action: 'added',
      entry: email,
      path: getWhitelistFilePath(),
    };
    
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`✅ Added to whitelist: ${email}`);
      console.log(`   File: ${result.path}`);
    }
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export async function untrustSender(email, options) {
  try {
    const { json = false } = options;
    
    if (!email) {
      throw new Error('Email address or domain is required');
    }
    
    removeTrustedSender(email);
    
    const result = {
      action: 'removed',
      entry: email,
      path: getWhitelistFilePath(),
    };
    
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Removed from whitelist: ${email}`);
      console.log(`   File: ${result.path}`);
    }
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export async function showTrustedSenders(options) {
  try {
    const { json = false } = options;
    
    const trustedSenders = listTrustedSenders();
    
    if (json) {
      console.log(JSON.stringify({ trustedSenders, path: getWhitelistFilePath() }, null, 2));
    } else {
      console.log(`📋 Trusted senders whitelist:`);
      console.log(`   File: ${getWhitelistFilePath()}`);
      console.log('');
      
      if (trustedSenders.length === 0) {
        console.log('   (empty)');
      } else {
        trustedSenders.forEach(entry => {
          if (entry.startsWith('@')) {
            console.log(`   🌐 ${entry} (domain)`);
          } else {
            console.log(`   📧 ${entry}`);
          }
        });
      }
      
      console.log('');
      console.log(`   Total: ${trustedSenders.length} entries`);
    }
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Delete an email message
 */
export async function deleteMail(id, options = {}) {
  try {
    const { force = false, json = false } = options;
    
    if (!id) {
      throw new Error('Message ID is required');
    }
    
    // Confirmation prompt (unless --force or --json)
    if (!force && !json) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('⚠️  Delete this email? It will be moved to Deleted Items. (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        return;
      }
    }
    
    await graphClient.mail.deleteMessage(id);
    
    outputMailDeleteResult({
      status: 'deleted',
      id,
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Move an email to a different folder
 */
export async function moveMail(id, destination, options = {}) {
  try {
    const { json = false } = options;
    
    if (!id) {
      throw new Error('Message ID is required');
    }
    if (!destination) {
      throw new Error('Destination folder is required');
    }
    
    const result = await graphClient.mail.move(id, destination);
    
    outputMailMoveResult({
      status: 'moved',
      subject: result.subject,
      destination,
      newId: result.id,
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export async function replyMail(id, content, options = {}) {
  try {
    const { json = false, html = false, attach = [] } = options;

    if (!id) {
      throw new Error('Message ID is required');
    }
    if (!content) {
      throw new Error('Reply content is required');
    }

    const payload = html
      ? {
        message: {
          body: {
            contentType: 'HTML',
            content,
          },
        },
      }
      : {
        comment: content,
      };

    let response;

    if (attach.length === 0) {
      response = await graphClient.mail.reply(id, payload);
    } else {
      const attachments = attach.map(filePath => buildFileAttachment(filePath));
      const draft = await graphClient.mail.createReply(id, payload);

      for (const attachment of attachments) {
        await graphClient.mail.addAttachment(draft.id, attachment);
      }

      response = await graphClient.mail.sendDraft(draft.id);
    }

    outputMailReplyResult({
      ...(response || {}),
      status: 'sent',
      action: 'reply',
      id,
      ...(attach.length > 0 ? { attachmentCount: attach.length } : {}),
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export async function replyAllMail(id, content, options = {}) {
  try {
    const { json = false, html = false, attach = [] } = options;

    if (!id) {
      throw new Error('Message ID is required');
    }
    if (!content) {
      throw new Error('Reply content is required');
    }

    const payload = html
      ? {
        message: {
          body: {
            contentType: 'HTML',
            content,
          },
        },
      }
      : {
        comment: content,
      };

    let response;

    if (attach.length === 0) {
      response = await graphClient.mail.replyAll(id, payload);
    } else {
      const attachments = attach.map(filePath => buildFileAttachment(filePath));
      const draft = await graphClient.mail.createReplyAll(id, payload);

      for (const attachment of attachments) {
        await graphClient.mail.addAttachment(draft.id, attachment);
      }

      response = await graphClient.mail.sendDraft(draft.id);
    }

    outputMailReplyResult({
      ...(response || {}),
      status: 'sent',
      action: 'reply-all',
      id,
      ...(attach.length > 0 ? { attachmentCount: attach.length } : {}),
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export async function forwardMail(id, to, content, options = {}) {
  try {
    const { json = false, html = false, attach = [] } = options;

    if (!id) {
      throw new Error('Message ID is required');
    }
    if (!to) {
      throw new Error('Recipient email(s) are required');
    }

    const toRecipients = parseRecipients(to);
    if (toRecipients.length === 0) {
      throw new Error('At least one valid recipient email is required');
    }

    const payload = html
      ? {
        message: {
          body: {
            contentType: 'HTML',
            content: content || '',
          },
        },
        toRecipients,
      }
      : {
        comment: content || '',
        toRecipients,
      };

    let response;

    if (attach.length === 0) {
      response = await graphClient.mail.forward(id, payload);
    } else {
      const attachments = attach.map(filePath => buildFileAttachment(filePath));
      const draft = await graphClient.mail.createForward(id);

      await graphClient.mail.updateMessage(draft.id, {
        body: {
          contentType: html ? 'HTML' : 'Text',
          content: content || '',
        },
        toRecipients,
      });

      for (const attachment of attachments) {
        await graphClient.mail.addAttachment(draft.id, attachment);
      }

      response = await graphClient.mail.sendDraft(draft.id);
    }

    outputMailForwardResult({
      ...(response || {}),
      status: 'sent',
      action: 'forward',
      id,
      to,
      recipientCount: toRecipients.length,
      ...(attach.length > 0 ? { attachmentCount: attach.length } : {}),
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * List mail folders
 */
export async function listMailFolders(options = {}) {
  try {
    const { top = 50, json = false, parent } = options;
    
    let folders;
    if (parent) {
      folders = await graphClient.mail.listChildFolders(parent, { top });
    } else {
      folders = await graphClient.mail.listFolders({ top });
    }
    
    outputMailFolderList(folders, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Create a mail folder
 */
export async function createMailFolder(name, options = {}) {
  try {
    const { json = false, parent } = options;
    
    if (!name) {
      throw new Error('Folder name is required');
    }
    
    const folder = await graphClient.mail.createFolder(name, parent || null);
    
    outputMailFolderResult({
      status: 'created',
      displayName: folder.displayName,
      id: folder.id,
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

/**
 * Delete a mail folder
 */
export async function deleteMailFolder(folderId, options = {}) {
  try {
    const { force = false, json = false } = options;
    
    if (!folderId) {
      throw new Error('Folder ID is required');
    }
    
    // Confirmation prompt (unless --force or --json)
    if (!force && !json) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('⚠️  Delete this mail folder and all its contents? This cannot be undone. (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        return;
      }
    }
    
    await graphClient.mail.deleteFolder(folderId);
    
    outputMailFolderResult({
      status: 'deleted',
      id: folderId,
    }, { json });
  } catch (error) {
    handleError(error, { json: options.json });
  }
}

export default {
  list: listMails,
  read: readMail,
  send: sendMail,
  search: searchMails,
  attachments: listAttachments,
  downloadAttachment,
  trust: trustSender,
  untrust: untrustSender,
  trusted: showTrustedSenders,
  delete: deleteMail,
  move: moveMail,
  reply: replyMail,
  replyAll: replyAllMail,
  forward: forwardMail,
  folderList: listMailFolders,
  folderCreate: createMailFolder,
  folderDelete: deleteMailFolder,
};
