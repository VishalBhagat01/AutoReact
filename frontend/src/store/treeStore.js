import { create } from 'zustand';

/**
 * Tree Store
 * Manages the parsed design tree state and UI interactions
 */
export const useTreeStore = create((set, get) => ({
  // State
  tree: null,
  fileName: '',
  fileVersion: '',
  totalNodeCount: 0,
  selectedNodeId: null,
  expandedNodes: new Set(),
  loading: false,
  error: null,

  // Actions
  setTree: (data) => {
    set({
      tree: data.tree,
      fileName: data.fileName,
      fileVersion: data.fileVersion,
      totalNodeCount: data.totalNodeCount,
      error: null,
    });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  toggleNodeExpanded: (nodeId) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    
    set({ expandedNodes: newExpanded });
  },

  setLoading: (loading) => {
    set({ loading });
  },

  setError: (error) => {
    set({ error });
  },

  resetStore: () => {
    set({
      tree: null,
      fileName: '',
      fileVersion: '',
      totalNodeCount: 0,
      selectedNodeId: null,
      expandedNodes: new Set(),
      loading: false,
      error: null,
    });
  },

  // Helper to get selected node details
  getSelectedNode: () => {
    const { tree, selectedNodeId } = get();
    if (!tree || !selectedNodeId) return null;
    return findNodeById(tree, selectedNodeId);
  },
}));

/**
 * Recursively find node by ID
 */
const findNodeById = (node, id) => {
  if (node.id === id) return node;
  
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  
  return null;
};
