/**
 * Service Worker lifecycle management for Supabase Lite
 * Handles registration, updates, and cleanup
 */

export class ServiceWorkerManager {
  private updateCallbacks: Array<() => void> = [];
  private registration: ServiceWorkerRegistration | null = null;

  /**
   * Check if Service Workers are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Register the service worker
   * @param isProduction - Whether we're in production environment
   * @param force - Force registration even in development
   */
  async register(isProduction: boolean, force: boolean = false): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Service Workers are not supported in this browser');
    }

    // Only register in production unless forced
    if (!isProduction && !force) {
      console.log('Service Worker registration skipped in development');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully');

      // Set up update detection
      this.setupUpdateDetection();
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Check if service worker is currently registered
   */
  async isRegistered(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    return registration !== null && registration !== undefined && registration.active !== null;
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('Service Worker unregistered successfully');
    } else {
      console.log('No Service Worker to unregister');
    }
  }

  /**
   * Register callback for when updates are available
   */
  onUpdateAvailable(callback: () => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Skip waiting and activate the new service worker
   */
  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Set up update detection for the service worker
   */
  private setupUpdateDetection(): void {
    if (!this.registration) {
      return;
    }

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      console.log('Service Worker update found');
      this.notifyUpdateCallbacks();
    });

    // Check for updates periodically
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, 60000); // Check every minute
  }

  /**
   * Notify all registered update callbacks
   */
  private notifyUpdateCallbacks(): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in update callback:', error);
      }
    });
  }
}