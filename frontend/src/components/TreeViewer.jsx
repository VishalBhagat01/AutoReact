import React, { useEffect } from 'react';
import { useTreeStore } from '../store/treeStore';
import TreeNode from './TreeNode';

/**
 * TreeViewer Component
 * Displays the hierarchical tree structure of the parsed Figma design
 */
const TreeViewer = () => {
  const { tree, fileName, loading, error } = useTreeStore();

  useEffect(() => {
    // Auto-expand root node on load
    if (tree && tree.id) {
      useTreeStore.setState(state => ({
        expandedNodes: new Set([...state.expandedNodes, tree.id])
      }));
    }
  }, [tree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-dark-600 border-t-blue-500 rounded-full animate-spin mb-4" />
          </div>
          <p className="text-dark-300">Loading design tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-4">
          <div className="text-red-500 text-4xl mb-2">⚠️</div>
          <p className="text-red-400 font-medium">{error}</p>
          <p className="text-dark-400 text-sm mt-2">Please check the URL and try again</p>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-2">🎨</div>
          <p className="text-dark-400">No design loaded yet</p>
          <p className="text-dark-500 text-sm mt-2">Paste a Figma URL above to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark-800">
      {/* Header */}
      <div className="border-b border-dark-700 px-4 py-3 bg-dark-800">
        <h3 className="text-sm font-semibold text-white truncate">
          {fileName || 'Design Tree'}
        </h3>
        <p className="text-xs text-dark-400 mt-1">
          {tree.type === 'CANVAS' ? `Page: ${tree.name}` : tree.name}
        </p>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          <TreeNode
            node={tree}
            level={0}
            hasChildren={tree.children && tree.children.length > 0}
          />
        </div>
      </div>
    </div>
  );
};

export default TreeViewer;
