import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FolderUploadService } from '../FolderUploadService';
import { vfsManager } from '../VFSManager';

// Mock VFSManager
vi.mock('../VFSManager', () => ({
  vfsManager: {
    createFile: vi.fn(),
    deleteFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('FolderUploadService', () => {
  let service: FolderUploadService;

  beforeEach(() => {
    service = new FolderUploadService();
    vi.clearAllMocks();
  });

  describe('uploadFromFileList', () => {
    it('should upload text files correctly', async () => {
      const mockFile = new File(['console.log("hello");'], 'script.js', {
        type: 'application/javascript',
      });
      Object.defineProperty(mockFile, 'webkitRelativePath', {
        value: 'my-app/script.js',
        writable: false,
      });

      const fileList = [mockFile] as any as FileList;
      const progressSpy = vi.fn();

      vi.mocked(vfsManager.readFile).mockResolvedValue(null);
      vi.mocked(vfsManager.createFile).mockResolvedValue({} as any);

      await service.uploadFromFileList(fileList, 'app/test-app', progressSpy);

      expect(vfsManager.createFile).toHaveBeenCalledWith(
        'app/test-app/my-app/script.js',
        expect.objectContaining({
          content: 'console.log("hello");',
          mimeType: 'application/javascript',
          encoding: 'utf-8',
          originalSize: mockFile.size,
        })
      );

      expect(progressSpy).toHaveBeenCalledWith({
        uploaded: 1,
        total: 1,
        currentFile: 'my-app/script.js',
      });
    });

    it('should upload binary files as base64', async () => {
      // Create a mock binary file (PNG header)
      const binaryData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const mockFile = new File([binaryData], 'image.png', {
        type: 'image/png',
      });
      Object.defineProperty(mockFile, 'webkitRelativePath', {
        value: 'my-app/image.png',
        writable: false,
      });

      const fileList = [mockFile] as any as FileList;

      vi.mocked(vfsManager.readFile).mockResolvedValue(null);
      vi.mocked(vfsManager.createFile).mockResolvedValue({} as any);

      await service.uploadFromFileList(fileList, 'app/test-app');

      expect(vfsManager.createFile).toHaveBeenCalledWith(
        'app/test-app/my-app/image.png',
        expect.objectContaining({
          mimeType: 'image/png',
          encoding: 'base64',
          originalSize: mockFile.size,
        })
      );
    });

    it('should filter ignored files', async () => {
      const files = [
        new File(['content'], 'package.json'),
        new File(['content'], 'node_modules/lib.js'),
        new File(['content'], '.git/config'),
        new File(['content'], 'src/app.js'),
      ];

      files.forEach((file, index) => {
        const paths = ['package.json', 'node_modules/lib.js', '.git/config', 'src/app.js'];
        Object.defineProperty(file, 'webkitRelativePath', {
          value: paths[index],
          writable: false,
        });
      });

      const fileList = files as any as FileList;

      vi.mocked(vfsManager.readFile).mockResolvedValue(null);
      vi.mocked(vfsManager.createFile).mockResolvedValue({} as any);

      await service.uploadFromFileList(fileList, 'app/test-app');

      // Should only upload package.json and src/app.js (node_modules and .git are ignored)
      expect(vfsManager.createFile).toHaveBeenCalledTimes(2);
      expect(vfsManager.createFile).toHaveBeenCalledWith(
        'app/test-app/package.json',
        expect.any(Object)
      );
      expect(vfsManager.createFile).toHaveBeenCalledWith(
        'app/test-app/src/app.js',
        expect.any(Object)
      );
    });

    it('should handle file upload errors', async () => {
      const mockFile = new File(['content'], 'test.txt');
      Object.defineProperty(mockFile, 'webkitRelativePath', {
        value: 'test.txt',
        writable: false,
      });

      const fileList = [mockFile] as any as FileList;

      vi.mocked(vfsManager.readFile).mockResolvedValue(null);
      vi.mocked(vfsManager.createFile).mockRejectedValue(new Error('Upload failed'));

      await expect(
        service.uploadFromFileList(fileList, 'app/test-app')
      ).rejects.toThrow('Failed to upload test.txt: Upload failed');
    });

    it('should replace existing files', async () => {
      const mockFile = new File(['new content'], 'existing.txt');
      Object.defineProperty(mockFile, 'webkitRelativePath', {
        value: 'existing.txt',
        writable: false,
      });

      const fileList = [mockFile] as any as FileList;

      // Mock existing file
      vi.mocked(vfsManager.readFile).mockResolvedValue({} as any);
      vi.mocked(vfsManager.deleteFile).mockResolvedValue(true);
      vi.mocked(vfsManager.createFile).mockResolvedValue({} as any);

      await service.uploadFromFileList(fileList, 'app/test-app');

      expect(vfsManager.deleteFile).toHaveBeenCalledWith('app/test-app/existing.txt');
      expect(vfsManager.createFile).toHaveBeenCalledWith(
        'app/test-app/existing.txt',
        expect.objectContaining({
          content: 'new content',
        })
      );
    });
  });

  describe('MIME type detection', () => {
    it('should detect common MIME types', async () => {
      const testCases = [
        { filename: 'index.html', expectedType: 'text/html' },
        { filename: 'style.css', expectedType: 'text/css' },
        { filename: 'app.js', expectedType: 'application/javascript' },
        { filename: 'data.json', expectedType: 'application/json' },
        { filename: 'image.png', expectedType: 'image/png' },
        { filename: 'unknown.xyz', expectedType: 'application/octet-stream' },
      ];

      for (const testCase of testCases) {
        const mockFile = new File(['content'], testCase.filename);
        Object.defineProperty(mockFile, 'webkitRelativePath', {
          value: testCase.filename,
          writable: false,
        });

        const fileList = [mockFile] as any as FileList;

        vi.mocked(vfsManager.readFile).mockResolvedValue(null);
        vi.mocked(vfsManager.createFile).mockResolvedValue({} as any);

        await service.uploadFromFileList(fileList, 'app/test-app');

        expect(vfsManager.createFile).toHaveBeenCalledWith(
          `app/test-app/${testCase.filename}`,
          expect.objectContaining({
            mimeType: testCase.expectedType,
          })
        );

        vi.clearAllMocks();
      }
    });
  });

  describe('file filtering', () => {
    it('should match glob patterns correctly', async () => {
      const files = [
        'package.json',           // Should be included
        'node_modules/lib.js',    // Should be excluded
        'src/components/App.js',  // Should be included
        '.DS_Store',              // Should be excluded
        'build/static/css/main.css', // Should be included
        'coverage/index.html',    // Should be excluded
        'yarn.lock',              // Should be included
        'npm-debug.log',          // Should be excluded
      ].map(path => {
        const file = new File(['content'], path.split('/').pop()!);
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path,
          writable: false,
        });
        return file;
      });

      const fileList = files as any as FileList;

      vi.mocked(vfsManager.readFile).mockResolvedValue(null);
      vi.mocked(vfsManager.createFile).mockResolvedValue({} as any);

      await service.uploadFromFileList(fileList, 'app/test-app');

      // Should include: package.json, src/components/App.js, build/static/css/main.css, yarn.lock
      expect(vfsManager.createFile).toHaveBeenCalledTimes(4);
    });
  });
});