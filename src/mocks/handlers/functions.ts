import { http, HttpResponse } from 'msw'
import { logger } from '../../lib/infrastructure/Logger'
import { edgeFunctionsWebvmManager, EDGE_FUNCTIONS_VM_ROOT } from '../../lib/webvm'
import { writeBase64FileToWebVM, encodeStringToBase64, escapeShellArg } from '@/lib/webvm/fileTransfer'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createErrorResponse
} from './shared/common-handlers'

const EDGE_RUNNER_PATH = '/home/user/.supabase-lite/edge-runtime/runner.ts';
const EDGE_RUNTIME_ROOT = '/home/user/.supabase-lite/edge-runtime';

async function ensureEdgeRuntimeReady() {
  if (typeof window === 'undefined' || !window.crossOriginIsolated) {
    throw new Error('Edge runtime requires cross-origin isolation.');
  }

  const instance = await edgeFunctionsWebvmManager.ensureStarted();
  try {
    // Create runtime directory and runner script if missing
    const runtimeDir = escapeShellArg(EDGE_RUNTIME_ROOT);
    await instance.runShellCommand(`mkdir -p ${runtimeDir}`);

    // Check if runner exists
    const runnerCheck = await instance.runShellCommand(`[ -f ${escapeShellArg(EDGE_RUNNER_PATH)} ]`);
    if (runnerCheck.status !== 0) {
      const runnerSource = getRunnerSource();
      await writeBase64FileToWebVM(
        instance,
        EDGE_RUNNER_PATH,
        encodeStringToBase64(runnerSource)
      );
      await instance.runShellCommand(`chmod +x ${escapeShellArg(EDGE_RUNNER_PATH)}`);
    }

    return instance;
  } catch (error) {
    logger.error('Failed to prepare Edge Functions runtime', error as Error);
    throw error;
  }
}

function getRunnerSource(): string {
  return `// Supabase Lite Edge Function runner
const [modulePath, requestPath, responsePath] = Deno.args;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const requestData = JSON.parse(await Deno.readTextFile(requestPath));

const requestHeaders = new Headers(requestData.headers || {});
let requestBody: Uint8Array | undefined = undefined;
if (requestData.bodyBase64) {
  const binaryString = atob(requestData.bodyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  requestBody = bytes;
}

const request = new Request(requestData.url, {
  method: requestData.method,
  headers: requestHeaders,
  body: requestBody,
});

let capturedHandler: ((req: Request) => Promise<Response> | Response) | null = null;

function capture(handler: (req: Request) => Promise<Response> | Response) {
  capturedHandler = handler;
}

const originalDenoServe = Deno.serve;
(Deno as any).serve = function (optionsOrHandler: unknown, maybeHandler?: unknown) {
  if (typeof optionsOrHandler === 'function') {
    capture(optionsOrHandler as (req: Request) => Promise<Response> | Response);
  } else if (typeof maybeHandler === 'function') {
    capture(maybeHandler as (req: Request) => Promise<Response> | Response);
  } else {
    throw new Error('Unsupported usage of Deno.serve in Supabase Lite runner');
  }
  return {
    addr: { hostname: '127.0.0.1', port: 0 },
    finished: Promise.resolve(),
    shutdown: async () => {},
    [Symbol.asyncIterator]: async function* asyncIterator() {},
  };
};

(globalThis as any).serve = function (handlerOrOptions: unknown, maybeHandler?: unknown) {
  if (typeof handlerOrOptions === 'function') {
    capture(handlerOrOptions as (req: Request) => Promise<Response> | Response);
  } else if (typeof maybeHandler === 'function') {
    capture(maybeHandler as (req: Request) => Promise<Response> | Response);
  } else {
    throw new Error('Unsupported usage of serve() in Supabase Lite runner');
  }
};

await import(modulePath + '?v=' + Date.now());

if (!capturedHandler) {
  throw new Error('Edge function did not register a handler via serve or Deno.serve');
}

const response = await capturedHandler(request);
const bodyBuffer = new Uint8Array(await response.arrayBuffer());
let bodyBase64: string | null = null;
if (bodyBuffer.length > 0) {
  let binary = '';
  for (let i = 0; i < bodyBuffer.length; i++) {
    binary += String.fromCharCode(bodyBuffer[i]);
  }
  bodyBase64 = btoa(binary);
}

const headers: Record<string, string> = {};
for (const [key, value] of response.headers.entries()) {
  headers[key] = value;
}

const payload = {
  status: response.status,
  headers,
  bodyBase64,
};

await Deno.writeTextFile(responsePath, JSON.stringify(payload));

if (typeof originalDenoServe === 'function') {
  (Deno as any).serve = originalDenoServe;
}
`;}

async function executeEdgeFunctionInWebVM(functionName: string, request: Request, rawBody: string | null) {
  const instance = await ensureEdgeRuntimeReady();

  const functionPath = `${EDGE_FUNCTIONS_VM_ROOT}/${functionName}/index.ts`;
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const requestPath = `/tmp/edge-request-${tempId}.json`;
  const responsePath = `/tmp/edge-response-${tempId}.json`;

  const requestPayload = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    bodyBase64: rawBody ? encodeStringToBase64(rawBody) : null,
  };

  await writeBase64FileToWebVM(
    instance,
    requestPath,
    encodeStringToBase64(JSON.stringify(requestPayload))
  );

  const command = [
    'deno run',
    '--allow-read',
    '--allow-write',
    '--allow-env',
    escapeShellArg(EDGE_RUNNER_PATH),
    escapeShellArg(functionPath),
    escapeShellArg(requestPath),
    escapeShellArg(responsePath),
  ].join(' ');

  const result = await instance.runShellCommand(command);

  if (result.status !== 0) {
    await instance.runShellCommand(`rm -f ${escapeShellArg(requestPath)} ${escapeShellArg(responsePath)}`);
    throw new Error(`Edge function runtime exited with status ${result.status}`);
  }

  const responseBlob = await instance.readFileAsBlob(responsePath);
  const responseText = await responseBlob.text();

  await instance.runShellCommand(`rm -f ${escapeShellArg(requestPath)} ${escapeShellArg(responsePath)}`);

  return JSON.parse(responseText) as {
    status: number;
    headers: Record<string, string>;
    bodyBase64: string | null;
  };
}

function decodeBase64ToUint8Array(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binaryString = atob(value);
    const bytes = new Uint8Array(binaryString.length);
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }
    return bytes;
  }

  const bufferConstructor = (globalThis as unknown as {
    Buffer?: {
      from(input: string, encoding: string): { buffer: ArrayBufferLike; byteOffset: number; byteLength: number };
    };
  }).Buffer;

  if (bufferConstructor) {
    const buffer = bufferConstructor.from(value, 'base64');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return new Uint8Array(arrayBuffer);
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

/**
 * Common Edge Function execution handler
 */
const createEdgeFunctionHandler = () => async ({ params, request }: any) => {
  try {
    const functionName = params.functionName as string;
    
    // Extract headers for authentication (Supabase.js compatibility)
    const apikey = request.headers.get('apikey');
    const authorization = request.headers.get('authorization');
    
    logger.info('Edge function invoked', { 
      functionName,
      hasApikey: !!apikey,
      hasAuth: !!authorization,
      method: request.method
    });

    // Ensure the function has been deployed to the WebVM runtime
    const instance = await ensureEdgeRuntimeReady();

    const functionPathCheck = await instance.runShellCommand(
      `[ -f ${escapeShellArg(`${EDGE_FUNCTIONS_VM_ROOT}/${functionName}/index.ts`)} ]`
    );

    if (functionPathCheck.status !== 0) {
      return createErrorResponse(
        'Function not found',
        `Function '${functionName}' not found in WebVM runtime. Deploy the function before invoking it.`,
        404
      );
    }

    // Get request body
    let rawBody: string | null = null;
    const requestClone = request.clone();
    if (requestClone.method !== 'GET' && requestClone.method !== 'HEAD') {
      rawBody = await requestClone.text();
    }

    const executionResult = await executeEdgeFunctionInWebVM(functionName, request, rawBody);

    logger.info('Edge function executed', { 
      functionName,
      status: executionResult.status,
    });

    const headers = {
      ...executionResult.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
      'X-Function-Name': functionName,
    } as Record<string, string>;

    const bodyBase64 = executionResult.bodyBase64;
    let responseBody: BodyInit | undefined;
    if (bodyBase64) {
      const bytes = decodeBase64ToUint8Array(bodyBase64);
      const contentType = headers['Content-Type']?.toLowerCase() ?? '';
      if (contentType.includes('json') || contentType.startsWith('text/')) {
        responseBody = new TextDecoder().decode(bytes);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = contentType || 'text/plain; charset=utf-8';
        }
      } else {
        responseBody = bytes;
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/octet-stream';
        }
      }
    }

    return new HttpResponse(responseBody, {
      status: executionResult.status,
      headers,
    });
  } catch (error) {
    logger.error('Edge function execution failed', error as Error);
    return createErrorResponse(
      'Function execution failed',
      (error as Error).message,
      500
    );
  }
}

// Edge Functions handlers
export const functionsHandlers = [
  // Non-project-scoped Edge Functions handlers
  http.all('/functions/:functionName', withProjectResolution(createEdgeFunctionHandler())),
  
  // Project-scoped Edge Functions handlers
  http.all('/:projectId/functions/:functionName', withProjectResolution(createEdgeFunctionHandler())),

  // Legacy /functions/v1/ prefix support (Supabase.js compatibility)
  http.all('/functions/v1/:functionName', withProjectResolution(createEdgeFunctionHandler())),
]
