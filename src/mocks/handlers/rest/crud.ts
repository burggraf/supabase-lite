import { HttpResponse } from 'msw'
import { RestBridge } from '../../bridges/rest-bridge'
import { createGetRoutes, createPostRoutes, createPatchRoutes, createDeleteRoutes, createHeadRoutes } from '../shared/route-factory'
import { handleError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const restBridge = new RestBridge()

/**
 * Handler for GET /rest/v1/:table
 * Handles SELECT queries with full PostgREST syntax support
 */
const createRestGetHandler = async ({ params, request }: any) => {
  try {
    const response = await restBridge.handleRestRequest({
      table: params.table as string,
      method: 'GET',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: addCorsHeaders(response.headers)
    })
  } catch (error: any) {
    console.error(`❌ MSW: GET error for ${params.table}:`, error)
    return handleError(error, `GET ${params.table}`, 'PGRST103')
  }
}

/**
 * Handler for HEAD /rest/v1/:table
 * Returns same headers as GET but without body
 */
const createRestHeadHandler = async ({ params, request }: any) => {
  try {
    const response = await restBridge.handleRestRequest({
      table: params.table as string,
      method: 'HEAD',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return new HttpResponse(null, {
      status: response.status,
      headers: addCorsHeaders(response.headers)
    })
  } catch (error: any) {
    console.error(`❌ MSW: HEAD error for ${params.table}:`, error)
    return handleError(error, `HEAD ${params.table}`, 'PGRST103')
  }
}

/**
 * Handler for POST /rest/v1/:table
 * Handles INSERT operations
 */
const createRestPostHandler = async ({ params, request }: any) => {
  try {
    const body = await request.json()
    const response = await restBridge.handleRestRequest({
      table: params.table as string,
      method: 'POST',
      body,
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: addCorsHeaders(response.headers)
    })
  } catch (error: any) {
    console.error(`❌ MSW: POST error for ${params.table}:`, error)
    return handleError(error, `POST ${params.table}`, 'PGRST110')
  }
}

/**
 * Handler for PATCH /rest/v1/:table
 * Handles UPDATE operations
 */
const createRestPatchHandler = async ({ params, request }: any) => {
  try {
    const body = await request.json()
    const response = await restBridge.handleRestRequest({
      table: params.table as string,
      method: 'PATCH',
      body,
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: addCorsHeaders(response.headers)
    })
  } catch (error: any) {
    console.error(`❌ MSW: PATCH error for ${params.table}:`, error)
    return handleError(error, `PATCH ${params.table}`, 'PGRST110')
  }
}

/**
 * Handler for DELETE /rest/v1/:table
 * Handles DELETE operations
 */
const createRestDeleteHandler = async ({ params, request }: any) => {
  try {
    const response = await restBridge.handleRestRequest({
      table: params.table as string,
      method: 'DELETE',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: addCorsHeaders(response.headers)
    })
  } catch (error: any) {
    console.error(`❌ MSW: DELETE error for ${params.table}:`, error)
    return handleError(error, `DELETE ${params.table}`, 'PGRST104')
  }
}

/**
 * Export all CRUD handlers for table operations
 */
export const crudHandlers = [
  ...createGetRoutes('/rest/v1/:table', createRestGetHandler),
  ...createHeadRoutes('/rest/v1/:table', createRestHeadHandler),
  ...createPostRoutes('/rest/v1/:table', createRestPostHandler),
  ...createPatchRoutes('/rest/v1/:table', createRestPatchHandler),
  ...createDeleteRoutes('/rest/v1/:table', createRestDeleteHandler)
]