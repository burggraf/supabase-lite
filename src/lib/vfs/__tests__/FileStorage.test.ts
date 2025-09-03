import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { FileStorage } from '../FileStorage.js';
import type { VFSFile, VFSProjectMetadata } from '../../../types/vfs.js';
import { DEFAULT_VFS_CONFIG, VFS_CONFIG } from '../constants.js';

// Mock performance API for browser environment
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
  },
  writable: true,
  configurable: true,
});

describe('FileStorage', () => {
  let fileStorage: FileStorage;
  const testProjectId = 'test-project-123';
  
  // Test data
  const smallFile: Omit<VFSFile, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId: testProjectId,
    path: 'test.txt',
    name: 'test.txt',
    mimeType: 'text/plain',
    size: 11,
    content: 'Hello World',
    chunked: false,
    directory: '',
    encoding: 'utf-8',
    compression: 'none',
  };
  
  const largeFileContent = 'x'.repeat(2 * 1024 * 1024); // 2MB content
  const largeFile: Omit<VFSFile, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId: testProjectId,
    path: 'large.txt',
    name: 'large.txt',
    mimeType: 'text/plain',
    size: largeFileContent.length,
    chunked: true,
    chunkIds: [],
    directory: '',
    encoding: 'utf-8',
    compression: 'gzip',
  };

  beforeEach(async () => {
    // Reset IndexedDB
    global.indexedDB = new IDBFactory();
    fileStorage = new FileStorage();
    await fileStorage.initialize(testProjectId);
  });

  afterEach(async () => {
    await fileStorage.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with correct project ID', () => {
      expect(fileStorage.getProjectId()).toBe(testProjectId);
    });

    it('should create IndexedDB with correct structure', async () => {
      const db = await fileStorage.getDatabase();
      expect(db).toBeInstanceOf(IDBDatabase);
      expect(db.objectStoreNames).toContain('files');
      expect(db.objectStoreNames).toContain('chunks');
      expect(db.objectStoreNames).toContain('metadata');
    });

    it('should initialize project metadata', async () => {
      const metadata = await fileStorage.getProjectMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.projectId).toBe(testProjectId);
      expect(metadata.storageUsed).toBe(0);
      expect(metadata.fileCount).toBe(0);
      expect(metadata.config).toEqual(DEFAULT_VFS_CONFIG);
    });

    it('should handle initialization errors gracefully', async () => {
      const badStorage = new FileStorage();
      await expect(badStorage.initialize('')).rejects.toThrow();
    });
  });

  describe('Small File Operations', () => {
    it('should save small file directly without chunking', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'file-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file);
      
      const retrieved = await fileStorage.loadFile(file.path);
      expect(retrieved).toBeDefined();
      expect(retrieved!.content).toBe(smallFile.content);
      expect(retrieved!.chunked).toBe(false);
      expect(retrieved!.chunkIds).toBeUndefined();
    });

    it('should update small file content', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'file-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file);
      
      const updatedFile = { ...file, content: 'Updated content', size: 15 };
      await fileStorage.saveFile(updatedFile);
      
      const retrieved = await fileStorage.loadFile(file.path);
      expect(retrieved!.content).toBe('Updated content');
      expect(retrieved!.size).toBe(15);
    });

    it('should delete small file', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'file-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file);
      expect(await fileStorage.loadFile(file.path)).toBeDefined();
      
      await fileStorage.deleteFile(file.path);
      expect(await fileStorage.loadFile(file.path)).toBeNull();
    });
  });

  describe('Large File Operations (Chunked)', () => {
    it('should save large file with chunking', async () => {
      const fileId = 'large-file-1';
      const chunks = fileStorage.createChunks(largeFileContent, VFS_CONFIG.CHUNK_SIZE, fileId);
      const file: VFSFile = {
        ...largeFile,
        id: fileId,
        chunkIds: chunks.map(c => c.id),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file, chunks);
      
      const retrieved = await fileStorage.loadFile(file.path);
      expect(retrieved).toBeDefined();
      expect(retrieved!.chunked).toBe(true);
      expect(retrieved!.chunkIds).toHaveLength(chunks.length);
      
      const content = await fileStorage.loadFileContent(file.path);
      expect(content).toBe(largeFileContent);
    });

    it('should create correct number of chunks for large files', () => {
      const content = 'x'.repeat(200 * 1024); // 200KB
      const chunks = fileStorage.createChunks(content, 64 * 1024); // 64KB chunks
      
      expect(chunks).toHaveLength(4); // 200KB / 64KB = ~3.125, so 4 chunks
      expect(chunks[0].sequence).toBe(0);
      expect(chunks[3].sequence).toBe(3);
      expect(chunks[0].size).toBe(64 * 1024);
      expect(chunks[3].size).toBe(8 * 1024); // Remaining 8KB
    });

    it('should handle chunked file deletion with cleanup', async () => {
      const fileId = 'large-file-1';
      const chunks = fileStorage.createChunks(largeFileContent, VFS_CONFIG.CHUNK_SIZE, fileId);
      const file: VFSFile = {
        ...largeFile,
        id: fileId,
        chunkIds: chunks.map(c => c.id),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file, chunks);
      
      // Verify chunks exist
      const chunkCount = await fileStorage.getChunkCount(fileId);
      expect(chunkCount).toBe(chunks.length);
      
      // Delete file
      await fileStorage.deleteFile(file.path);
      
      // Verify file and chunks are deleted
      expect(await fileStorage.loadFile(file.path)).toBeNull();
      expect(await fileStorage.getChunkCount(fileId)).toBe(0);
    });

    it('should update chunked file content', async () => {
      const fileId = 'large-file-1';
      const originalChunks = fileStorage.createChunks(largeFileContent, VFS_CONFIG.CHUNK_SIZE, fileId);
      const file: VFSFile = {
        ...largeFile,
        id: fileId,
        chunkIds: originalChunks.map(c => c.id),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file, originalChunks);
      
      // Update with different content
      const newContent = 'y'.repeat(1.5 * 1024 * 1024); // 1.5MB
      const newChunks = fileStorage.createChunks(newContent, VFS_CONFIG.CHUNK_SIZE, fileId);
      const updatedFile: VFSFile = {
        ...file,
        size: newContent.length,
        chunkIds: newChunks.map(c => c.id),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(updatedFile, newChunks);
      
      const content = await fileStorage.loadFileContent(file.path);
      expect(content).toBe(newContent);
      
      // Verify old chunks are cleaned up
      expect(await fileStorage.getChunkCount(fileId)).toBe(newChunks.length);
    });
  });

  describe('File Listing and Querying', () => {
    beforeEach(async () => {
      // Create test files in different directories
      const testFiles: VFSFile[] = [
        {
          id: 'file-1',
          projectId: testProjectId,
          path: 'index.html',
          name: 'index.html',
          mimeType: 'text/html',
          size: 100,
          content: '<html></html>',
          chunked: false,
          directory: '',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'file-2',
          projectId: testProjectId,
          path: 'src/app.js',
          name: 'app.js',
          mimeType: 'text/javascript',
          size: 200,
          content: 'console.log("Hello");',
          chunked: false,
          directory: 'src',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'file-3',
          projectId: testProjectId,
          path: 'src/utils/helper.js',
          name: 'helper.js',
          mimeType: 'text/javascript',
          size: 150,
          content: 'export const helper = () => {};',
          chunked: false,
          directory: 'src/utils',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
        {
          id: 'file-4',
          projectId: testProjectId,
          path: 'README.md',
          name: 'README.md',
          mimeType: 'text/markdown',
          size: 50,
          content: '# Project',
          chunked: false,
          directory: '',
          createdAt: new Date('2024-01-04'),
          updatedAt: new Date('2024-01-04'),
        },
      ];

      for (const file of testFiles) {
        await fileStorage.saveFile(file);
      }
    });

    it('should list all files', async () => {
      const files = await fileStorage.listFiles();
      expect(files).toHaveLength(4);
    });

    it('should list files in specific directory', async () => {
      const srcFiles = await fileStorage.listFiles({ directory: 'src' });
      expect(srcFiles).toHaveLength(1);
      expect(srcFiles[0].name).toBe('app.js');
    });

    it('should list files recursively', async () => {
      const srcFiles = await fileStorage.listFiles({ directory: 'src', recursive: true });
      expect(srcFiles).toHaveLength(2); // app.js and helper.js
    });

    it('should filter files by extension', async () => {
      const jsFiles = await fileStorage.listFiles({ extension: '.js' });
      expect(jsFiles).toHaveLength(2);
      expect(jsFiles.every(f => f.name.endsWith('.js'))).toBe(true);
    });

    it('should filter files by MIME type', async () => {
      const jsFiles = await fileStorage.listFiles({ mimeType: 'text/javascript' });
      expect(jsFiles).toHaveLength(2);
    });

    it('should sort files by name', async () => {
      const files = await fileStorage.listFiles({ sort: 'name', sortDirection: 'asc' });
      // Files should be sorted: app.js, helper.js, index.html, README.md (lowercase first)
      expect(files[0].name).toBe('app.js');
      expect(files[1].name).toBe('helper.js');
      expect(files[2].name).toBe('index.html');
      expect(files[3].name).toBe('README.md');
    });

    it('should sort files by size descending', async () => {
      const files = await fileStorage.listFiles({ sort: 'size', sortDirection: 'desc' });
      expect(files[0].size).toBeGreaterThanOrEqual(files[1].size);
    });

    it('should sort files by creation date', async () => {
      const files = await fileStorage.listFiles({ sort: 'created', sortDirection: 'asc' });
      expect(files[0].createdAt.getTime()).toBeLessThanOrEqual(files[1].createdAt.getTime());
    });

    it('should limit and offset results', async () => {
      const page1 = await fileStorage.listFiles({ limit: 2, offset: 0 });
      const page2 = await fileStorage.listFiles({ limit: 2, offset: 2 });
      
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('Storage Management', () => {
    it('should track storage usage correctly', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'file-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file);
      
      const metadata = await fileStorage.getProjectMetadata();
      expect(metadata.storageUsed).toBe(file.size);
      expect(metadata.fileCount).toBe(1);
    });

    it('should update storage usage on file updates', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'file-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file);
      
      const updatedFile = { ...file, content: 'Much longer content here', size: 25 };
      await fileStorage.saveFile(updatedFile);
      
      const metadata = await fileStorage.getProjectMetadata();
      expect(metadata.storageUsed).toBe(25);
    });

    it('should update storage usage on file deletion', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'file-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await fileStorage.saveFile(file);
      await fileStorage.deleteFile(file.path);
      
      const metadata = await fileStorage.getProjectMetadata();
      expect(metadata.storageUsed).toBe(0);
      expect(metadata.fileCount).toBe(0);
    });

    it('should check storage quota', async () => {
      const metadata = await fileStorage.getProjectMetadata();
      const usage = fileStorage.getStorageUsage(1000, metadata.config.maxStorage);
      expect(usage.percentage).toBe(1000 / metadata.config.maxStorage);
      expect(usage.warning).toBe(usage.percentage > 0.8);
      expect(usage.critical).toBe(usage.percentage > 0.95);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent file reads', async () => {
      const result = await fileStorage.loadFile('non-existent.txt');
      expect(result).toBeNull();
    });

    it('should handle file size validation', async () => {
      const oversizedFile: VFSFile = {
        ...smallFile,
        id: 'oversized',
        size: VFS_CONFIG.MAX_FILE_SIZE + 1,
        content: 'x'.repeat(VFS_CONFIG.MAX_FILE_SIZE + 1),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(fileStorage.saveFile(oversizedFile)).rejects.toThrow('File size exceeds maximum limit');
    });

    it('should handle storage quota exceeded', async () => {
      // Mock the project metadata to simulate near-full storage
      const mockMetadata: VFSProjectMetadata = {
        projectId: testProjectId,
        storageUsed: VFS_CONFIG.MAX_PROJECT_STORAGE - 1000,
        fileCount: 1,
        lastModified: new Date(),
        config: DEFAULT_VFS_CONFIG,
        version: 1,
      };
      
      await fileStorage.updateProjectMetadata(mockMetadata);

      const largeFile: VFSFile = {
        ...smallFile,
        id: 'large-file',
        size: 2000,
        content: 'x'.repeat(2000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(fileStorage.saveFile(largeFile)).rejects.toThrow('Project storage quota exceeded');
    });

    it('should handle corrupted chunks gracefully', async () => {
      const chunks = fileStorage.createChunks('test content', 64);
      const file: VFSFile = {
        ...largeFile,
        id: 'corrupted-file',
        chunkIds: chunks.map(c => c.id),
        size: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save file but not all chunks (simulate corruption)
      await fileStorage.saveFile({
        ...file,
        chunkIds: [chunks[0].id], // Missing chunks
      });

      await expect(fileStorage.loadFileContent(file.path)).rejects.toThrow('Failed to load file content');
    });
  });

  describe('Performance', () => {
    it('should complete small file operations within target time', async () => {
      const file: VFSFile = {
        ...smallFile,
        id: 'perf-test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const start = performance.now();
      await fileStorage.saveFile(file);
      await fileStorage.loadFile(file.path);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(VFS_CONFIG.TARGET_OPERATION_TIME);
    });

    it('should handle concurrent file operations', async () => {
      const files: VFSFile[] = Array.from({ length: 10 }, (_, i) => ({
        ...smallFile,
        id: `concurrent-${i}`,
        path: `file-${i}.txt`,
        name: `file-${i}.txt`,
        content: `File content ${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const start = performance.now();
      await Promise.all(files.map(file => fileStorage.saveFile(file)));
      const duration = performance.now() - start;

      // All 10 files should be saved reasonably quickly
      expect(duration).toBeLessThan(1000); // 1 second

      // Verify all files are saved
      for (const file of files) {
        const retrieved = await fileStorage.loadFile(file.path);
        expect(retrieved).toBeDefined();
      }
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup orphaned chunks', async () => {
      const chunks = fileStorage.createChunks('test content', 64);
      
      // Save chunks directly without file metadata
      for (const chunk of chunks) {
        await fileStorage.saveChunk(chunk);
      }
      
      let chunkCount = await fileStorage.getTotalChunkCount();
      expect(chunkCount).toBe(chunks.length);
      
      await fileStorage.cleanupOrphanedChunks();
      
      chunkCount = await fileStorage.getTotalChunkCount();
      expect(chunkCount).toBe(0);
    });

    it('should perform full project cleanup', async () => {
      // Create some files
      const file: VFSFile = {
        ...smallFile,
        id: 'cleanup-test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await fileStorage.saveFile(file);
      expect(await fileStorage.loadFile(file.path)).toBeDefined();
      
      await fileStorage.cleanup();
      
      // After cleanup, database should be empty
      const files = await fileStorage.listFiles();
      expect(files).toHaveLength(0);
    });
  });
});