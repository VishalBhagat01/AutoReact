import React from 'react';
import { useTreeStore } from '../store/treeStore';
import { ChevronDownIcon, ChevronRightIcon } from './Icons';

/**
 * TreeNode Component
 * Renders a single node in the tree with expand/collapse functionality
 */
const TreeNode = ({ node, level = 0, hasChildren = false }) => {
  const { selectedNodeId, expandedNodes, setSelectedNode, toggleNodeExpanded } = useTreeStore();
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;

  const handleClick = (e) => {
    e.stopPropagation();
    setSelectedNode(node.id);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleNodeExpanded(node.id);
  };

  // Determine node icon based on type
  const getNodeIcon = () => {
    const typeIconMap = {
      FRAME: '📱',
      GROUP: '📦',
      TEXT: '✍️',
      RECTANGLE: '⬜',
      COMPONENT: '🧩',
      INSTANCE: '📌',
      ELLIPSE: '⭕',
      POLYGON: '🔺',
    };
    return typeIconMap[node.type] || '📄';
  };

  // Truncate long names
  const displayName = node.name.length > 30 ? node.name.substring(0, 30) + '...' : node.name;

  return (
    <div key={node.id} className="select-none">
      <div
        className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-all duration-200
          ${isSelected 
            ? 'bg-white/10 text-white border-l-2 border-white shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' 
            : 'hover:bg-white/5 text-dark-300'
          }
        `}
        style={{ paddingLeft: `${12 + level * 20}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren && (
          <button
            onClick={handleToggle}
            className="flex items-center justify-center w-4 h-4 flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDownIcon />
            ) : (
              <ChevronRightIcon />
            )}
          </button>
        )}

        {/* No children placeholder */}
        {!hasChildren && <div className="w-4 h-4 flex-shrink-0" />}

        {/* Node Icon */}
        <span className="text-base flex-shrink-0">{getNodeIcon()}</span>

        {/* Node Name */}
        <span className="text-sm font-medium truncate">{displayName}</span>

        {/* Node Type Badge */}
        <span className={`
          text-xs px-2 py-0.5 rounded ml-auto flex-shrink-0
          ${isSelected 
            ? 'bg-white/20 border border-white/20 text-white' 
            : 'bg-dark-800 border border-dark-700 text-dark-400'
          }
        `}>
          {node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              hasChildren={child.children && child.children.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
