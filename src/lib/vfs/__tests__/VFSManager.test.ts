import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { VFSManager } from '../VFSManager.js';
import type { VFSCreateFileOptions } from '../../../types/vfs.js';
import { VFS_CONFIG } from '../constants.js';

// Mock performance API for browser environment  
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now(),
  },
  writable: true,
  configurable: true,
});

describe('VFSManager', () => {
  let vfsManager: VFSManager;
  const testProjectId = 'test-project-123';

  beforeEach(async () => {
    // Reset IndexedDB
    global.indexedDB = new IDBFactory();
    
    vfsManager = VFSManager.getInstance();
    await vfsManager.initialize(testProjectId);
  });

  afterEach(async () => {
    await vfsManager.cleanup();
    // Reset singleton for next test
    (VFSManager as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = VFSManager.getInstance();
      const instance2 = VFSManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = VFSManager.getInstance();
      await instance1.initialize('project-1');
      
      const instance2 = VFSManager.getInstance();
      expect(instance2.getCurrentProjectId()).toBe('project-1');
    });
  });

  describe('Initialization', () => {
    it('should initialize with project ID', async () => {
      expect(vfsManager.getCurrentProjectId()).toBe(testProjectId);
      expect(vfsManager.isInitialized()).toBe(true);
    });

    it('should handle multiple initialization attempts safely', async () => {
      const firstInit = vfsManager.initialize('project-1');
      const secondInit = vfsManager.initialize('project-2');
      
      // Both should resolve without errors
      await expect(firstInit).resolves.not.toThrow();
      await expect(secondInit).resolves.not.toThrow();
      
      // Second initialization should win
      expect(vfsManager.getCurrentProjectId()).toBe('project-2');
    });

    it('should throw error for invalid project ID', async () => {
      const _newManager = VFSManager.getInstance();
      (VFSManager as any).instance = null; // Reset singleton
      const freshManager = VFSManager.getInstance();
      
      await expect(freshManager.initialize('')).rejects.toThrow();
      await expect(freshManager.initialize(null as any)).rejects.toThrow();
    });

    it('should handle initialization failures gracefully', async () => {
      // Mock FileStorage to fail initialization
      const originalFileStorage = vfsManager['fileStorage'];
      vfsManager['fileStorage'] = {
        initialize: vi.fn().mockRejectedValue(new Error('Storage failed')),
      } as any;

      const newProjectId = 'failing-project';
      await expect(vfsManager.initialize(newProjectId)).rejects.toThrow('Storage failed');
      
      // Should not update project ID on failure
      expect(vfsManager.getCurrentProjectId()).toBe(testProjectId);
      
      // Restore original storage
      vfsManager['fileStorage'] = originalFileStorage;
    });
  });

  describe('Project Management', () => {
    it('should switch between projects', async () => {
      const project2 = 'test-project-456';
      
      await vfsManager.switchToProject(project2);
      expect(vfsManager.getCurrentProjectId()).toBe(project2);
    });

    it('should isolate files between projects', async () => {
      const file1Options: VFSCreateFileOptions = {
        content: 'Project 1 content',
        mimeType: 'text/plain',
      };
      
      // Create file in project 1
      await vfsManager.createFile('test.txt', file1Options);
      const files1 = await vfsManager.listFiles();
      expect(files1).toHaveLength(1);
      
      // Switch to project 2
      await vfsManager.switchToProject('project-2');
      const files2 = await vfsManager.listFiles();
      expect(files2).toHaveLength(0);
      
      // Create different file in project 2
      const file2Options: VFSCreateFileOptions = {
        content: 'Project 2 content',
        mimeType: 'text/plain',
      };
      await vfsManager.createFile('test2.txt', file2Options);
      const files2After = await vfsManager.listFiles();
      expect(files2After).toHaveLength(1);
      expect(files2After[0].name).toBe('test2.txt');
      
      // Switch back to project 1 - should still have original file
      await vfsManager.switchToProject(testProjectId);
      const files1After = await vfsManager.listFiles();
      expect(files1After).toHaveLength(1);
      expect(files1After[0].name).toBe('test.txt');
    });

    it('should handle project switching during operations', async () => {
      // Start a file creation
      const filePromise = vfsManager.createFile('test.txt', { content: 'test content' });
      
      // Immediately try to switch project
      const switchPromise = vfsManager.switchToProject('other-project');
      
      // Both operations should complete without errors
      await Promise.all([filePromise, switchPromise]);
      
      // Should be on the new project
      expect(vfsManager.getCurrentProjectId()).toBe('other-project');
    });
  });

  describe('File Operations', () => {
    describe('createFile', () => {
      it('should create a file with basic options', async () => {
        const options: VFSCreateFileOptions = {
          content: 'Hello, World!',
          mimeType: 'text/plain',
        };
        
        const file = await vfsManager.createFile('hello.txt', options);
        
        expect(file).toBeDefined();
        expect(file.path).toBe('hello.txt');
        expect(file.name).toBe('hello.txt');
        expect(file.content).toBe('Hello, World!');
        expect(file.mimeType).toBe('text/plain');
        expect(file.size).toBe(13);
        expect(file.projectId).toBe(testProjectId);
      });

      it('should auto-detect MIME type from file extension', async () => {
        const jsFile = await vfsManager.createFile('script.js', { content: 'console.log("test");' });
        expect(jsFile.mimeType).toBe('text/javascript');
        
        const htmlFile = await vfsManager.createFile('index.html', { content: '<html></html>' });
        expect(htmlFile.mimeType).toBe('text/html');
        
        const jsonFile = await vfsManager.createFile('data.json', { content: '{}' });
        expect(jsonFile.mimeType).toBe('application/json');
      });

      it('should create parent directories automatically', async () => {
        const options: VFSCreateFileOptions = {
          content: 'nested file',
          createDirectories: true,
        };
        
        const file = await vfsManager.createFile('src/components/Button.tsx', options);
        expect(file.directory).toBe('src/components');
      });

      it('should handle large files with chunking', async () => {
        const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
        const options: VFSCreateFileOptions = {
          content: largeContent,
          mimeType: 'text/plain',
        };
        
        const file = await vfsManager.createFile('large.txt', options);
        
        expect(file.chunked).toBe(true);
        expect(file.size).toBe(largeContent.length);
        expect(file.chunkIds).toBeDefined();
        expect(file.chunkIds!.length).toBeGreaterThan(1);
      });

      it('should reject duplicate file names', async () => {
        await vfsManager.createFile('duplicate.txt', { content: 'first' });
        
        await expect(
          vfsManager.createFile('duplicate.txt', { content: 'second' })
        ).rejects.toThrow('File already exists');
      });

      it('should validate file size limits', async () => {
        const oversizedContent = 'x'.repeat(VFS_CONFIG.MAX_FILE_SIZE + 1);
        
        await expect(
          vfsManager.createFile('huge.txt', { content: oversizedContent })
        ).rejects.toThrow('File size exceeds maximum limit');
      });

      it('should handle compression for text files', async () => {
        const options: VFSCreateFileOptions = {
          content: 'This is some text content that should be compressed',
          compress: true,
        };
        
        const file = await vfsManager.createFile('compressed.txt', options);
        expect(file.compression).toBe('gzip');
      });
    });

    describe('readFile', () => {
      beforeEach(async () => {
        await vfsManager.createFile('test.txt', { content: 'test content' });
      });

      it('should read existing file', async () => {
        const file = await vfsManager.readFile('test.txt');
        
        expect(file).toBeDefined();
        expect(file!.content).toBe('test content');
      });

      it('should return null for non-existent file', async () => {
        const file = await vfsManager.readFile('nonexistent.txt');
        expect(file).toBeNull();
      });

      it('should handle file path normalization', async () => {
        const file1 = await vfsManager.readFile('./test.txt');
        const file2 = await vfsManager.readFile('/test.txt');
        const file3 = await vfsManager.readFile('test.txt');
        
        // All should resolve to the same file
        expect(file1?.path).toBe('test.txt');
        expect(file2?.path).toBe('test.txt');
        expect(file3?.path).toBe('test.txt');
      });
    });

    describe('updateFile', () => {
      beforeEach(async () => {
        await vfsManager.createFile('update-test.txt', { content: 'original content' });
      });

      it('should update existing file content', async () => {
        const updatedFile = await vfsManager.updateFile('update-test.txt', 'new content');
        
        expect(updatedFile.content).toBe('new content');
        expect(updatedFile.size).toBe(11);
        expect(updatedFile.updatedAt.getTime()).toBeGreaterThan(updatedFile.createdAt.getTime());
      });

      it('should throw error for non-existent file', async () => {
        await expect(
          vfsManager.updateFile('nonexistent.txt', 'content')
        ).rejects.toThrow('File not found');
      });

      it('should handle size changes correctly', async () => {
        const originalStats = await vfsManager.getStats();
        const originalSize = originalStats.totalSize;
        
        await vfsManager.updateFile('update-test.txt', 'much longer content than before');
        
        const newStats = await vfsManager.getStats();
        expect(newStats.totalSize).toBeGreaterThan(originalSize);
      });
    });

    describe('deleteFile', () => {
      beforeEach(async () => {
        await vfsManager.createFile('delete-test.txt', { content: 'to be deleted' });
      });

      it('should delete existing file', async () => {
        const deleted = await vfsManager.deleteFile('delete-test.txt');
        expect(deleted).toBe(true);
        
        const file = await vfsManager.readFile('delete-test.txt');
        expect(file).toBeNull();
      });

      it('should return false for non-existent file', async () => {
        const deleted = await vfsManager.deleteFile('nonexistent.txt');
        expect(deleted).toBe(false);
      });

      it('should update storage stats after deletion', async () => {
        const statsBefore = await vfsManager.getStats();
        
        await vfsManager.deleteFile('delete-test.txt');
        
        const statsAfter = await vfsManager.getStats();
        expect(statsAfter.totalFiles).toBe(statsBefore.totalFiles - 1);
        expect(statsAfter.totalSize).toBeLessThan(statsBefore.totalSize);
      });
    });

    describe('listFiles', () => {
      beforeEach(async () => {
        // Create test file structure
        await vfsManager.createFile('root.txt', { content: 'root file' });
        await vfsManager.createFile('src/app.js', { content: 'app code' });
        await vfsManager.createFile('src/utils/helper.js', { content: 'helper code' });
        await vfsManager.createFile('docs/README.md', { content: '# Docs' });
        await vfsManager.createFile('package.json', { content: '{}' });
      });

      it('should list all files by default', async () => {
        const files = await vfsManager.listFiles();
        expect(files).toHaveLength(5);
      });

      it('should filter by directory', async () => {
        const srcFiles = await vfsManager.listFiles({ directory: 'src' });
        expect(srcFiles).toHaveLength(1);
        expect(srcFiles[0].name).toBe('app.js');
      });

      it('should list files recursively', async () => {
        const srcFiles = await vfsManager.listFiles({ directory: 'src', recursive: true });
        expect(srcFiles).toHaveLength(2); // app.js and helper.js
      });

      it('should filter by extension', async () => {
        const jsFiles = await vfsManager.listFiles({ extension: '.js' });
        expect(jsFiles).toHaveLength(2);
        expect(jsFiles.every(f => f.name.endsWith('.js'))).toBe(true);
      });

      it('should sort files', async () => {
        const files = await vfsManager.listFiles({ sort: 'name', sortDirection: 'asc' });
        expect(files[0].name).toBe('README.md');
        expect(files[1].name).toBe('app.js');
      });

      it('should paginate results', async () => {
        const page1 = await vfsManager.listFiles({ limit: 2, offset: 0 });
        const page2 = await vfsManager.listFiles({ limit: 2, offset: 2 });
        
        expect(page1).toHaveLength(2);
        expect(page2).toHaveLength(2);
        expect(page1[0].id).not.toBe(page2[0].id);
      });
    });
  });

  describe('Directory Operations', () => {
    it('should create directory structure', async () => {
      const directory = await vfsManager.createDirectory('src/components');
      
      expect(directory.path).toBe('src/components');
      expect(directory.name).toBe('components');
      expect(directory.parent).toBe('src');
    });

    it('should delete empty directory', async () => {
      await vfsManager.createDirectory('empty-dir');
      
      const deleted = await vfsManager.deleteDirectory('empty-dir');
      expect(deleted).toBe(true);
    });

    it('should delete directory recursively', async () => {
      await vfsManager.createFile('dir/file1.txt', { content: 'file 1', createDirectories: true });
      await vfsManager.createFile('dir/file2.txt', { content: 'file 2' });
      
      const deleted = await vfsManager.deleteDirectory('dir', true);
      expect(deleted).toBe(true);
      
      // Files should be deleted too
      const file1 = await vfsManager.readFile('dir/file1.txt');
      const file2 = await vfsManager.readFile('dir/file2.txt');
      expect(file1).toBeNull();
      expect(file2).toBeNull();
    });

    it('should reject deleting non-empty directory without recursive flag', async () => {
      await vfsManager.createFile('dir/file.txt', { content: 'file', createDirectories: true });
      
      await expect(
        vfsManager.deleteDirectory('dir', false)
      ).rejects.toThrow('Directory is not empty');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await vfsManager.createFile('small.txt', { content: 'small' });
      await vfsManager.createFile('medium.txt', { content: 'x'.repeat(1000) });
      await vfsManager.createFile('src/app.js', { content: 'console.log("app");' });
    });

    it('should provide accurate statistics', async () => {
      const stats = await vfsManager.getStats();
      
      expect(stats.totalFiles).toBe(3);
      expect(stats.totalDirectories).toBe(1); // src directory
      expect(stats.totalSize).toBeGreaterThan(1000);
      expect(stats.quotaUsage).toBeGreaterThan(0);
      expect(stats.quotaUsage).toBeLessThan(1);
    });

    it('should track largest file', async () => {
      const stats = await vfsManager.getStats();
      expect(stats.largestFile).toBe(1000); // medium.txt
    });

    it('should count chunked files', async () => {
      const largeContent = 'x'.repeat(2 * 1024 * 1024);
      await vfsManager.createFile('large.txt', { content: largeContent });
      
      const stats = await vfsManager.getStats();
      expect(stats.chunkedFiles).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage quota exceeded', async () => {
      // Mock storage to be near capacity
      const originalStats = await vfsManager.getStats();
      vi.spyOn(vfsManager['fileStorage'], 'getProjectMetadata').mockResolvedValue({
        ...originalStats,
        storageUsed: VFS_CONFIG.MAX_PROJECT_STORAGE - 100,
        config: { maxStorage: VFS_CONFIG.MAX_PROJECT_STORAGE },
      } as any);

      const largeContent = 'x'.repeat(1000);
      await expect(
        vfsManager.createFile('large.txt', { content: largeContent })
      ).rejects.toThrow('Project storage quota exceeded');
    });

    it('should handle invalid file paths', async () => {
      const invalidPaths = ['', '../outside', 'con', 'file\x00name'];
      
      for (const path of invalidPaths) {
        await expect(
          vfsManager.createFile(path, { content: 'test' })
        ).rejects.toThrow();
      }
    });

    it('should handle concurrent operations gracefully', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        vfsManager.createFile(`file-${i}.txt`, { content: `content ${i}` })
      );
      
      const results = await Promise.allSettled(promises);
      
      // All should succeed
      results.forEach((result, i) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.name).toBe(`file-${i}.txt`);
        }
      });
    });
  });

  describe('Cleanup and Management', () => {
    beforeEach(async () => {
      await vfsManager.createFile('cleanup-test.txt', { content: 'test' });
    });

    it('should cleanup project data', async () => {
      await vfsManager.cleanup();
      
      const files = await vfsManager.listFiles();
      expect(files).toHaveLength(0);
    });

    it('should maintain consistent state after cleanup', async () => {
      const projectId = vfsManager.getCurrentProjectId();
      
      await vfsManager.cleanup();
      
      expect(vfsManager.getCurrentProjectId()).toBe(projectId);
      expect(vfsManager.isInitialized()).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete operations within target time for small files', async () => {
      const start = performance.now();
      
      await vfsManager.createFile('perf-test.txt', { content: 'performance test' });
      await vfsManager.readFile('perf-test.txt');
      await vfsManager.updateFile('perf-test.txt', 'updated content');
      await vfsManager.deleteFile('perf-test.txt');
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(VFS_CONFIG.TARGET_OPERATION_TIME);
    });

    it('should handle large numbers of files efficiently', async () => {
      const fileCount = 100;
      const start = performance.now();
      
      // Create files
      const createPromises = Array.from({ length: fileCount }, (_, i) =>
        vfsManager.createFile(`file-${i}.txt`, { content: `Content ${i}` })
      );
      await Promise.all(createPromises);
      
      // List files
      const files = await vfsManager.listFiles();
      expect(files).toHaveLength(fileCount);
      
      const duration = performance.now() - start;
      
      // Should handle 100 files in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('State Management', () => {
    it('should maintain initialization state correctly', async () => {
      expect(vfsManager.isInitialized()).toBe(true);
      
      await vfsManager.switchToProject('new-project');
      expect(vfsManager.isInitialized()).toBe(true);
      
      await vfsManager.cleanup();
      expect(vfsManager.isInitialized()).toBe(true);
    });

    it('should handle operation queuing during transitions', async () => {
      // Start project switch
      const switchPromise = vfsManager.switchToProject('other-project');
      
      // Queue file operation
      const filePromise = vfsManager.createFile('queued.txt', { content: 'queued' });
      
      // Wait for both
      await Promise.all([switchPromise, filePromise]);
      
      // File should be created in new project
      expect(vfsManager.getCurrentProjectId()).toBe('other-project');
      const file = await vfsManager.readFile('queued.txt');
      expect(file).toBeDefined();
    });
  });
});