import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function TestTablesView() {
  const handleTest = () => {
    console.log('TEST BUTTON WORKS!');
    alert('🎉 SUCCESS! Event handlers are working!');
  };

  const handleNewTable = () => {
    console.log('NEW TABLE BUTTON WORKS!');
    alert('🚀 New Table button works perfectly!');
  };

  console.log('TestTablesView component is rendering!');

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Test Tables View - WORKING!</h1>
        <p className="text-sm text-muted-foreground">If you can see this, React is working correctly.</p>
      </div>
      
      <div className="flex items-center space-x-4 mb-6">
        <Button onClick={handleTest} variant="outline">
          🧪 TEST BUTTON
        </Button>
        <Button onClick={handleNewTable}>
          <Plus className="h-4 w-4 mr-2" />
          New Table
        </Button>
      </div>

      <div className="border rounded-lg p-4">
        <p className="text-center text-muted-foreground">
          This is a test component to verify React event handlers work correctly.
          If the buttons above work, then we can fix the original TablesView component.
        </p>
      </div>
    </div>
  );
}