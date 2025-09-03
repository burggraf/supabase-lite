import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { projectManager } from '@/lib/projects/ProjectManager'
import { vfsManager } from '@/lib/vfs/VFSManager'
import { CheckCircle, Download, ExternalLink, Globe, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface SampleApp {
	id: string
	name: string
	title: string
	description: string
	tags: string[]
	path: string
	sourceUrl?: string
}

const SAMPLE_APPS: SampleApp[] = [
	{
		id: 'test-app',
		name: 'test-app',
		title: 'API Tester: React + Vite Test App',
		description:
			'This app is used to test supabase API integrations.  NOTE: This app requires that you insall seed data for: Northwind Database.',
		tags: ['React', 'TypeScript', 'Vite', 'API'],
		path: '/apps/test-app',
		sourceUrl: 'https://github.com/burggraf/supabase-lite/tree/main/test-app',
	},
	{
		id: 'northwind-app',
		name: 'northwind-app',
		title: 'Northwind Business',
		description: 'Northwind Business Application',
		tags: ['Business', 'Demo'],
		path: '/apps/northwind-app',
		sourceUrl: 'https://github.com/burggraf/supabase-lite/tree/main/northwind-app',
	},
]

interface SampleAppInstallerProps {
	onAppInstalled?: () => void
}

export function SampleAppInstaller({ onAppInstalled }: SampleAppInstallerProps) {
	const [selectedApp, setSelectedApp] = useState<SampleApp | null>(null)
	const [appName, setAppName] = useState('')
	const [isInstalling, setIsInstalling] = useState(false)
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	const handleInstallApp = async (sampleApp: SampleApp) => {
		setSelectedApp(sampleApp)
		setAppName(sampleApp.name)
		setIsDialogOpen(true)
	}

	const validateAppName = (name: string): boolean => {
		return /^[a-z0-9-]+$/.test(name) && name.length >= 2 && name.length <= 50
	}

	const handleConfirmInstall = async () => {
		if (!selectedApp || !appName.trim()) {
			toast.error('Please enter an app name')
			return
		}

		if (!validateAppName(appName)) {
			toast.error('App name must contain only lowercase letters, numbers, and hyphens')
			return
		}

		setIsInstalling(true)

		try {
			// Get current project
			const activeProject = projectManager.getActiveProject()
			if (!activeProject) {
				toast.error('No active project found')
				return
			}

			// Ensure VFS is initialized
			await vfsManager.initialize(activeProject.id)

			// Fetch files from public/apps/{app-id} and copy to app/{appName}
			await copyPublicAppToVFS(selectedApp.id, appName)

			toast.success(`Sample app "${appName}" installed successfully!`)
			onAppInstalled?.()
			setIsDialogOpen(false)
			setSelectedApp(null)
			setAppName('')
		} catch (error) {
			console.error('Failed to install sample app:', error)
			toast.error(
				`Failed to install sample app: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		} finally {
			setIsInstalling(false)
		}
	}

	const copyPublicAppToVFS = async (appId: string, targetAppName: string) => {
		// Dynamically discover all files in the source app directory
		const sourceBasePath = `/apps/${appId}`

		// Get the list of all files by parsing index.html and checking for assets
		const filesToCopy = await discoverFilesInPublicApp(sourceBasePath)

		for (const file of filesToCopy) {
			try {
				// Fetch file from public folder
				const response = await fetch(file.src)
				if (!response.ok) {
					console.warn(`Could not fetch ${file.src}: ${response.statusText}`)
					continue // Skip this file instead of failing the whole installation
				}

				// Get the content-type header or infer from filename
				const contentType =
					response.headers.get('content-type') || getMimeTypeFromFilename(file.src)

				// Debug JavaScript files specifically
				const isJsFile = file.src.endsWith('.js') || file.src.endsWith('.mjs')
				if (isJsFile) {
					console.log(`🐛 JS FILE DEBUG for ${file.src}:`, {
						serverContentType: response.headers.get('content-type'),
						fallbackContentType: getMimeTypeFromFilename(file.src),
						finalContentType: contentType,
					})
				}

				// Determine if file is text or binary based on MIME type
				const isTextFile = isTextMimeType(contentType)

				if (isJsFile) {
					console.log(`🐛 JS FILE isTextFile check:`, { contentType, isTextFile })
				}

				let content: string
				let encoding: 'utf-8' | 'base64' = 'utf-8'

				if (isTextFile) {
					// For text files, get as text
					content = await response.text()
					if (isJsFile) {
						console.log(`🐛 JS FILE content preview:`, content.substring(0, 200) + '...')
					}
				} else {
					// For binary files, get as base64
					const blob = await response.blob()
					const arrayBuffer = await blob.arrayBuffer()
					const bytes = new Uint8Array(arrayBuffer)
					content = btoa(String.fromCharCode(...bytes))
					encoding = 'base64'
				}

				// Convert source path to destination path
				const destPath = file.src.replace(sourceBasePath, `app/${targetAppName}`)

				// CRITICAL: For HTML files, rewrite asset paths BEFORE storing in VFS
				if (contentType.includes('text/html') && content) {
					console.log('🔧 SAMPLE INSTALLER: Processing HTML asset paths before storing in VFS')
					console.log('🔧 Original HTML preview:', content.substring(0, 300))

					// Check if HTML is already configured for subdirectory deployment
					const targetBasePath = `/app/${targetAppName}/`
					const hasCorrectBaseTag = content.includes(`<base href="${targetBasePath}"`)
					const hasSubdirectoryPaths = content.includes(targetBasePath + 'assets/')
					
					console.log('🔧 SAMPLE INSTALLER: HTML configuration check:', {
						targetBasePath,
						hasCorrectBaseTag,
						hasSubdirectoryPaths,
						needsRewriting: !(hasCorrectBaseTag && hasSubdirectoryPaths)
					})

					let htmlContent = content

					if (hasCorrectBaseTag && hasSubdirectoryPaths) {
						// HTML is already correctly configured for subdirectory deployment
						console.log('🔧 SAMPLE INSTALLER: HTML already configured for subdirectory deployment, skipping rewriting')
					} else {
						// HTML needs path rewriting for subdirectory deployment
						console.log('🔧 SAMPLE INSTALLER: Rewriting HTML asset paths for subdirectory deployment')

						// Add base tag if not present
						const baseTag = `<base href="${targetBasePath}">`
						if (!htmlContent.includes('<base')) {
							htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`)
							console.log('🔧 SAMPLE INSTALLER: Added base tag')
						}

						// Convert absolute paths to relative
						const originalContent = htmlContent
						htmlContent = htmlContent
							.replace(/href="\/assets\//g, `href="assets/`)
							.replace(/src="\/assets\//g, `src="assets/`)
							.replace(
								/href="\/([^"\/]*\.(css|js|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf))"/g,
								`href="$1"`
							)
							.replace(/src="\/([^"\/]*\.(js|svg|png|jpg|jpeg|gif|webp|ico))"/g, `src="$1"`)

						console.log('🔧 SAMPLE INSTALLER: HTML rewrite result:', {
							changed: originalContent !== htmlContent,
							originalLength: originalContent.length,
							newLength: htmlContent.length,
							preview: htmlContent.substring(0, 400),
						})
					}

					content = htmlContent // Use processed HTML
				}

				// Store in VFS using createFile
				await vfsManager.createFile(destPath, {
					content,
					mimeType: contentType,
					encoding,
					createDirectories: true,
				})

				console.log(`Copied ${file.src} → ${destPath}`)
			} catch (error) {
				console.error(`Failed to copy ${file.src}:`, error)
				throw new Error(`Failed to copy ${file.src}: ${error}`)
			}
		}
	}

	// Helper function to discover all files in a public app directory
	const discoverFilesInPublicApp = async (basePath: string): Promise<{ src: string }[]> => {
		const files: { src: string }[] = []

		// Always try to get index.html first
		try {
			const indexResponse = await fetch(`${basePath}/index.html`, { method: 'HEAD' })
			if (indexResponse.ok) {
				files.push({ src: `${basePath}/index.html` })
			}
		} catch {
			// Index.html not found, skip
		}

		// Try common root files (only include vite.svg since that's what actually exists)
		const commonRootFiles = ['vite.svg']
		for (const fileName of commonRootFiles) {
			try {
				const response = await fetch(`${basePath}/${fileName}`, { method: 'HEAD' })
				if (response.ok) {
					files.push({ src: `${basePath}/${fileName}` })
				}
			} catch {
				// File doesn't exist, skip
			}
		}

		// Parse index.html to discover asset references
		try {
			const indexResponse = await fetch(`${basePath}/index.html`)
			if (indexResponse.ok) {
				const indexContent = await indexResponse.text()
				console.log(`📄 index.html content:`, indexContent.substring(0, 500) + '...')

				// Extract all asset references from HTML (href, src attributes)
				const assetRegex = /(?:href|src)=["']([^"']+)["']/g
				const matches = [...indexContent.matchAll(assetRegex)]
				console.log(
					`🔍 Found ${matches.length} asset matches:`,
					matches.map((m) => m[1])
				)

				for (const match of matches) {
					let assetPath = match[1]
					console.log(`🔄 Processing asset path: ${assetPath}`)

					// Skip external URLs
					if (
						assetPath.startsWith('http://') ||
						assetPath.startsWith('https://') ||
						assetPath.startsWith('//')
					) {
						console.log(`⏭️ Skipping external URL: ${assetPath}`)
						continue
					}

					// Convert relative paths to absolute from the app root
					if (assetPath.startsWith('./')) {
						assetPath = assetPath.substring(2) // Remove './'
						console.log(`🔄 Converted relative path to: ${assetPath}`)
					}

					if (!assetPath.startsWith('/')) {
						assetPath = '/' + assetPath
						console.log(`🔄 Added leading slash: ${assetPath}`)
					}

					// Full path for fetching
					const fullPath = basePath + assetPath
					console.log(`🎯 Full asset path: ${fullPath}`)

					// Check if this asset actually exists
					try {
						const assetResponse = await fetch(fullPath, { method: 'HEAD' })
						console.log(`🔍 Asset check for ${fullPath}:`, {
							ok: assetResponse.ok,
							status: assetResponse.status,
						})
						if (assetResponse.ok) {
							files.push({ src: fullPath })
							console.log(`✅ Added asset ${fullPath} to file list`)
						}
					} catch (error) {
						console.warn(`❌ Asset not found: ${fullPath}`, error)
					}
				}
			}
		} catch (error) {
			console.warn('Could not parse index.html for assets:', error)
		}

		// Remove duplicates
		const uniqueFiles = files.filter(
			(file, index, self) => self.findIndex((f) => f.src === file.src) === index
		)

		console.log(
			`🎯 Final unique file list (${uniqueFiles.length} files):`,
			uniqueFiles.map((f) => f.src)
		)
		return uniqueFiles
	}

	// Helper function to determine MIME type from filename
	const getMimeTypeFromFilename = (filename: string): string => {
		const ext = filename.split('.').pop()?.toLowerCase()
		const mimeTypes: Record<string, string> = {
			html: 'text/html',
			css: 'text/css',
			js: 'text/javascript',
			mjs: 'text/javascript',
			json: 'application/json',
			svg: 'image/svg+xml',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			webp: 'image/webp',
			ico: 'image/x-icon',
			woff: 'font/woff',
			woff2: 'font/woff2',
			ttf: 'font/ttf',
			eot: 'application/vnd.ms-fontobject',
		}
		return mimeTypes[ext || ''] || 'application/octet-stream'
	}

	// Helper function to determine if a MIME type is text-based
	const isTextMimeType = (mimeType: string): boolean => {
		return (
			mimeType.startsWith('text/') ||
			mimeType === 'application/javascript' ||
			mimeType === 'application/json' ||
			mimeType === 'image/svg+xml'
		)
	}

	const handleDialogClose = () => {
		if (!isInstalling) {
			setIsDialogOpen(false)
			setSelectedApp(null)
			setAppName('')
		}
	}

	return (
		<div className='space-y-6'>
			<div className='text-center'>
				<div className='flex items-center justify-center gap-2 mb-2'>
					<Sparkles className='h-5 w-5 text-blue-500' />
					<h3 className='text-lg font-semibold'>Sample Apps</h3>
				</div>
				<p className='text-sm text-muted-foreground'>
					Install pre-built sample applications to get started quickly
				</p>
			</div>

			<div className='grid gap-4'>
				{SAMPLE_APPS.map((app) => (
					<Card key={app.id} className='hover:shadow-md transition-shadow'>
						<CardHeader>
							<div className='flex items-start justify-between'>
								<div className='space-y-1'>
									<CardTitle className='flex items-center gap-2'>
										<Globe className='h-4 w-4 text-blue-500' />
										{app.title}
									</CardTitle>
									<CardDescription>{app.description}</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className='space-y-3'>
								{app.sourceUrl && (
									<div className='flex items-center gap-2 text-sm text-muted-foreground'>
										<span className='font-medium'>Source Code:</span>
										<a
											href={app.sourceUrl}
											target='_blank'
											rel='noopener noreferrer'
											className='inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 hover:underline'>
											View on GitHub
											<ExternalLink className='h-3 w-3' />
										</a>
									</div>
								)}
								<div className='flex items-center justify-between'>
									<div className='flex gap-2'>
										{app.tags.map((tag) => (
											<Badge key={tag} variant='secondary' className='text-xs'>
												{tag}
											</Badge>
										))}
									</div>
									<Button size='sm' onClick={() => handleInstallApp(app)} disabled={isInstalling}>
										<Download className='h-4 w-4 mr-1' />
										Install App
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Install Dialog */}
			<Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Install Sample App</DialogTitle>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-2'>
							<h4 className='font-medium'>{selectedApp?.title}</h4>
							<p className='text-sm text-muted-foreground'>{selectedApp?.description}</p>
						</div>

						<div className='space-y-2'>
							<Label htmlFor='app-name'>App Name</Label>
							<Input
								id='app-name'
								placeholder='my-sample-app'
								value={appName}
								onChange={(e) =>
									setAppName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
								}
								disabled={isInstalling}
							/>
							<p className='text-sm text-muted-foreground'>
								Your app will be available at: <code>/app/{appName || 'your-app-name'}</code>
							</p>
						</div>

						<div className='flex gap-2 pt-4'>
							<Button variant='outline' onClick={handleDialogClose} disabled={isInstalling}>
								Cancel
							</Button>
							<Button
								onClick={handleConfirmInstall}
								disabled={!appName || !validateAppName(appName) || isInstalling}
								className='flex-1'>
								{isInstalling ? (
									<>
										<div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
										Installing...
									</>
								) : (
									<>
										<CheckCircle className='h-4 w-4 mr-2' />
										Install App
									</>
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}
