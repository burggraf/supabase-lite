import type { WebVMInstance } from './WebVMManager';

export const WEBVM_BASE64_CHUNK_SIZE = 4096;

export function escapeShellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function encodeStringToBase64(content: string): string {
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    let binary = '';

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    return btoa(binary);
  }

  type BufferLike = {
    from(input: string, encoding: string): { toString(encoding: string): string };
  };

  const bufferConstructor = (globalThis as unknown as { Buffer?: BufferLike }).Buffer;
  if (bufferConstructor) {
    return bufferConstructor.from(content, 'utf-8').toString('base64');
  }

  throw new Error('Unable to encode string to base64 in this environment.');
}

export async function writeBase64FileToWebVM(
  instance: WebVMInstance,
  targetPath: string,
  base64Content: string
): Promise<void> {
  const sanitizedTarget = escapeShellArg(targetPath);
  const tempPath = `${targetPath}.b64.tmp`;
  const escapedTemp = escapeShellArg(tempPath);

  await instance.runShellCommand(`rm -f ${escapedTemp} ${sanitizedTarget}`);

  if (!base64Content) {
    await instance.runShellCommand(`: > ${sanitizedTarget}`);
    return;
  }

  for (let offset = 0; offset < base64Content.length; offset += WEBVM_BASE64_CHUNK_SIZE) {
    const chunk = base64Content.slice(offset, offset + WEBVM_BASE64_CHUNK_SIZE);
    const escapedChunk = chunk.replace(/'/g, "'\\''");
    await instance.runShellCommand(`printf '%s' '${escapedChunk}' >> ${escapedTemp}`);
  }

  await instance.runShellCommand(`base64 -d ${escapedTemp} > ${sanitizedTarget} && rm -f ${escapedTemp}`);
}
