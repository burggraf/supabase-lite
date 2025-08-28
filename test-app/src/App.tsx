import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { Card, CardContent } from "./components/ui/card"
import { ApiTesting } from "./components/ApiTesting"
import { AuthTesting } from "./components/AuthTesting"
import { Settings } from "./components/Settings"
import SampleApp from "./components/sample-app/SampleApp"
import EdgeFunctionTest from "./components/EdgeFunctionTest"

function App() {
  const handleSettingsChange = () => {
    // This callback will be triggered when settings change in the Settings component
    // It can be used to refresh other components if needed
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      {/* Top Navigation Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Supabase Lite Test Suite
                </h1>
                <p className="text-sm text-gray-500">Professional testing environment</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="px-3 py-1.5 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                Live
              </div>
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        <Tabs defaultValue="overview" className="w-full">
          {/* Beautiful Modern Tab Navigation */}
          <div className="mb-8 max-w-7xl mx-auto px-6">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-white p-1 shadow-lg border border-gray-200/50 backdrop-blur-sm">
              <TabsTrigger 
                value="overview"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Overview
              </TabsTrigger>
              
              <TabsTrigger 
                value="auth"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Authentication
              </TabsTrigger>
              
              <TabsTrigger 
                value="storage"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                Storage
              </TabsTrigger>
              
              <TabsTrigger 
                value="api"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                API Testing
              </TabsTrigger>
              
              <TabsTrigger 
                value="functions"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-yellow-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Edge Functions
              </TabsTrigger>
              
              <TabsTrigger 
                value="settings"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </TabsTrigger>
              
              <TabsTrigger 
                value="sample-app"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-6 py-2.5 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-50 data-[state=inactive]:text-gray-600"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Sample App
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Contents */}
          <TabsContent value="overview" className="mt-0">
            <div className="max-w-7xl mx-auto px-6 space-y-6">
              {/* Hero Section */}
              <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white border-0 shadow-2xl">
                <div className="absolute inset-0 opacity-10">
                  <div className="w-full h-full bg-gradient-to-br from-white/5 to-transparent"></div>
                </div>
                <CardContent className="relative p-12">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-6">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      Environment Ready
                    </div>
                    <h2 className="text-4xl font-bold mb-4">
                      Welcome to Your Professional Testing Suite
                    </h2>
                    <p className="text-xl text-blue-100 leading-relaxed">
                      Comprehensive tools for testing every aspect of your Supabase Lite implementation with enterprise-grade reliability and beautiful interfaces.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-emerald-50 to-emerald-100 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-emerald-900 mb-2">Authentication</h3>
                    <p className="text-emerald-700 text-sm">Complete auth flow testing with signup, signin, and session management.</p>
                  </CardContent>
                </Card>

                <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-rose-50 to-rose-100 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-rose-900 mb-2">Sample App</h3>
                    <p className="text-rose-700 text-sm">Interactive demo showcasing real-world Supabase Lite implementation patterns.</p>
                  </CardContent>
                </Card>

                <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-orange-900 mb-2">Storage</h3>
                    <p className="text-orange-700 text-sm">File operations testing with upload, download, and bucket management.</p>
                  </CardContent>
                </Card>

                <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-cyan-50 to-cyan-100 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-cyan-900 mb-2">API Testing</h3>
                    <p className="text-cyan-700 text-sm">REST endpoint validation with request builders and response analysis.</p>
                  </CardContent>
                </Card>
              </div>

              {/* Status Card */}
              <Card className="border-0 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-green-900 mb-2">System Ready for Testing</h3>
                      <p className="text-green-800 leading-relaxed">Your Supabase Lite environment is fully configured and operational. Select any testing module above to begin comprehensive validation of your implementation.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Other tabs with consistent beautiful styling */}
          <TabsContent value="auth" className="mt-0">
            <div className="bg-white rounded-lg shadow-xl border mx-2">
              <AuthTesting />
            </div>
          </TabsContent>


          <TabsContent value="storage" className="mt-0">
            <div className="max-w-7xl mx-auto px-6">
            <Card className="shadow-2xl border-0 bg-gradient-to-br from-white to-orange-50 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-white">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">Storage Management</h2>
                    <p className="text-orange-100 text-lg mt-1">File operations and bucket management testing suite</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">Storage Module</h3>
                  <p className="text-gray-600 leading-relaxed text-lg">Comprehensive file management tools with drag-and-drop upload, download managers, bucket configuration, and storage analytics dashboard.</p>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          <TabsContent value="api" className="mt-0">
            <div className="bg-white rounded-lg shadow-xl border mx-2">
              <ApiTesting />
            </div>
          </TabsContent>
          
          <TabsContent value="functions" className="mt-0">
            <div className="mx-2">
              <EdgeFunctionTest />
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-0">
            <Settings onSettingsChange={handleSettingsChange} />
          </TabsContent>

          <TabsContent value="sample-app" className="mt-0 h-full">
            <div className="h-screen overflow-hidden">
              <SampleApp />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
