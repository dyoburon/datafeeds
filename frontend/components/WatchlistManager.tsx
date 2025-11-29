import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = 'http://localhost:5001';

interface WatchlistManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WatchlistManager({ isOpen, onClose }: WatchlistManagerProps) {
  const { backendUser } = useAuth();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickerPreview, setTickerPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Sync watchlist from backend user
  useEffect(() => {
    if (backendUser?.watchlist) {
      setWatchlist(backendUser.watchlist);
    }
  }, [backendUser]);

  const addTicker = async () => {
    if (!newTicker.trim() || !backendUser) return;
    
    const ticker = newTicker.trim().toUpperCase();
    
    if (watchlist.includes(ticker)) {
      setError('Ticker already in watchlist');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add ticker');
      }
      
      const updatedUser = await response.json();
      setWatchlist(updatedUser.watchlist || []);
      setNewTicker('');
      setTickerPreview(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeTicker = async (ticker: string) => {
    if (!backendUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/watchlist/${ticker}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove ticker');
      }
      
      const updatedUser = await response.json();
      setWatchlist(updatedUser.watchlist || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const previewTicker = async (ticker: string) => {
    if (!ticker.trim()) {
      setTickerPreview(null);
      return;
    }
    
    setPreviewLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/ticker/${ticker.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setTickerPreview(data);
      } else {
        setTickerPreview(null);
      }
    } catch {
      setTickerPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Debounced preview
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newTicker.length >= 1) {
        previewTicker(newTicker);
      } else {
        setTickerPreview(null);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [newTicker]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header gradient */}
        <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
        
        <div className="p-6 overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              👁️ Your Watchlist
            </h2>
            <p className="text-gray-400 text-sm">
              Add stocks to track in your daily market briefing. Top 5 with the most news will be included.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Add ticker input */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => {
                  setNewTicker(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addTicker()}
                placeholder="Enter ticker symbol (e.g., AAPL)"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all uppercase"
                maxLength={10}
              />
              <button
                onClick={addTicker}
                disabled={loading || !newTicker.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : 'Add'}
              </button>
            </div>
            
            {/* Ticker preview */}
            {previewLoading && (
              <div className="mt-2 text-gray-500 text-sm">Looking up ticker...</div>
            )}
            {tickerPreview && !previewLoading && (
              <div className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{tickerPreview.ticker}</span>
                    <span className="text-gray-400 ml-2">{tickerPreview.name}</span>
                  </div>
                  {tickerPreview.performance?.current_price && (
                    <div className="text-right">
                      <span className="text-white font-medium">${tickerPreview.performance.current_price}</span>
                      {tickerPreview.performance.change_percent !== null && (
                        <span className={`ml-2 text-sm ${tickerPreview.performance.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tickerPreview.performance.change_percent >= 0 ? '+' : ''}{tickerPreview.performance.change_percent?.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {tickerPreview.sector && tickerPreview.sector !== 'Unknown' && (
                  <div className="text-gray-500 text-xs mt-1">{tickerPreview.sector}</div>
                )}
                {tickerPreview.error && (
                  <div className="text-yellow-500 text-xs mt-1">⚠️ Could not fetch full data</div>
                )}
              </div>
            )}
          </div>

          {/* Watchlist */}
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Current Watchlist ({watchlist.length})
            </h3>
            
            {watchlist.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p>No stocks in your watchlist yet.</p>
                <p className="text-sm mt-1">Add some tickers above to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {watchlist.map((ticker) => (
                  <div 
                    key={ticker}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <span className="font-semibold text-white">{ticker}</span>
                    <button
                      onClick={() => removeTicker(ticker)}
                      disabled={loading}
                      className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove from watchlist"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {watchlist.length > 5 && (
              <p className="text-yellow-500 text-sm mt-3">
                ⚠️ You have more than 5 stocks. Only the top 5 with the most news will be included in your daily email.
              </p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-800 text-gray-300 rounded-lg font-semibold hover:bg-gray-700 transition-colors border border-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

