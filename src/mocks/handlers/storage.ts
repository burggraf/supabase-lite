import { http } from 'msw'
import { VFSBridge } from '../../lib/vfs/VFSBridge'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createErrorResponse, 
  initializeVFS,
  safeJsonParse
} from './shared/common-handlers'

// Initialize the VFS bridge
const vfsBridge = new VFSBridge()

// VFS Handler Functions (extracted from original handlers)
const createVFSFileGetHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string; // Catch-all path parameter
    const rangeHeader = request.headers.get('range');
    
    // Parse URL to check for token parameter (for signed URLs)
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    console.log('📁 MSW: VFS file GET request', { bucket, path, token: !!token, range: rangeHeader, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    let response;
    if (token) {
      // Handle as authenticated/signed URL request
      response = await vfsBridge.handleAuthenticatedFileRequest({
        bucket,
        path,
        token,
      });
    } else {
      // Handle as regular file request
      response = await vfsBridge.handleFileRequest({
        bucket,
        path,
        range: rangeHeader || undefined,
      });
    }
    
    console.log('✅ MSW: VFS file served', { bucket, path, token: !!token, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS file GET error:', error);
    return createErrorResponse(
      'file_request_failed', 
      'Failed to serve file',
      500
    );
  }
};

const createVFSFilePostHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string;
    const formData = await request.formData();
    
    console.log('📁 MSW: VFS file POST request', { bucket, path, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    const response = await vfsBridge.handleUploadRequest({
      bucket,
      path,
      formData,
    });
    
    console.log('✅ MSW: VFS file uploaded', { bucket, path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS file POST error:', error);
    return createErrorResponse(
      'upload_failed', 
      'Failed to upload file',
      500
    );
  }
};

const createVFSFileDeleteHandler = () => async ({ params, request: _request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string;
    
    console.log('📁 MSW: VFS file DELETE request', { bucket, path, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    const response = await vfsBridge.handleDeleteRequest({
      bucket,
      path,
    });
    
    console.log('✅ MSW: VFS file deleted', { bucket, path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS file DELETE error:', error);
    return createErrorResponse(
      'delete_failed', 
      'Failed to delete file',
      500
    );
  }
};

// Signed URL Handler Functions
const createSignedUrlHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)

    const { bucket } = params;
    const path = params[0] || '';
    
    const body = await safeJsonParse(request);
    const { expiresIn = 3600, transform, download } = body;

    console.log('🔗 MSW: Creating signed URL', { bucket, path, expiresIn, projectId: projectInfo?.projectId });

    return await vfsBridge.handleCreateSignedUrlRequest({
      bucket,
      path,
      signedUrlOptions: { expiresIn, transform, download },
      projectId: projectInfo?.projectId || 'default',
    });
  } catch (error) {
    console.error('Signed URL handler error:', error);
    return createErrorResponse(
      'signed_url_handler_error',
      'Internal server error in signed URL handler',
      500
    );
  }
};

const createSignedUploadUrlHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)

    const { bucket } = params;
    const path = params[0] || '';
    
    const body = await safeJsonParse(request);
    const { expiresIn, upsert } = body;

    console.log('⬆️ MSW: Creating signed upload URL', { bucket, path, expiresIn, upsert, projectId: projectInfo?.projectId });

    return await vfsBridge.handleCreateSignedUploadUrlRequest({
      bucket,
      path,
      signedUploadUrlOptions: { expiresIn, upsert },
      projectId: projectInfo?.projectId || 'default',
    });
  } catch (error) {
    console.error('Signed upload URL handler error:', error);
    return createErrorResponse(
      'signed_upload_url_handler_error',
      'Internal server error in signed upload URL handler',
      500
    );
  }
};

const createPublicUrlHandler = () => async ({ params, request, projectInfo }: any) => {
  console.log('🌐 MSW: Public URL handler started');
  try {
    console.log('🌐 MSW: About to initialize VFS');
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)

    const { bucket } = params;
    const path = params[0] || '';
    
    const url = new URL(request.url);
    const transform = Object.fromEntries(url.searchParams);

    console.log('🌐 MSW: Creating public URL', { bucket, path, transform, projectId: projectInfo?.projectId });

    return await vfsBridge.handlePublicUrlRequest({
      bucket,
      path,
      publicUrlOptions: { transform }
    });
  } catch (error) {
    console.error('Public URL handler error:', error);
    return createErrorResponse(
      'public_url_handler_error',
      'Internal server error in public URL handler',
      500
    );
  }
};

const createAuthenticatedFileHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)

    const bucket = params.bucket as string;
    const path = params[0] as string;
    const authHeader = request.headers.get('Authorization');
    
    console.log('🔒 MSW: Authenticated file request', { bucket, path, hasAuth: !!authHeader, projectId: projectInfo?.projectId });

    return await vfsBridge.handleAuthenticatedFileRequest({
      bucket,
      path,
      userContext: { authHeader }
    });
  } catch (error) {
    console.error('❌ MSW: Authenticated file error:', error);
    return createErrorResponse(
      'authenticated_file_failed', 
      'Failed to serve authenticated file',
      500
    );
  }
};

const createVFSListHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] || '';
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search') || undefined;
    
    console.log('📋 MSW: VFS list request', { bucket, path, limit, offset, search, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    const response = await vfsBridge.handleListRequest({
      bucket,
      prefix: path,
      limit,
      offset
    });
    
    console.log('✅ MSW: VFS list completed', { bucket, path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS list error:', error);
    return createErrorResponse(
      'list_failed', 
      'Failed to list files',
      500
    );
  }
};

// Storage handlers
export const storageHandlers = [
  // Bucket management
  http.post('/storage/v1/bucket', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { id, name, public: isPublic = false, file_size_limit, allowed_mime_types, avif_autodetection = false } = body;
      
      if (!id) {
        return createErrorResponse(
          'Bucket id is required',
          'Bucket id must be provided',
          400
        );
      }

      console.log('🪣 MSW: Creating bucket:', { id, name: name || id, public: isPublic, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      await initializeVFS(vfsBridge, projectInfo)

      const response = await vfsBridge.handleCreateBucketRequest({
        id,
        name: name || id,
        public: isPublic,
        file_size_limit,
        allowed_mime_types,
        avif_autodetection
      });

      console.log('✅ MSW: Bucket created:', { id, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket creation error:', error);
      return createErrorResponse(
        'bucket_creation_failed',
        (error as Error).message,
        500
      );
    }
  })),
  
  http.post('/:projectId/storage/v1/bucket', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { id, name, public: isPublic = false, file_size_limit, allowed_mime_types, avif_autodetection = false } = body;
      
      if (!id) {
        return createErrorResponse(
          'Bucket id is required',
          'Bucket id must be provided',
          400
        );
      }

      console.log('🪣 MSW: Creating bucket (project-scoped):', { id, name: name || id, public: isPublic, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      await initializeVFS(vfsBridge, projectInfo)

      const response = await vfsBridge.handleCreateBucketRequest({
        id,
        name: name || id,
        public: isPublic,
        file_size_limit,
        allowed_mime_types,
        avif_autodetection
      });

      console.log('✅ MSW: Bucket created (project-scoped):', { id, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket creation error:', error);
      return createErrorResponse(
        'bucket_creation_failed',
        (error as Error).message,
        500
      );
    }
  })),
  
  // List buckets
  http.get('/storage/v1/bucket', withProjectResolution(async ({ projectInfo }: any) => {
    try {
      console.log('📋 MSW: Listing buckets', { projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleListBucketsRequest();
      
      console.log('✅ MSW: Buckets listed', { status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: List buckets error:', error);
      return createErrorResponse('list_buckets_failed', (error as Error).message, 500);
    }
  })),
  
  http.get('/:projectId/storage/v1/bucket', withProjectResolution(async ({ projectInfo }: any) => {
    try {
      console.log('📋 MSW: Listing buckets (project-scoped)', { projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleListBucketsRequest();
      
      console.log('✅ MSW: Buckets listed (project-scoped)', { status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: List buckets error:', error);
      return createErrorResponse('list_buckets_failed', (error as Error).message, 500);
    }
  })),
  
  // Get bucket
  http.get('/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Getting bucket:', { bucketId, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleGetBucketRequest({ bucketId });
      
      console.log('✅ MSW: Bucket retrieved:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Get bucket error:', error);
      return createErrorResponse('get_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  http.get('/:projectId/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Getting bucket (project-scoped):', { bucketId, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleGetBucketRequest({ bucketId });
      
      console.log('✅ MSW: Bucket retrieved (project-scoped):', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Get bucket error:', error);
      return createErrorResponse('get_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  // Update bucket
  http.put('/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      const body = await safeJsonParse(request);
      
      console.log('🪣 MSW: Updating bucket:', { bucketId, body, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleUpdateBucketRequest({ bucketId, updates: body });
      
      console.log('✅ MSW: Bucket updated:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Update bucket error:', error);
      return createErrorResponse('update_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  http.put('/:projectId/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      const body = await safeJsonParse(request);
      
      console.log('🪣 MSW: Updating bucket (project-scoped):', { bucketId, body, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleUpdateBucketRequest({ bucketId, updates: body });
      
      console.log('✅ MSW: Bucket updated (project-scoped):', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Update bucket error:', error);
      return createErrorResponse('update_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  // Delete bucket
  http.delete('/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Deleting bucket:', { bucketId, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleDeleteBucketRequest({ bucketId });
      
      console.log('✅ MSW: Bucket deleted:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Delete bucket error:', error);
      return createErrorResponse('delete_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  http.delete('/:projectId/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Deleting bucket (project-scoped):', { bucketId, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleDeleteBucketRequest({ bucketId });
      
      console.log('✅ MSW: Bucket deleted (project-scoped):', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Delete bucket error:', error);
      return createErrorResponse('delete_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  // Empty bucket
  http.post('/storage/v1/bucket/:bucketId/empty', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🗑️ MSW: Emptying bucket:', { bucketId, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleEmptyBucketRequest({ bucketId });
      
      console.log('✅ MSW: Bucket emptied:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Empty bucket error:', error);
      return createErrorResponse('empty_bucket_failed', (error as Error).message, 500);
    }
  })),
  
  http.post('/:projectId/storage/v1/bucket/:bucketId/empty', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🗑️ MSW: Emptying bucket (project-scoped):', { bucketId, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleEmptyBucketRequest({ bucketId });
      
      console.log('✅ MSW: Bucket emptied (project-scoped):', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Empty bucket error:', error);
      return createErrorResponse('empty_bucket_failed', (error as Error).message, 500);
    }
  })),

  // Object operations
  
  // List objects
  http.get('/storage/v1/object/list/:bucket', withProjectResolution(createVFSListHandler())),
  http.get('/:projectId/storage/v1/object/list/:bucket', withProjectResolution(createVFSListHandler())),
  http.get('/storage/v1/object/list/:bucket/*', withProjectResolution(createVFSListHandler())),
  http.get('/:projectId/storage/v1/object/list/:bucket/*', withProjectResolution(createVFSListHandler())),

  // Signed URLs
  http.post('/storage/v1/object/sign/:bucket/*', withProjectResolution(createSignedUrlHandler())),
  http.post('/:projectId/storage/v1/object/sign/:bucket/*', withProjectResolution(createSignedUrlHandler())),
  http.post('/storage/v1/object/upload/sign/:bucket/*', withProjectResolution(createSignedUploadUrlHandler())),
  http.post('/:projectId/storage/v1/object/upload/sign/:bucket/*', withProjectResolution(createSignedUploadUrlHandler())),

  // Public URLs
  http.get('/storage/v1/object/public/:bucket/*', withProjectResolution(createPublicUrlHandler())),
  http.get('/:projectId/storage/v1/object/public/:bucket/*', withProjectResolution(createPublicUrlHandler())),

  // Authenticated file access
  http.get('/storage/v1/object/authenticated/:bucket/*', withProjectResolution(createAuthenticatedFileHandler())),
  http.get('/:projectId/storage/v1/object/authenticated/:bucket/*', withProjectResolution(createAuthenticatedFileHandler())),

  // File operations
  http.get('/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
  http.get('/:projectId/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileGetHandler())),

  http.post('/storage/v1/object/:bucket/*', withProjectResolution(createVFSFilePostHandler())),
  http.post('/:projectId/storage/v1/object/:bucket/*', withProjectResolution(createVFSFilePostHandler())),

  http.delete('/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileDeleteHandler())),
  http.delete('/:projectId/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileDeleteHandler())),

  // Move files
  http.post('/storage/v1/object/move', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { sourceKey, destinationKey, destinationBucket } = body;
      
      console.log('📦 MSW: Moving file:', { sourceKey, destinationKey, destinationBucket, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleMoveFileRequest({
        bucket: destinationBucket,
        sourceKey,
        destinationKey
      });
      
      console.log('✅ MSW: File moved:', { sourceKey, destinationKey, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Move file error:', error);
      return createErrorResponse('move_failed', (error as Error).message, 500);
    }
  })),
  
  http.post('/:projectId/storage/v1/object/move', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { sourceKey, destinationKey, destinationBucket } = body;
      
      console.log('📦 MSW: Moving file (project-scoped):', { sourceKey, destinationKey, destinationBucket, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleMoveFileRequest({
        bucket: destinationBucket,
        sourceKey,
        destinationKey
      });
      
      console.log('✅ MSW: File moved (project-scoped):', { sourceKey, destinationKey, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Move file error:', error);
      return createErrorResponse('move_failed', (error as Error).message, 500);
    }
  })),

  // Copy files
  http.post('/storage/v1/object/copy', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { sourceKey, destinationKey, destinationBucket } = body;
      
      console.log('📋 MSW: Copying file:', { sourceKey, destinationKey, destinationBucket, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleCopyFileRequest({
        bucket: destinationBucket,
        sourceKey,
        destinationKey
      });
      
      console.log('✅ MSW: File copied:', { sourceKey, destinationKey, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Copy file error:', error);
      return createErrorResponse('copy_failed', (error as Error).message, 500);
    }
  })),
  
  http.post('/:projectId/storage/v1/object/copy', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { sourceKey, destinationKey, destinationBucket } = body;
      
      console.log('📋 MSW: Copying file (project-scoped):', { sourceKey, destinationKey, destinationBucket, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleCopyFileRequest({
        bucket: destinationBucket,
        sourceKey,
        destinationKey
      });
      
      console.log('✅ MSW: File copied (project-scoped):', { sourceKey, destinationKey, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Copy file error:', error);
      return createErrorResponse('copy_failed', (error as Error).message, 500);
    }
  })),

  // Batch delete
  http.delete('/storage/v1/object/:bucket', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucket = params.bucket as string;
      const body = await safeJsonParse(request);
      const { prefixes } = body;
      
      console.log('🗑️ MSW: Batch delete:', { bucket, prefixes, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleBatchDeleteRequest({
        bucket,
        prefixes
      });
      
      console.log('✅ MSW: Batch delete completed:', { bucket, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Batch delete error:', error);
      return createErrorResponse('batch_delete_failed', (error as Error).message, 500);
    }
  })),
  
  http.delete('/:projectId/storage/v1/object/:bucket', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucket = params.bucket as string;
      const body = await safeJsonParse(request);
      const { prefixes } = body;
      
      console.log('🗑️ MSW: Batch delete (project-scoped):', { bucket, prefixes, projectId: projectInfo?.projectId });
      
      await initializeVFS(vfsBridge, projectInfo)
      
      const response = await vfsBridge.handleBatchDeleteRequest({
        bucket,
        prefixes
      });
      
      console.log('✅ MSW: Batch delete completed (project-scoped):', { bucket, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Batch delete error:', error);
      return createErrorResponse('batch_delete_failed', (error as Error).message, 500);
    }
  })),
]