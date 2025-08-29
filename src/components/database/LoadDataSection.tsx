import { useState, useCallback, useRef } from 'react';
import { Upload, File, Play, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabase } from '@/hooks/useDatabase';

interface UploadedFile {
  file: File;
  id: string;
  name: string;
  size: string;
  status: 'ready' | 'processing' | 'completed' | 'error';
  progress?: {
    percentage: number;
    currentStatement: string;
  };
  result?: {
    executedStatements: number;
    duration: number;
  };
  error?: string;
}

export function LoadDataSection() {
  const { executeScript, executeQuery, isConnected } = useDatabase();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFiles = useCallback((files: FileList) => {
    const sqlFiles = Array.from(files).filter(file => 
      file.name.toLowerCase().endsWith('.sql') || 
      file.type === 'application/sql' ||
      file.type === 'text/plain'
    );

    if (sqlFiles.length === 0) {
      alert('Please select SQL files (.sql extension)');
      return;
    }

    const newFiles: UploadedFile[] = sqlFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      name: file.name,
      size: formatBytes(file.size),
      status: 'ready' as const,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProcessingFile(null);
  }, []);

  const processFile = useCallback(async (uploadedFile: UploadedFile) => {
    if (!isConnected) {
      alert('Database not connected');
      return;
    }

    setProcessingFile(uploadedFile.id);
    abortControllerRef.current = new AbortController();

    // Update file status
    setUploadedFiles(prev => prev.map(f => 
      f.id === uploadedFile.id 
        ? { ...f, status: 'processing', progress: { 
            percentage: 0,
            currentStatement: 'Reading entire file...'
          }, result: undefined, error: undefined }
        : f
    ));

    try {
      console.log(`🚀 EXECUTING ENTIRE FILE WITHOUT PARSING: ${uploadedFile.file.name} (${uploadedFile.file.size} bytes)`);
      
      const startTime = performance.now();
      
      // Read entire file as text
      const fileText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(uploadedFile.file);
      });
      
      console.log(`📖 File read complete: ${fileText.length} characters`);
      console.log(`📖 First 200 chars: ${fileText.substring(0, 200)}`);
      
      // Update progress - file read
      setUploadedFiles(prev => prev.map(f =>
        f.id === uploadedFile.id ? { 
          ...f, 
          progress: { 
            percentage: 50,
            currentStatement: 'Executing entire SQL file...' 
          } 
        } : f
      ));
      
      // Execute entire file content using executeScript (PGlite .exec() method)
      console.log(`🚀 Executing entire file content via executeScript...`);
      
      const scriptResult = await executeScript(fileText);
      console.log(`✅ Script execution completed:`, scriptResult);
      
      const duration = performance.now() - startTime;
      const result = {
        executedStatements: scriptResult.results?.length || 1,
        duration: Math.round(duration * 100) / 100
      };

      // Mark as completed
      setUploadedFiles(prev => prev.map(f =>
        f.id === uploadedFile.id 
          ? { ...f, status: 'completed', result, progress: {
              percentage: 100,
              currentStatement: 'Completed successfully!'
            } }
          : f
      ));

      console.log(`✅ File execution completed successfully!`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setUploadedFiles(prev => prev.map(f =>
        f.id === uploadedFile.id 
          ? { ...f, status: 'error', error: errorMessage }
          : f
      ));
    } finally {
      setProcessingFile(null);
      abortControllerRef.current = null;
    }
  }, [isConnected, executeScript]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Load Data</h1>
        <p className="text-muted-foreground mt-2">
          Upload and execute large SQL dump files to load data into your database.
          Files are processed in chunks to handle very large datasets efficiently.
        </p>
      </div>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload SQL Files</CardTitle>
          <CardDescription>
            Select or drag & drop SQL files to upload. Large files are supported.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Drop SQL files here</h3>
            <p className="text-muted-foreground mb-4">
              or click to browse your computer
            </p>
            <Button variant="outline">
              Select Files
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".sql,application/sql,text/plain"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadedFiles.map((uploadedFile) => (
              <div key={uploadedFile.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{uploadedFile.size}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadedFile.status === 'ready' && (
                      <Button
                        size="sm"
                        onClick={() => processFile(uploadedFile)}
                        disabled={!isConnected || processingFile !== null}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Execute
                      </Button>
                    )}
                    
                    {uploadedFile.status === 'processing' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={cancelProcessing}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    
                    {uploadedFile.status !== 'processing' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(uploadedFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {uploadedFile.status === 'processing' && uploadedFile.progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                      <span>{uploadedFile.progress.percentage}%</span>
                    </div>
                    <Progress value={uploadedFile.progress.percentage} />
                    <div className="text-xs text-muted-foreground">
                      Processing SQL dump file...
                    </div>
                    {uploadedFile.progress.currentStatement && (
                      <p className="text-xs text-muted-foreground">
                        Current: {uploadedFile.progress.currentStatement}
                      </p>
                    )}
                  </div>
                )}

                {/* Result Display */}
                {uploadedFile.status === 'completed' && uploadedFile.result && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Successfully completed!</p>
                        <div className="text-sm">
                          <div>Executed statements: {uploadedFile.result.executedStatements}</div>
                        </div>
                        <p className="text-xs">Duration: {uploadedFile.result.duration}ms</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {uploadedFile.status === 'error' && uploadedFile.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium">Processing failed</p>
                      <p className="text-sm">{uploadedFile.error}</p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Database Connection Warning */}
      {!isConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Database not connected. Please ensure your database connection is active before loading data.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}