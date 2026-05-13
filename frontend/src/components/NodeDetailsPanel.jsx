import React from 'react';
import { useTreeStore } from '../store/treeStore';

/**
 * NodeDetailsPanel Component
 * Shows comprehensive details about the selected node including:
 * - Node metadata (ID, type, name)
 * - Semantic classification with confidence
 * - Layout and responsive information
 * - Comprehensive styles (colors, typography, spacing, effects)
 * - Bounds and dimensions
 * - Suggested React component
 */
const NodeDetailsPanel = () => {
  const { selectedNodeId, getSelectedNode } = useTreeStore();
  const node = getSelectedNode();

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full bg-dark-800">
        <div className="text-center text-dark-500">
          <p className="text-sm">Select a node to view details</p>
        </div>
      </div>
    );
  }

  const getConfidenceBadgeColor = (confidence) => {
    if (confidence >= 80) return 'bg-white';
    if (confidence >= 60) return 'bg-dark-300';
    return 'bg-dark-500';
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-y-auto">
      {/* Header */}
      <div className="border-b border-dark-800 px-4 py-4 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <h3 className="text-base font-bold text-white tracking-tight truncate">{node.name}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] uppercase tracking-widest font-bold text-dark-400">Node Type:</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-dark-700 px-1.5 py-0.5 rounded">
            {node.type}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 space-y-8">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-4">
          {/* Node ID */}
          <div className="glass-panel p-3 rounded-lg">
            <label className="text-[10px] uppercase tracking-widest font-bold text-dark-500 block mb-2">Internal ID</label>
            <p className="text-xs text-dark-200 font-mono break-all">
              {node.id}
            </p>
          </div>
        </div>

        {/* Semantic Classification */}
        {(node.semanticType || node.semantic) && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-bold text-dark-500 block">
              Semantic Analysis
            </label>
            <div className="glass-panel p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-300 font-medium">Classified Type</span>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-white text-black px-2 py-1 rounded">
                  {node.semanticType || node.semantic?.type}
                </span>
              </div>
              
              {(node.confidence !== undefined || node.semantic?.confidence !== undefined) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-dark-300">Confidence:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-dark-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getConfidenceBadgeColor((node.confidence || (node.semantic?.confidence / 100) || 0) * 100)}`}
                        style={{ width: `${(node.confidence || (node.semantic?.confidence / 100) || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-dark-300 font-mono">
                      {Math.round((node.confidence || (node.semantic?.confidence / 100) || 0) * 100)}%
                    </span>
                  </div>
                </div>
              )}

              {(node.reasoning || node.semantic?.reasoning) && (
                <div>
                  <p className="text-xs text-dark-500 mb-1">Detection Rules:</p>
                  <ul className="space-y-1">
                    {(node.reasoning || node.semantic?.reasoning || []).map((reason, idx) => (
                      <li key={idx} className="text-xs text-dark-300 list-disc list-inside">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {node.layoutPattern && (
                <div className="flex items-center justify-between border-t border-dark-600 pt-2 mt-2">
                  <span className="text-xs text-dark-300">Layout Pattern:</span>
                  <span className="text-xs font-mono text-blue-400 capitalize">{node.layoutPattern}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layout Information */}
        {node.layout && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-bold text-dark-500 block">📐 Layout Engine</label>
            <div className="glass-panel p-4 rounded-xl space-y-3">
              {node.layout.mode && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-dark-400">Direction</span>
                  <span className="text-xs text-white font-bold uppercase tracking-widest">{node.layout.mode}</span>
                </div>
              )}
              {node.layout.justifyContent && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-dark-400">Justify</span>
                  <span className="text-xs text-dark-100 font-mono">{node.layout.justifyContent}</span>
                </div>
              )}
              {node.layout.alignItems && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-dark-400">Align</span>
                  <span className="text-xs text-dark-100 font-mono">{node.layout.alignItems}</span>
                </div>
              )}
              {node.layout.gap !== undefined && (
                <div className="flex justify-between items-center border-t border-dark-800 pt-2">
                  <span className="text-xs text-dark-400">Item Spacing</span>
                  <span className="text-xs text-white font-bold">{node.layout.gap}px</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bounds */}
        {node.bounds && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-bold text-dark-500 block">📍 Dimensions</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-panel p-3 rounded-lg">
                <p className="text-[9px] uppercase font-bold text-dark-500 mb-1">Width</p>
                <p className="text-sm font-bold text-white font-mono">{node.bounds.width}px</p>
              </div>
              <div className="glass-panel p-3 rounded-lg">
                <p className="text-[9px] uppercase font-bold text-dark-500 mb-1">Height</p>
                <p className="text-sm font-bold text-white font-mono">{node.bounds.height}px</p>
              </div>
              <div className="glass-panel p-3 rounded-lg">
                <p className="text-[9px] uppercase font-bold text-dark-500 mb-1">Position X</p>
                <p className="text-sm font-medium text-dark-300 font-mono">{node.bounds.x}</p>
              </div>
              <div className="glass-panel p-3 rounded-lg">
                <p className="text-[9px] uppercase font-bold text-dark-500 mb-1">Position Y</p>
                <p className="text-sm font-medium text-dark-300 font-mono">{node.bounds.y}</p>
              </div>
            </div>
          </div>
        )}

        {/* Text Content */}
        {node.text && (
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-widest font-bold text-dark-500 block">📝 Content</label>
            <div className="glass-panel p-4 rounded-xl">
              <p className="text-xs text-white leading-relaxed font-medium selection:bg-white selection:text-black">
                {node.text}
              </p>
            </div>
          </div>
        )}

        {/* Comprehensive Styles */}
        {node.styles && (
          <div className="border-t border-dark-700 pt-3 space-y-3">
            {/* Colors */}
            {node.styles.colors && (
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-2">🎨 Colors</label>
                <div className="space-y-1">
                  {node.styles.colors.map((color, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border border-dark-600"
                        style={{ backgroundColor: color.rgba }}
                        title={color.rgba}
                      />
                      <div className="flex-1">
                        <p className="text-xs text-dark-300 font-mono">{color.hex}</p>
                        <p className="text-xs text-dark-500">{Math.round(color.opacity * 100)}% opacity</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stroke */}
            {node.styles.stroke && (
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-1">🖍️ Stroke</label>
                <div className="bg-dark-700 p-2 rounded space-y-1">
                  <p className="text-xs text-dark-300">
                    <span className="text-dark-500">Color:</span> {node.styles.stroke.color}
                  </p>
                  <p className="text-xs text-dark-300">
                    <span className="text-dark-500">Width:</span> {node.styles.stroke.width}px
                  </p>
                  {node.styles.stroke.align && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Align:</span> {node.styles.stroke.align}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Typography */}
            {node.styles.typography && (
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-2">✏️ Typography</label>
                <div className="bg-dark-700 p-2 rounded space-y-1">
                  {node.styles.typography.fontSize && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Size:</span> {node.styles.typography.fontSize}px
                    </p>
                  )}
                  {node.styles.typography.fontFamily && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Family:</span> {node.styles.typography.fontFamily}
                    </p>
                  )}
                  {node.styles.typography.fontWeight && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Weight:</span> {node.styles.typography.fontWeight}
                    </p>
                  )}
                  {node.styles.typography.lineHeight && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Line Height:</span> {node.styles.typography.lineHeight}px
                    </p>
                  )}
                  {node.styles.typography.letterSpacing && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Letter Spacing:</span> {node.styles.typography.letterSpacing}px
                    </p>
                  )}
                  {node.styles.typography.textAlign && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Align:</span> {node.styles.typography.textAlign}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Spacing */}
            {node.styles.spacing && (
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-2">📦 Spacing</label>
                <div className="bg-dark-700 p-2 rounded space-y-1">
                  {node.styles.spacing.padding && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Padding:</span> {node.styles.spacing.padding}px
                    </p>
                  )}
                  {node.styles.spacing.paddingLeft && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Padding Left:</span> {node.styles.spacing.paddingLeft}px
                    </p>
                  )}
                  {node.styles.spacing.paddingRight && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Padding Right:</span> {node.styles.spacing.paddingRight}px
                    </p>
                  )}
                  {node.styles.spacing.paddingTop && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Padding Top:</span> {node.styles.spacing.paddingTop}px
                    </p>
                  )}
                  {node.styles.spacing.paddingBottom && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Padding Bottom:</span> {node.styles.spacing.paddingBottom}px
                    </p>
                  )}
                  {node.styles.spacing.gap && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Gap:</span> {node.styles.spacing.gap}px
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Border Radius */}
            {node.styles.borderRadius && (
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-2">🔲 Border Radius</label>
                <div className="bg-dark-700 p-2 rounded space-y-1">
                  {node.styles.borderRadius.all && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">All:</span> {node.styles.borderRadius.all}px
                    </p>
                  )}
                  {node.styles.borderRadius.topLeft && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Top Left:</span> {node.styles.borderRadius.topLeft}px
                    </p>
                  )}
                  {node.styles.borderRadius.topRight && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Top Right:</span> {node.styles.borderRadius.topRight}px
                    </p>
                  )}
                  {node.styles.borderRadius.bottomLeft && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Bottom Left:</span> {node.styles.borderRadius.bottomLeft}px
                    </p>
                  )}
                  {node.styles.borderRadius.bottomRight && (
                    <p className="text-xs text-dark-300">
                      <span className="text-dark-500">Bottom Right:</span> {node.styles.borderRadius.bottomRight}px
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Effects */}
            {node.styles.effects && node.styles.effects.length > 0 && (
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-2">✨ Effects</label>
                <div className="bg-dark-700 p-2 rounded space-y-2">
                  {node.styles.effects.map((effect, idx) => (
                    <div key={idx} className="text-xs text-dark-300 border-b border-dark-600 pb-2">
                      <p className="font-mono capitalize">{effect.type}</p>
                      {effect.type === 'shadow' || effect.type === 'innerShadow' ? (
                        <>
                          <p>Offset: ({effect.offsetX}, {effect.offsetY})</p>
                          <p>Blur: {effect.blur}px</p>
                          <p>Color: {effect.color}</p>
                        </>
                      ) : effect.type === 'blur' ? (
                        <p>Radius: {effect.radius}px</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opacity */}
            {node.styles.opacity !== undefined && (
              <div>
                <p className="text-xs text-dark-300">
                  <span className="text-dark-500">Opacity:</span> {node.styles.opacity}%
                </p>
              </div>
            )}

            {/* Blend Mode */}
            {node.styles.blendMode && (
              <div>
                <p className="text-xs text-dark-300">
                  <span className="text-dark-500">Blend Mode:</span> {node.styles.blendMode}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Children Count */}
        {node.children && node.children.length > 0 && (
          <div className="border-t border-dark-700 pt-3">
            <p className="text-xs text-dark-400">
              👶 Children: <span className="text-dark-300 font-medium">{node.children.length}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeDetailsPanel;
