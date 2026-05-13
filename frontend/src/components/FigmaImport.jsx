import React, { useState } from 'react';
import { useTreeStore } from '../store/treeStore';
import { importFigmaFile } from '../api/client';
import { LoadingSpinner, AlertIcon } from './Icons';

/**
 * FigmaImport Component
 * Allows user to input a Figma URL and trigger the import process
 */
const FigmaImport = ({ onSuccess }) => {
  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState(null);
  const { setTree, setLoading, setError, loading } = useTreeStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setError(null);

    // Validate URL
    if (!url.trim()) {
      setLocalError('Please enter a Figma URL');
      return;
    }

    if (!url.includes('figma.com')) {
      setLocalError('Please enter a valid Figma URL');
      return;
    }

    try {
      setLoading(true);
      const data = await importFigmaFile(url);
      setTree(data);
      onSuccess?.(data);
    } catch (error) {
      const errorMessage = error.message || 'Failed to import Figma file';
      setError(errorMessage);
      setLocalError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-900 border-b border-dark-700 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Input Field */}
        <div>
          <label htmlFor="figma-url" className="block text-xs font-medium text-dark-300 mb-2">
            Figma File URL
          </label>
          <div className="flex gap-2">
            <input
              id="figma-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setLocalError(null);
              }}
              placeholder="https://www.figma.com/file/..."
              className="flex-1 px-3 py-2 bg-dark-900 border border-dark-700 rounded-md text-dark-200 placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-dark-100 disabled:bg-dark-700 text-black rounded-md font-semibold text-sm transition-all duration-200 flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Import</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {localError && (
          <div className="flex gap-2 bg-red-900/20 border border-red-800 rounded-md p-3">
            <AlertIcon className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-400">{localError}</p>
          </div>
        )}

        {/* Help Text */}
        <div className="flex gap-2 bg-dark-800 rounded-md p-3">
          <span className="text-lg flex-shrink-0">💡</span>
          <div className="text-xs text-dark-400">
            <p className="font-medium mb-1">How to get your Figma URL:</p>
            <ul className="list-disc list-inside space-y-0.5 text-dark-500">
              <li>Open your design file in Figma</li>
              <li>Copy the URL from your browser</li>
              <li>Paste it here and click Import</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
};

export default FigmaImport;
