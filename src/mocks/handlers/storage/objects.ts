import { HttpResponse } from 'msw'
import { VFSBridge } from '../../bridges/storage-bridge'
import { createGetRoutes, createPostRoutes, createDeleteRoutes } from '../shared/route-factory'
import { handleError, createStorageError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const vfsBridge = new VFSBridge()

/**
 * Handler for GET /storage/v1/object/list/:bucket
 * Lists files in a bucket with optional filtering
 */
const createVFSListHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string
    const url = new URL(request.url)
    const prefix = url.searchParams.get('prefix') || ''
    const limit = parseInt(url.searchParams.get('limit') || '100', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    
    console.log('📁 MSW: VFS list request', { bucket, prefix, limit, offset, projectId: projectInfo?.projectId })
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }
    
    const files = await vfsBridge.handleListRequest({
      bucket,
      prefix,
      limit,
      offset
    })
    
    return HttpResponse.json(files, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: VFS list error:', error)
    return createStorageError('BucketNotFound', error.message || 'Failed to list files', 400)
  }
}

/**
 * Handler for GET /storage/v1/object/:bucket/*
 * Downloads/retrieves file content
 */
const createVFSFileGetHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string
    const path = params[0] as string // Catch-all path parameter
    const rangeHeader = request.headers.get('range')
    
    // Parse URL to check for token parameter (for signed URLs)
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    
    console.log('📁 MSW: VFS file GET request', { bucket, path, token: !!token, range: rangeHeader, projectId: projectInfo?.projectId })
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }
    
    let response
    if (token) {
      // Handle signed URL access
      response = await vfsBridge.handleAuthenticatedFileRequest({
        bucket,
        path,
        token,
        userContext: {}
      })
    } else {
      // Handle regular file access
      response = await vfsBridge.handleFileRequest({
        bucket,
        path,
        userContext: {} // TODO: Extract from auth headers
      })
    }
    
    return response
  } catch (error: any) {
    console.error('❌ MSW: VFS file GET error:', error)
    return createStorageError('ObjectNotFound', error.message || 'File not found', 404)
  }
}

/**
 * Handler for POST /storage/v1/object/:bucket/*
 * Uploads a new file or updates existing file
 */
const createVFSFilePostHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string
    const path = params[0] as string
    const formData = await request.formData()
    
    console.log('📁 MSW: VFS file POST request', { bucket, path, projectId: projectInfo?.projectId })
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }
    
    const response = await vfsBridge.handleUploadRequest({
      bucket,
      path,
      formData
    })
    
    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: VFS file POST error:', error)
    return createStorageError('InvalidFileType', error.message || 'File upload failed', 400)
  }
}

/**
 * Handler for DELETE /storage/v1/object/:bucket/*
 * Deletes a file or multiple files
 */
const createVFSFileDeleteHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string
    const path = params[0] as string
    
    console.log('📁 MSW: VFS file DELETE request', { bucket, path, projectId: projectInfo?.projectId })
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }
    
    const response = await vfsBridge.handleDeleteRequest({
      bucket,
      path
    })
    
    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: VFS file DELETE error:', error)
    return createStorageError('ObjectNotFound', error.message || 'File deletion failed', 404)
  }
}

/**
 * Handler for POST /storage/v1/object/move
 * Moves/renames files within storage
 */
const createFileMoveHandler = async ({ request, projectInfo }: any) => {
  try {
    const body = await request.json()
    const { bucketId, sourceKey, destinationKey } = body
    
    console.log('📂 MSW: Moving file:', { bucketId, sourceKey, destinationKey, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleMoveFileRequest({
      bucket: bucketId,
      sourceKey,
      destinationKey
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: File move error:', error)
    return createStorageError('ObjectNotFound', error.message || 'File move failed', 400)
  }
}

/**
 * Handler for POST /storage/v1/object/copy
 * Copies files within storage
 */
const createFileCopyHandler = async ({ request, projectInfo }: any) => {
  try {
    const body = await request.json()
    const { bucketId, sourceKey, destinationKey } = body
    
    console.log('📂 MSW: Copying file:', { bucketId, sourceKey, destinationKey, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleCopyFileRequest({
      bucket: bucketId,
      sourceKey,
      destinationKey
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: File copy error:', error)
    return createStorageError('ObjectNotFound', error.message || 'File copy failed', 400)
  }
}

/**
 * Handler for DELETE /storage/v1/object/:bucket (batch delete)
 * Deletes multiple files at once
 */
const createBatchDeleteHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string
    const body = await request.json()
    const { prefixes } = body
    
    console.log('📂 MSW: Batch delete:', { bucket, prefixes, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleBatchDeleteRequest({
      bucket,
      prefixes
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Batch delete error:', error)
    return createStorageError('BucketNotFound', error.message || 'Batch delete failed', 400)
  }
}

/**
 * Export object/file operation handlers
 */
export const objectHandlers = [
  // File listing
  ...createGetRoutes('/storage/v1/object/list/:bucket', createVFSListHandler),
  ...createGetRoutes('/storage/v1/object/list/:bucket/*', createVFSListHandler),
  
  // File operations
  ...createGetRoutes('/storage/v1/object/:bucket/*', createVFSFileGetHandler),
  ...createPostRoutes('/storage/v1/object/:bucket/*', createVFSFilePostHandler),
  ...createDeleteRoutes('/storage/v1/object/:bucket/*', createVFSFileDeleteHandler),
  
  // Advanced operations
  ...createPostRoutes('/storage/v1/object/move', createFileMoveHandler),
  ...createPostRoutes('/storage/v1/object/copy', createFileCopyHandler),
  ...createDeleteRoutes('/storage/v1/object/:bucket', createBatchDeleteHandler),
]