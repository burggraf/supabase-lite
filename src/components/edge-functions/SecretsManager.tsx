import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Plus, Edit3, Trash2, Eye, EyeOff, Save, X, Settings } from 'lucide-react';

interface Secret {
  id: string;
  key: string;
  value: string;
  description?: string;
  lastUpdated: string;
}

interface SecretsManagerProps {
  projectId?: string;
}

export const SecretsManager: React.FC<SecretsManagerProps> = ({ projectId }) => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [showValues, setShowValues] = useState<{ [key: string]: boolean }>({});
  const [_editingSecret, setEditingSecret] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{ key: string; value: string; description: string }>({
    key: '',
    value: '',
    description: '',
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSecrets = useCallback(async () => {
    try {
      setLoading(true);
      // Load secrets from localStorage (project-scoped)
      const storageKey = `edge-function-secrets-${projectId || 'default'}`;
      const stored = localStorage.getItem(storageKey);
      const loadedSecrets = stored ? JSON.parse(stored) : [];
      setSecrets(loadedSecrets);
    } catch (error) {
      console.error('Failed to load secrets:', error);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSecrets();
  }, [projectId, loadSecrets]);

  const saveSecrets = async (updatedSecrets: Secret[]) => {
    try {
      const storageKey = `edge-function-secrets-${projectId || 'default'}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedSecrets));
      setSecrets(updatedSecrets);
    } catch (error) {
      console.error('Failed to save secrets:', error);
    }
  };

  const handleAddSecret = async () => {
    if (!newSecret.key.trim() || !newSecret.value.trim()) {
      alert('Key and value are required');
      return;
    }

    if (secrets.some(s => s.key === newSecret.key)) {
      alert('A secret with this key already exists');
      return;
    }

    const secret: Secret = {
      id: Date.now().toString(),
      key: newSecret.key.trim(),
      value: newSecret.value.trim(),
      description: newSecret.description.trim(),
      lastUpdated: new Date().toISOString(),
    };

    await saveSecrets([...secrets, secret]);
    setNewSecret({ key: '', value: '', description: '' });
    setIsAddingNew(false);
  };


  const handleDeleteSecret = async (secretId: string) => {
    const secret = secrets.find(s => s.id === secretId);
    if (!secret) return;

    if (confirm(`Are you sure you want to delete the secret "${secret.key}"?`)) {
      const updatedSecrets = secrets.filter(s => s.id !== secretId);
      await saveSecrets(updatedSecrets);
    }
  };

  const toggleValueVisibility = (secretId: string) => {
    setShowValues(prev => ({ ...prev, [secretId]: !prev[secretId] }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const maskValue = (value: string) => {
    return '•'.repeat(Math.min(value.length, 20));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading secrets...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Edge Function Secrets
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage the secrets for your project's Edge Functions
          </p>
        </div>
        <Button
          onClick={() => setIsAddingNew(true)}
          className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Secret
        </Button>
      </div>

      {/* Add New Secret Form */}
      {isAddingNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Secret</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Key
              </label>
              <Input
                value={newSecret.key}
                onChange={(e) => setNewSecret({ ...newSecret, key: e.target.value })}
                placeholder="SECRET_KEY"
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Value
              </label>
              <Input
                type="password"
                value={newSecret.value}
                onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                placeholder="secret_value"
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <Input
                value={newSecret.description}
                onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                placeholder="Description of what this secret is used for"
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleAddSecret}>
                <Save className="w-4 h-4 mr-2" />
                Save Secret
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingNew(false);
                  setNewSecret({ key: '', value: '', description: '' });
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secrets List */}
      {secrets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Settings className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No secrets configured
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Environment variables and secrets will appear here once you add them.
            </p>
            <Button
              onClick={() => setIsAddingNew(true)}
              variant="outline"
            >
              Add your first secret
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {secrets.map((secret) => (
            <Card key={secret.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-3">
                      <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                        {secret.key}
                      </code>
                      <Badge variant="secondary" className="text-xs">
                        Secret
                      </Badge>
                    </div>
                    
                    {secret.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">{secret.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-3">
                      <code className="text-sm font-mono bg-gray-50 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 rounded flex-1 max-w-md">
                        {showValues[secret.id] ? secret.value : maskValue(secret.value)}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleValueVisibility(secret.id)}
                      >
                        {showValues[secret.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last updated: {formatDate(secret.lastUpdated)}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSecret(secret.id)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSecret(secret.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};