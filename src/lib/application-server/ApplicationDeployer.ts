import { WebVMBridge } from './WebVMBridge'
import { WebVMFileStore } from './persistence/WebVMFileStore'
import type { Application } from './types'

interface DeployOptions {
  onProgress?: (processed: number, total: number) => void
}

const APP_ROOT = '/opt/supabase/apps'

export class ApplicationDeployer {
  constructor(
    private readonly bridge = WebVMBridge.getInstance(),
    private readonly files = WebVMFileStore.getInstance(),
  ) {}

  async deployStaticApplication(app: Application, files: File[], options: DeployOptions = {}): Promise<void> {
    if (!files.length) {
      throw new Error('No files provided for deployment')
    }

    const root = this.getAppRoot(app.id)
    const publicPath = `${root}/public`

    // cleanup previous staged files in browser cache
    await this.files.deleteFiles(app.id)

    const ensureDir = async (targetPath: string) => {
      await this.files.writeFile(app.id, `${targetPath.replace(/\/+$/, '')}/`, new ArrayBuffer(0))
      if (this.bridge.isAvailable()) {
        await this.bridge.ensureDirectory(targetPath)
      }
    }

    await ensureDir(root)
    await ensureDir(publicPath)

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const relativePath = this.getRelativePath(file)
      const targetPath = `${publicPath}/${relativePath}`.replace(/\/+/g, '/').replace(/\/+$/, '')
      const parentDir = targetPath.includes('/') ? targetPath.slice(0, targetPath.lastIndexOf('/')) : publicPath
      await ensureDir(parentDir)

      const data = await file.arrayBuffer()
      await this.files.writeFile(app.id, targetPath, data)
      if (this.bridge.isAvailable()) {
        await this.bridge.writeFile(targetPath, data)
      }

      options.onProgress?.(index + 1, files.length)
    }
  }

  private getRelativePath(file: File): string {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    if (relative && relative.length > 0) {
      return relative.replace(/^\/+/, '')
    }
    return file.name
  }

  private getAppRoot(appId: string): string {
    return `${APP_ROOT}/${appId}`
  }
}
