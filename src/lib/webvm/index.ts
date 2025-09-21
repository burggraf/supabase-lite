import { WebVMManager } from './WebVMManager';
import { edgeFunctionsWebvmManager, EDGE_FUNCTIONS_VM_ROOT } from './edgeFunctions';

export const webvmManager = new WebVMManager();
export { edgeFunctionsWebvmManager, EDGE_FUNCTIONS_VM_ROOT };

export type { WebVMStaticAssetResponse } from './WebVMManager';
export { WebVMStaticAssetError } from './WebVMManager';
export { WebVMManager };
