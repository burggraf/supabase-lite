/**
 * Utility functions for file operations in the browser
 */

export interface BackupFile {
  name: string;
  size: number;
  createdAt: Date;
  projectName: string;
}

/**
 * Triggers a download of a Blob or File in the browser
 */
export function downloadFile(blob: Blob | File, filename: string): void {
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads an uploaded file and returns its content
 */
export function readUploadedFile(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    
    // For backup files, we just return the file as-is since PGlite expects a Blob/File
    resolve(file);
  });
}

/**
 * Validates that a file is a valid backup file format
 */
export function validateBackupFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  const validExtensions = ['.tgz', '.tar.gz', '.tar'];
  const hasValidExtension = validExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a .tgz, .tar.gz, or .tar file.'
    };
  }
  
  // Check file size (reasonable limits)
  const maxSizeMB = 500; // 500MB max
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`
    };
  }
  
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty.'
    };
  }
  
  return { valid: true };
}

/**
 * Generates a backup filename with timestamp
 */
export function generateBackupFilename(projectName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `supabase-lite-backup-${sanitizedProjectName}-${timestamp}.tgz`;
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Stores backup metadata in localStorage
 */
export function storeBackupHistory(backup: BackupFile): void {
  const STORAGE_KEY = 'supabase_lite_backup_history';
  const MAX_HISTORY = 10;
  
  try {
    const existingHistory = localStorage.getItem(STORAGE_KEY);
    let history: BackupFile[] = existingHistory ? JSON.parse(existingHistory) : [];
    
    // Convert date strings back to Date objects
    history = history.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }));
    
    // Add new backup to the beginning
    history.unshift(backup);
    
    // Keep only the last MAX_HISTORY items
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to store backup history:', error);
  }
}

/**
 * Retrieves backup history from localStorage
 */
export function getBackupHistory(): BackupFile[] {
  const STORAGE_KEY = 'supabase_lite_backup_history';
  
  try {
    const existingHistory = localStorage.getItem(STORAGE_KEY);
    if (!existingHistory) return [];
    
    const history: BackupFile[] = JSON.parse(existingHistory);
    
    // Convert date strings back to Date objects
    return history.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }));
  } catch (error) {
    console.warn('Failed to retrieve backup history:', error);
    return [];
  }
}

/**
 * Clears backup history from localStorage
 */
export function clearBackupHistory(): void {
  const STORAGE_KEY = 'supabase_lite_backup_history';
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear backup history:', error);
  }
}