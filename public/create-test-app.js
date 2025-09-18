// Test script to create hw2 application
window.testCreateApp = async function() {
    console.log('🧪 Testing application creation...');
    
    try {
        // File content from the hello/index.html file
        const fileContent = '<h1>Hello, world!</h1>\n\n';
        
        const appRequest = {
            id: 'hw2',
            name: 'Hello World 2',
            description: 'Test application with uploaded file',
            runtimeId: 'static',
            metadata: {
                entryPoint: 'index.html',
                files: [{
                    name: 'index.html',
                    content: fileContent,
                    size: fileContent.length,
                    type: 'text/html'
                }]
            }
        };
        
        console.log('📤 Sending request to /api/applications:', appRequest);
        
        const response = await fetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appRequest)
        });
        
        console.log('📥 Create response status:', response.status);
        const data = await response.json();
        console.log('📥 Create response data:', data);
        
        if (response.ok) {
            console.log('✅ Application created successfully!');
            
            // Now test accessing the app
            console.log('🌐 Testing app access at /app/hw2...');
            const appResponse = await fetch('/app/hw2');
            console.log('📥 App response status:', appResponse.status);
            const html = await appResponse.text();
            console.log('📄 App content:', html);
            
            if (appResponse.ok && html.includes('Hello, world!')) {
                console.log('🎉 SUCCESS! App is working and contains expected content.');
                console.log('🔗 Test the app at: http://localhost:5173/app/hw2');
                return true;
            } else {
                console.error('❌ App not working. Status:', appResponse.status);
                console.error('Content:', html);
                return false;
            }
        } else {
            console.error('❌ Failed to create application. Status:', response.status);
            console.error('Response:', data);
            return false;
        }
    } catch (error) {
        console.error('💥 Test failed with error:', error);
        return false;
    }
};

console.log('🔧 Test function loaded. Run: testCreateApp()');