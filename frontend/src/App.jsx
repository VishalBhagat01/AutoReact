import React, { useEffect } from 'react';
import { useTreeStore } from './store/treeStore';
import FigmaImport from './components/FigmaImport';
import TreeViewer from './components/TreeViewer';
import NodeDetailsPanel from './components/NodeDetailsPanel';
import { checkHealth } from './api/client';
import './App.css';

/**
 * Main App Component
 * Layout with three panels: import, tree viewer, and details
 */
function App() {
  const { setError } = useTreeStore();

  useEffect(() => {
    // Check API health on mount
    checkHealth().catch((error) => {
      console.warn('API health check failed:', error);

      setError(
        'Unable to connect to backend API. Make sure the server is running on http://localhost:5000'
      );
    });
  }, [setError]);

  return (
    <div className="flex h-screen bg-dark-900 text-dark-100">
      {/* Left Sidebar - Import & Tree Viewer */}
      <div className="flex flex-col w-96 border-r border-dark-700 bg-dark-800">
        {/* Import Section */}
        <FigmaImport />

        {/* Tree Viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <TreeViewer />
        </div>
      </div>

      {/* Right Panel - Node Details */}
      <div className="flex-1 flex flex-col bg-dark-900">
        <NodeDetailsPanel />
      </div>
    </div>
  );
}

export default App;