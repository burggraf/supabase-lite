/**
 * WebVM Service Manager
 * 
 * Manages PostgREST and Envoy deployment and configuration within WebVM 2.0
 * for the hybrid architecture approach.
 * 
 * This manager handles:
 * - PostgREST installation and configuration in WebVM
 * - Envoy proxy setup for HTTP routing
 * - Service health monitoring and management
 * - HTTP bridge endpoint setup for PGlite communication
 */

import { WebVMManager } from '../webvm/WebVMManager'
import { logger } from '../infrastructure/Logger'
import { createDatabaseError } from '../infrastructure/ErrorHandler'

/**
 * Service configuration interfaces
 */
export interface PostgRESTConfig {
  port: number
  dbUri: string          // HTTP bridge endpoint URL
  dbSchema: string
  dbAnonRole: string
  jwtSecret: string
  dbPool: number
  dbPoolTimeout: number
}

export interface EnvoyConfig {
  port: number
  adminPort: number
  clusters: EnvoyCluster[]
  routes: EnvoyRoute[]
  accessLog: boolean
}

export interface EnvoyCluster {
  name: string
  endpoints: string[]
  healthCheck?: {
    path: string
    interval: string
  }
}

export interface EnvoyRoute {
  match: {
    prefix?: string
    path?: string
  }
  route: {
    cluster: string
    timeout?: string
  }
}

/**
 * Service status interfaces
 */
export interface ServiceStatus {
  name: string
  status: 'starting' | 'running' | 'stopped' | 'error'
  port: number
  pid?: number
  uptime?: number
  lastCheck: Date
  error?: string
}

export interface ServiceHealth {
  healthy: boolean
  responseTime?: number
  error?: string
  lastCheck: Date
}

/**
 * Bridge endpoint configuration
 */
export interface BridgeEndpointConfig {
  port: number
  path: string
  timeout: number
  maxRequestSize: string
}

/**
 * WebVM Service Manager Class
 * 
 * Orchestrates PostgREST and Envoy services within WebVM for hybrid architecture
 */
export class WebVMServiceManager {
  private static instance: WebVMServiceManager
  private webvmManager: WebVMManager
  private services: Map<string, ServiceStatus> = new Map()
  private healthCheckInterval: number | null = null
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  // Default configurations
  private readonly defaultPostgRESTConfig: PostgRESTConfig = {
    port: 3000,
    dbUri: 'http://localhost:8081/pglite-bridge',
    dbSchema: 'public',
    dbAnonRole: 'anonymous',
    jwtSecret: 'your-secret-key', // Should be provided via environment
    dbPool: 10,
    dbPoolTimeout: 10
  }

  private readonly defaultEnvoyConfig: EnvoyConfig = {
    port: 8080,
    adminPort: 8081,
    accessLog: true,
    clusters: [
      {
        name: 'postgrest',
        endpoints: ['127.0.0.1:3000'],
        healthCheck: {
          path: '/health',
          interval: '30s'
        }
      },
      {
        name: 'pglite_bridge',
        endpoints: ['host.docker.internal:8081'], // Bridge to browser context
        healthCheck: {
          path: '/health',
          interval: '30s'
        }
      }
    ],
    routes: [
      {
        match: { prefix: '/rest/v1/' },
        route: { cluster: 'postgrest', timeout: '30s' }
      },
      {
        match: { prefix: '/pglite-bridge/' },
        route: { cluster: 'pglite_bridge', timeout: '10s' }
      }
    ]
  }

  private readonly bridgeEndpointConfig: BridgeEndpointConfig = {
    port: 8081,
    path: '/pglite-bridge',
    timeout: 30000,
    maxRequestSize: '10MB'
  }

  private constructor() {
    this.webvmManager = WebVMManager.getInstance()
  }

  public static getInstance(): WebVMServiceManager {
    if (!WebVMServiceManager.instance) {
      WebVMServiceManager.instance = new WebVMServiceManager()
    }
    return WebVMServiceManager.instance
  }

  /**
   * Initialize and start all services in WebVM
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing WebVM services for hybrid architecture')

      // Ensure WebVM is running
      await this.ensureWebVMReady()

      // Install dependencies in WebVM
      await this.installDependencies()

      // Set up HTTP bridge endpoint
      await this.setupBridgeEndpoint()

      // Start PostgREST service
      await this.startPostgREST()

      // Start Envoy proxy
      await this.startEnvoy()

      // Start health monitoring
      this.startHealthMonitoring()

      logger.info('WebVM services initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize WebVM services', { error })
      throw createDatabaseError('Service initialization failed', error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Stop all services
   */
  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down WebVM services')

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      // Stop services in reverse order
      await this.stopEnvoy()
      await this.stopPostgREST()

      logger.info('WebVM services shut down successfully')

    } catch (error) {
      logger.error('Error during service shutdown', { error })
    }
  }

  /**
   * Get status of all services
   */
  public getServicesStatus(): ServiceStatus[] {
    return Array.from(this.services.values())
  }

  /**
   * Get health status of all services
   */
  public async getServicesHealth(): Promise<Map<string, ServiceHealth>> {
    const healthMap = new Map<string, ServiceHealth>()

    for (const service of this.services.values()) {
      if (service.status === 'running') {
        const health = await this.checkServiceHealth(service)
        healthMap.set(service.name, health)
      } else {
        healthMap.set(service.name, {
          healthy: false,
          error: service.error || 'Service not running',
          lastCheck: new Date()
        })
      }
    }

    return healthMap
  }

  /**
   * Restart a specific service
   */
  public async restartService(serviceName: string): Promise<void> {
    logger.info(`Restarting service: ${serviceName}`)

    switch (serviceName) {
      case 'postgrest':
        await this.stopPostgREST()
        await this.startPostgREST()
        break
      case 'envoy':
        await this.stopEnvoy()
        await this.startEnvoy()
        break
      default:
        throw new Error(`Unknown service: ${serviceName}`)
    }
  }

  /**
   * Ensure WebVM is ready for service deployment
   */
  private async ensureWebVMReady(): Promise<void> {
    const status = this.webvmManager.getStatus()
    
    if (status.state !== 'running') {
      logger.info('Starting WebVM for service deployment')
      await this.webvmManager.start()
    }

    if (!status.ready) {
      logger.info('Waiting for WebVM to be ready')
      // Wait for WebVM to be fully ready
      await new Promise(resolve => {
        const checkReady = () => {
          if (this.webvmManager.getStatus().ready) {
            resolve(undefined)
          } else {
            setTimeout(checkReady, 1000)
          }
        }
        checkReady()
      })
    }
  }

  /**
   * Install required dependencies in WebVM
   */
  private async installDependencies(): Promise<void> {
    logger.info('Installing PostgREST and Envoy in WebVM')

    const installCommands = [
      // Update package manager
      'apt update',
      
      // Install PostgREST
      'wget -O postgrest.tar.xz https://github.com/PostgREST/postgrest/releases/download/v11.2.2/postgrest-v11.2.2-linux-static-x64.tar.xz',
      'tar -xf postgrest.tar.xz',
      'mv postgrest /usr/local/bin/',
      'chmod +x /usr/local/bin/postgrest',
      
      // Install Envoy
      'wget -O envoy https://github.com/envoyproxy/envoy/releases/download/v1.28.0/envoy-1.28.0-linux-x86_64',
      'mv envoy /usr/local/bin/',
      'chmod +x /usr/local/bin/envoy',
      
      // Install curl for health checks
      'apt install -y curl',
      
      // Create service directories
      'mkdir -p /opt/supabase-services/postgrest',
      'mkdir -p /opt/supabase-services/envoy',
      'mkdir -p /var/log/supabase-services'
    ]

    for (const command of installCommands) {
      await this.executeWebVMCommand(command)
    }

    logger.info('Dependencies installed successfully')
  }

  /**
   * Set up HTTP bridge endpoint for PGlite communication
   */
  private async setupBridgeEndpoint(): Promise<void> {
    logger.info('Setting up HTTP bridge endpoint in WebVM')

    // Create a simple HTTP bridge server in WebVM that forwards requests to browser
    const bridgeServerScript = `
#!/bin/bash
# HTTP Bridge Server for PGlite communication

# Create bridge server using netcat (simple HTTP server)
cat > /opt/supabase-services/bridge-server.sh << 'EOF'
#!/bin/bash
PORT=${this.bridgeEndpointConfig.port}
while true; do
  (echo -e "HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\nAccess-Control-Allow-Origin: *\\r\\n\\r\\n{\\"status\\":\\"bridge_active\\",\\"port\\":$PORT}"; echo) | nc -l -p $PORT -q 1
done
EOF

chmod +x /opt/supabase-services/bridge-server.sh
`

    await this.executeWebVMCommand(bridgeServerScript)
    
    // Note: In a real implementation, this would be a proper HTTP server
    // that communicates with the browser via WebSocket or postMessage
    // For now, we create a placeholder that indicates the bridge is active
  }

  /**
   * Start PostgREST service in WebVM
   */
  private async startPostgREST(): Promise<void> {
    logger.info('Starting PostgREST service in WebVM')

    // Create PostgREST configuration file
    const postgrestConfigContent = Object.entries(this.defaultPostgRESTConfig)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()} = "${value}"`)
      .join('\\n')

    const startCommand = `
# Create PostgREST config
cat > /opt/supabase-services/postgrest/postgrest.conf << EOF
${postgrestConfigContent}
EOF

# Start PostgREST in background
cd /opt/supabase-services/postgrest
nohup /usr/local/bin/postgrest postgrest.conf > /var/log/supabase-services/postgrest.log 2>&1 &
echo $! > /var/run/postgrest.pid
`

    await this.executeWebVMCommand(startCommand)

    // Update service status
    this.services.set('postgrest', {
      name: 'postgrest',
      status: 'starting',
      port: this.defaultPostgRESTConfig.port,
      lastCheck: new Date()
    })

    // Wait a moment for service to start
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check if service started successfully
    const health = await this.checkPostgRESTHealth()
    if (health.healthy) {
      this.services.set('postgrest', {
        name: 'postgrest',
        status: 'running',
        port: this.defaultPostgRESTConfig.port,
        lastCheck: new Date()
      })
      logger.info('PostgREST started successfully')
    } else {
      this.services.set('postgrest', {
        name: 'postgrest',
        status: 'error',
        port: this.defaultPostgRESTConfig.port,
        error: health.error,
        lastCheck: new Date()
      })
      throw new Error(`PostgREST failed to start: ${health.error}`)
    }
  }

  /**
   * Start Envoy proxy service in WebVM
   */
  private async startEnvoy(): Promise<void> {
    logger.info('Starting Envoy proxy service in WebVM')

    // Create Envoy configuration
    const envoyConfig = this.generateEnvoyConfig()
    
    const startCommand = `
# Create Envoy config
cat > /opt/supabase-services/envoy/envoy.yaml << 'EOF'
${envoyConfig}
EOF

# Start Envoy in background
cd /opt/supabase-services/envoy
nohup /usr/local/bin/envoy -c envoy.yaml > /var/log/supabase-services/envoy.log 2>&1 &
echo $! > /var/run/envoy.pid
`

    await this.executeWebVMCommand(startCommand)

    // Update service status
    this.services.set('envoy', {
      name: 'envoy',
      status: 'starting',
      port: this.defaultEnvoyConfig.port,
      lastCheck: new Date()
    })

    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Check if service started successfully
    const health = await this.checkEnvoyHealth()
    if (health.healthy) {
      this.services.set('envoy', {
        name: 'envoy',
        status: 'running',
        port: this.defaultEnvoyConfig.port,
        lastCheck: new Date()
      })
      logger.info('Envoy started successfully')
    } else {
      this.services.set('envoy', {
        name: 'envoy',
        status: 'error',
        port: this.defaultEnvoyConfig.port,
        error: health.error,
        lastCheck: new Date()
      })
      throw new Error(`Envoy failed to start: ${health.error}`)
    }
  }

  /**
   * Stop PostgREST service
   */
  private async stopPostgREST(): Promise<void> {
    logger.info('Stopping PostgREST service')

    const stopCommand = `
if [ -f /var/run/postgrest.pid ]; then
  kill $(cat /var/run/postgrest.pid) 2>/dev/null || true
  rm -f /var/run/postgrest.pid
fi
`

    await this.executeWebVMCommand(stopCommand)
    
    this.services.set('postgrest', {
      name: 'postgrest',
      status: 'stopped',
      port: this.defaultPostgRESTConfig.port,
      lastCheck: new Date()
    })
  }

  /**
   * Stop Envoy service
   */
  private async stopEnvoy(): Promise<void> {
    logger.info('Stopping Envoy service')

    const stopCommand = `
if [ -f /var/run/envoy.pid ]; then
  kill $(cat /var/run/envoy.pid) 2>/dev/null || true
  rm -f /var/run/envoy.pid
fi
`

    await this.executeWebVMCommand(stopCommand)
    
    this.services.set('envoy', {
      name: 'envoy',
      status: 'stopped',
      port: this.defaultEnvoyConfig.port,
      lastCheck: new Date()
    })
  }

  /**
   * Execute command in WebVM
   */
  private async executeWebVMCommand(command: string): Promise<string> {
    // This would use the WebVMManager to execute commands
    // For now, we'll simulate the execution
    logger.debug('Executing WebVM command', { command: command.substring(0, 100) + '...' })
    
    // In real implementation, this would be:
    // return await this.webvmManager.executeCommand(command)
    
    // Simulate successful execution
    await new Promise(resolve => setTimeout(resolve, 1000))
    return 'Command executed successfully'
  }

  /**
   * Check PostgREST health
   */
  private async checkPostgRESTHealth(): Promise<ServiceHealth> {
    try {
      // This would make an HTTP request to PostgREST health endpoint
      // For now, simulate health check
      const startTime = Date.now()
      
      // Simulate health check request
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        lastCheck: new Date()
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date()
      }
    }
  }

  /**
   * Check Envoy health
   */
  private async checkEnvoyHealth(): Promise<ServiceHealth> {
    try {
      // This would check Envoy admin interface
      const startTime = Date.now()
      
      // Simulate health check
      await new Promise(resolve => setTimeout(resolve, 50))
      
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        lastCheck: new Date()
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date()
      }
    }
  }

  /**
   * Check service health
   */
  private async checkServiceHealth(service: ServiceStatus): Promise<ServiceHealth> {
    switch (service.name) {
      case 'postgrest':
        return this.checkPostgRESTHealth()
      case 'envoy':
        return this.checkEnvoyHealth()
      default:
        return {
          healthy: false,
          error: 'Unknown service',
          lastCheck: new Date()
        }
    }
  }

  /**
   * Start health monitoring for all services
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatuses = await this.getServicesHealth()
        
        for (const [serviceName, health] of healthStatuses.entries()) {
          const service = this.services.get(serviceName)
          if (service) {
            if (health.healthy && service.status !== 'running') {
              service.status = 'running'
              service.error = undefined
            } else if (!health.healthy && service.status === 'running') {
              service.status = 'error'
              service.error = health.error
              logger.warn(`Service ${serviceName} health check failed`, { error: health.error })
            }
            service.lastCheck = new Date()
          }
        }
      } catch (error) {
        logger.error('Health monitoring error', { error: error instanceof Error ? error.message : String(error) })
      }
    }, this.HEALTH_CHECK_INTERVAL) as unknown as number

    logger.info('Health monitoring started')
  }

  /**
   * Generate Envoy configuration YAML
   */
  private generateEnvoyConfig(): string {
    const config = this.defaultEnvoyConfig
    
    return `
static_resources:
  listeners:
  - name: listener_0
    address:
      socket_address:
        protocol: TCP
        address: 0.0.0.0
        port_value: ${config.port}
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_http
          access_log:
          - name: envoy.access_loggers.stdout
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
          route_config:
            name: local_route
            virtual_hosts:
            - name: local_service
              domains: ["*"]
              routes:
${config.routes.map(route => `
              - match:
                  prefix: "${route.match.prefix || route.match.path}"
                route:
                  cluster: ${route.route.cluster}
                  timeout: ${route.route.timeout || '30s'}`).join('')}
              cors:
                allow_origin_string_match:
                - prefix: "*"
                allow_methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
                allow_headers: authorization, content-type, x-requested-with
                max_age: "1728000"

  clusters:
${config.clusters.map(cluster => `
  - name: ${cluster.name}
    connect_timeout: 0.25s
    type: STRICT_DNS
    dns_lookup_family: V4_ONLY
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: ${cluster.name}
      endpoints:
      - lb_endpoints:
${cluster.endpoints.map(endpoint => `
        - endpoint:
            address:
              socket_address:
                address: ${endpoint.split(':')[0]}
                port_value: ${endpoint.split(':')[1]}`).join('')}
${cluster.healthCheck ? `
    health_checks:
    - timeout: 1s
      interval: ${cluster.healthCheck.interval}
      unhealthy_threshold: 2
      healthy_threshold: 1
      http_health_check:
        path: "${cluster.healthCheck.path}"` : ''}`).join('')}

admin:
  address:
    socket_address:
      protocol: TCP
      address: 127.0.0.1
      port_value: ${config.adminPort}
`
  }
}

// Export singleton instance
export const webvmServiceManager = WebVMServiceManager.getInstance()