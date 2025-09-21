import { WebVMManager, type WebVMConfiguration } from './WebVMManager';

const EDGE_FUNCTIONS_CONFIG: WebVMConfiguration = {
  diskImageUrl: '/webvm/v2/supabase-lite-edge-functions.ext2',
  diskImageType: 'bytes',
  cacheId: 'supabase-lite-edge-functions-cache',
  command: '/bin/sh',
  args: ['-c', 'exec /usr/local/bin/start-supabase-edge.sh'],
  environment: [
    'HOME=/home/user',
    'TERM=xterm-256color',
    'USER=user',
    'SHELL=/bin/bash',
    'PS1=edge-functions-webvm:\w$ ',
  ],
  workingDirectory: '/home/user/project',
  userId: 1000,
  groupId: 1000,
  introLines: [
    'Edge Functions WebVM ready. Use the terminal to run Supabase CLI commands.',
    'Functions live under /home/user/project/functions. Deployments copy files here.',
  ],
};

export const edgeFunctionsWebvmManager = new WebVMManager(EDGE_FUNCTIONS_CONFIG);

export const EDGE_FUNCTIONS_VM_ROOT = '/home/user/project/functions';
