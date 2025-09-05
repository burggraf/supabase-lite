import { HttpResponse } from 'msw'
import { VFSBridge } from '../../bridges/storage-bridge'
import { createGetRoutes, createPostRoutes, createPutRoutes, createDeleteRoutes } from '../shared/route-factory'
import { handleError, createStorageError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const vfsBridge = new VFSBridge()

/**
 * Handler for POST /storage/v1/bucket
 * Creates a new storage bucket
 */
const createBucketHandler = async ({ request, projectInfo }: any) => {
  try {
    const body = await request.json()
    console.log('🪣 MSW: Creating bucket:', { bucketInfo: body, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleCreateBucketRequest({
      ...body
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Create bucket error:', error)
    return createStorageError('BucketAlreadyExists', error.message || 'Bucket creation failed', 400)
  }
}

/**
 * Handler for GET /storage/v1/bucket
 * Lists all storage buckets
 */
const listBucketsHandler = async ({ projectInfo }: any) => {
  try {
    console.log('🪣 MSW: Listing buckets for project:', projectInfo?.projectId)

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleListBucketsRequest()

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: List buckets error:', error)
    return createStorageError('BucketNotFound', error.message || 'Failed to list buckets', 400)
  }
}

/**
 * Handler for GET /storage/v1/bucket/:bucketId
 * Gets information about a specific bucket
 */
const getBucketHandler = async ({ params, projectInfo }: any) => {
  try {
    const bucketId = params.bucketId as string
    console.log('🪣 MSW: Getting bucket info:', { bucketId, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleGetBucketRequest({
      bucketId
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Get bucket error:', error)
    return createStorageError('BucketNotFound', error.message || 'Bucket not found', 404)
  }
}

/**
 * Handler for PUT /storage/v1/bucket/:bucketId
 * Updates a storage bucket's settings
 */
const updateBucketHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const bucketId = params.bucketId as string
    const body = await request.json()
    console.log('🪣 MSW: Updating bucket:', { bucketId, updates: body, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleUpdateBucketRequest({
      bucketId,
      ...body
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Update bucket error:', error)
    return createStorageError('BucketNotFound', error.message || 'Bucket update failed', 400)
  }
}

/**
 * Handler for DELETE /storage/v1/bucket/:bucketId
 * Deletes a storage bucket
 */
const deleteBucketHandler = async ({ params, projectInfo }: any) => {
  try {
    const bucketId = params.bucketId as string
    console.log('🪣 MSW: Deleting bucket:', { bucketId, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleDeleteBucketRequest({
      bucketId
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Delete bucket error:', error)
    return createStorageError('BucketNotFound', error.message || 'Bucket deletion failed', 400)
  }
}

/**
 * Handler for POST /storage/v1/bucket/:bucketId/empty
 * Empties all files from a bucket
 */
const emptyBucketHandler = async ({ params, projectInfo }: any) => {
  try {
    const bucketId = params.bucketId as string
    console.log('🪣 MSW: Emptying bucket:', { bucketId, projectId: projectInfo?.projectId })

    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }

    const response = await vfsBridge.handleEmptyBucketRequest({
      bucketId
    })

    return HttpResponse.json(response, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Empty bucket error:', error)
    return createStorageError('BucketNotFound', error.message || 'Failed to empty bucket', 400)
  }
}

/**
 * Export bucket management handlers
 */
export const bucketHandlers = [
  ...createPostRoutes('/storage/v1/bucket', createBucketHandler),
  ...createGetRoutes('/storage/v1/bucket', listBucketsHandler),
  ...createGetRoutes('/storage/v1/bucket/:bucketId', getBucketHandler),
  ...createPutRoutes('/storage/v1/bucket/:bucketId', updateBucketHandler),
  ...createDeleteRoutes('/storage/v1/bucket/:bucketId', deleteBucketHandler),
  ...createPostRoutes('/storage/v1/bucket/:bucketId/empty', emptyBucketHandler)
]