import { HttpResponse } from 'msw'
import { VFSBridge } from '../../bridges/storage-bridge'
import { createGetRoutes, createPostRoutes } from '../shared/route-factory'
import { handleError, createStorageError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const vfsBridge = new VFSBridge()

/**
 * Handler for POST /storage/v1/object/sign/:bucket/*
 * Creates signed URLs for secure file access
 */
const createSignedUrlHandler = async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const { bucket } = params
    const path = params[0] || ''
    const body = await request.json()
    const { expiresIn = 3600 } = body

    console.log('🔗 MSW: Creating signed URL:', { bucket, path, expiresIn, projectId: projectInfo?.projectId })

    const response = await vfsBridge.handleCreateSignedUrlRequest({
      bucket,
      path,
      signedUrlOptions: { expiresIn },
      projectId: projectInfo?.projectId || 'default'
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Signed URL creation error:', error)
    return createStorageError('ObjectNotFound', error.message || 'Failed to create signed URL', 400)
  }
}

/**
 * Handler for POST /storage/v1/object/upload/sign/:bucket/*
 * Creates signed URLs for file uploads
 */
const createSignedUploadUrlHandler = async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const { bucket } = params
    const path = params[0] || ''
    const body = await request.json()
    const { expiresIn = 3600 } = body

    console.log('⬆️ MSW: Creating signed upload URL:', { bucket, path, expiresIn, projectId: projectInfo?.projectId })

    const response = await vfsBridge.handleCreateSignedUploadUrlRequest({
      bucket,
      path,
      signedUploadUrlOptions: { expiresIn },
      projectId: projectInfo?.projectId || 'default'
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Signed upload URL creation error:', error)
    return createStorageError('ObjectNotFound', error.message || 'Failed to create signed upload URL', 400)
  }
}

/**
 * Handler for GET /storage/v1/object/public/:bucket/*
 * Serves public files directly
 */
const createPublicUrlHandler = async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const { bucket } = params
    const path = params[0] || ''
    const rangeHeader = request.headers.get('range')

    console.log('🌐 MSW: Serving public file:', { bucket, path, range: rangeHeader, projectId: projectInfo?.projectId })

    const response = await vfsBridge.handlePublicUrlRequest({
      bucket,
      path
    })

    return response
  } catch (error: any) {
    console.error('❌ MSW: Public file serve error:', error)
    return createStorageError('ObjectNotFound', error.message || 'Public file not found', 404)
  }
}

/**
 * Handler for GET /storage/v1/object/authenticated/:bucket/*
 * Serves authenticated files (requires valid JWT)
 */
const createAuthenticatedFileHandler = async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const { bucket } = params
    const path = params[0] || ''
    const rangeHeader = request.headers.get('range')
    const authHeader = request.headers.get('authorization')

    console.log('🔐 MSW: Serving authenticated file:', { bucket, path, hasAuth: !!authHeader, range: rangeHeader, projectId: projectInfo?.projectId })

    // Extract JWT from Authorization header
    const token = authHeader?.replace('Bearer ', '')

    const response = await vfsBridge.handleAuthenticatedFileRequest({
      bucket,
      path,
      token: token || '',
      userContext: {}
    })

    return response
  } catch (error: any) {
    console.error('❌ MSW: Authenticated file serve error:', error)
    return createStorageError('Unauthorized', error.message || 'Authentication required', 401)
  }
}

/**
 * Export signed URL and public access handlers
 */
export const signedUrlHandlers = [
  // Signed URL creation
  ...createPostRoutes('/storage/v1/object/sign/:bucket/*', createSignedUrlHandler),
  ...createPostRoutes('/storage/v1/object/upload/sign/:bucket/*', createSignedUploadUrlHandler),
  
  // Public and authenticated file access
  ...createGetRoutes('/storage/v1/object/public/:bucket/*', createPublicUrlHandler),
  ...createGetRoutes('/storage/v1/object/authenticated/:bucket/*', createAuthenticatedFileHandler),
]