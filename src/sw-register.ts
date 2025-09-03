/**
 * Service Worker registration utility for Supabase Lite
 * Handles registration, updates, and lifecycle management
 */

import { ServiceWorkerManager } from './lib/offline/ServiceWorkerManager';
import { EnvironmentDetector } from './lib/offline/EnvironmentDetector';

let swManager: ServiceWorkerManager | null = null;

/**
 * Register the Service Worker with environment awareness
 * @param forceRegister - Force registration even in development
 * @returns Promise that resolves when registration is complete
 */
export async function registerServiceWorker(forceRegister: boolean = false): Promise<void> {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.log('Service Workers are not supported in this browser');
    return;
  }

  const envDetector = new EnvironmentDetector();
  const shouldRegister = envDetector.shouldAutoRegisterServiceWorker() || forceRegister;

  if (!shouldRegister) {
    console.log('Service Worker registration skipped in development environment');
    return;
  }

  try {
    // Create manager instance
    swManager = new ServiceWorkerManager();

    // Set up update notification
    swManager.onUpdateAvailable(() => {
      console.log('Service Worker update available');
      
      // You could show a toast notification here
      const event = new CustomEvent('sw-update-available', {
        detail: { 
          skipWaiting: () => swManager?.skipWaiting(),
          message: 'A new version is available. Refresh to update.'
        }
      });
      window.dispatchEvent(event);
    });

    // Register the service worker
    await swManager.register(envDetector.isProduction(), forceRegister);
    
    console.log('✅ Service Worker registered successfully');

  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
  }
}

/**
 * Unregister the Service Worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (swManager) {
    await swManager.unregister();
    swManager = null;
    console.log('Service Worker unregistered');
  }
}

/**
 * Check if Service Worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (swManager) {
    return await swManager.isRegistered();
  }
  return false;
}

/**
 * Get the current Service Worker manager instance
 */
export function getServiceWorkerManager(): ServiceWorkerManager | null {
  return swManager;
}