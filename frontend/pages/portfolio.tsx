import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

const API_BASE = 'http://localhost:5001';

interface TickerData {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  volume: number | null;
  headlines: string[];
  news_count: number;
  has_news: boolean;
  error?: string;
}

export default function PortfolioPage() {
  const router = useRouter();
  const { user, backendUser, signOut, isDevMode, loading: authLoading } = useAuth();
  
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [portfolioData, setPortfolioData] = useState<TickerData[]>([]);
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickerPreview, setTickerPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Sync watchlist from backend user
  useEffect(() => {
    if (backendUser?.watchlist) {
      setWatchlist(backendUser.watchlist);
    }
  }, [backendUser]);

  // Fetch portfolio data when watchlist changes
  useEffect(() => {
    if (watchlist.length > 0) {
      fetchPortfolioData();
    } else {
      setPortfolioData([]);
    }
  }, [watchlist]);

  const fetchPortfolioData = async () => {
    if (watchlist.length === 0) return;
    
    setDataLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/watchlist/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: watchlist, max_tickers: 20 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPortfolioData(data.tickers || []);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const addTicker = async () => {
    if (!newTicker.trim() || !backendUser) return;
    
    const ticker = newTicker.trim().toUpperCase();
    
    if (watchlist.includes(ticker)) {
      setError('Ticker already in portfolio');
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Head>
        <title>AI Portfolio | Prism</title>
        <meta name="description" content="AI-powered portfolio analysis and insights" />
      </Head>

      {/* Dev mode banner */}
      {isDevMode && (
        <div className="bg-yellow-900/50 text-yellow-300 text-xs text-center py-1 px-4">
          🛠️ Dev Mode – Using mock authentication
        </div>
      )}

      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/">
              <a className="text-xl font-bold text-violet-400">Prism</a>
            </Link>
            <div className="flex gap-6">
              <Link href="/app">
                <a className="text-gray-400 hover:text-white transition-colors text-sm">
                  Market Analysis
                </a>
              </Link>
              <Link href="/portfolio">
                <a className="text-white font-medium text-sm border-b-2 border-violet-500 pb-1">
                  AI Portfolio
                </a>
              </Link>
              <Link href="/profile">
                <a className="text-gray-400 hover:text-white transition-colors text-sm">
                  Profile
                </a>
              </Link>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-sm font-medium">
                  {user.displayName?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="text-gray-400 text-sm hidden md:inline">
                  {backendUser?.email || user.email}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="text-gray-500 hover:text-white text-sm transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <h1 className="text-3xl font-bold text-white">AI Portfolio</h1>
          </div>
          <p className="text-gray-400 ml-13">
            Track and analyze your portfolio with AI-powered insights. Add stocks to monitor their performance and news.
          </p>
        </div>

        {/* Add Ticker Section */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Add to Portfolio</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => {
                  setNewTicker(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addTicker()}
                placeholder="Enter ticker symbol (e.g., AAPL, MSFT, GOOGL)"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all uppercase text-lg"
                maxLength={10}
              />
              
              {/* Ticker preview dropdown */}
              {(tickerPreview || previewLoading) && newTicker && (
                <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-10">
                  {previewLoading ? (
                    <div className="text-gray-500 text-sm">Looking up ticker...</div>
                  ) : tickerPreview ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white text-lg">{tickerPreview.ticker}</span>
                          <span className="text-gray-400 ml-2">{tickerPreview.name}</span>
                        </div>
                        {tickerPreview.performance?.current_price && (
                          <div className="text-right">
                            <span className="text-white font-medium text-lg">${tickerPreview.performance.current_price}</span>
                            {tickerPreview.performance.change_percent !== null && (
                              <span className={`ml-2 text-sm font-medium ${tickerPreview.performance.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {tickerPreview.performance.change_percent >= 0 ? '+' : ''}{tickerPreview.performance.change_percent?.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {tickerPreview.sector && tickerPreview.sector !== 'Unknown' && (
                        <div className="text-gray-500 text-sm mt-1">{tickerPreview.sector}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <button
              onClick={addTicker}
              disabled={loading || !newTicker.trim()}
              className="px-8 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {loading ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </div>

        {/* Portfolio Grid */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Your Portfolio 
            <span className="text-gray-500 font-normal ml-2">({watchlist.length} stocks)</span>
          </h2>
          {watchlist.length > 0 && (
            <button
              onClick={fetchPortfolioData}
              disabled={dataLoading}
              className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-2 transition-colors"
            >
              <svg className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          )}
        </div>

        {watchlist.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-white mb-2">Your portfolio is empty</h3>
            <p className="text-gray-400 mb-6">Add some stocks above to start tracking your portfolio with AI-powered insights.</p>
            <div className="flex justify-center gap-3 text-sm text-gray-500">
              <span className="px-3 py-1 bg-gray-800 rounded-full">Try: AAPL</span>
              <span className="px-3 py-1 bg-gray-800 rounded-full">MSFT</span>
              <span className="px-3 py-1 bg-gray-800 rounded-full">GOOGL</span>
              <span className="px-3 py-1 bg-gray-800 rounded-full">TSLA</span>
              <span className="px-3 py-1 bg-gray-800 rounded-full">NVDA</span>
            </div>
          </div>
        ) : dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((ticker) => (
              <div key={ticker} className="bg-gray-900 rounded-xl border border-gray-800 p-6 animate-pulse">
                <div className="h-6 bg-gray-800 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-800 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-800 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-800 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolioData.map((stock) => (
              <div 
                key={stock.ticker} 
                className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors group"
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-white">{stock.ticker}</span>
                      {stock.change_percent !== null && (
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                          stock.change_percent > 0 
                            ? 'bg-green-900/50 text-green-400' 
                            : stock.change_percent < 0 
                              ? 'bg-red-900/50 text-red-400' 
                              : 'bg-gray-800 text-gray-400'
                        }`}>
                          {stock.change_percent > 0 ? '▲' : stock.change_percent < 0 ? '▼' : '–'} {Math.abs(stock.change_percent || 0).toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm truncate max-w-[200px]">{stock.name}</div>
                  </div>
                  <div className="text-right">
                    {stock.price && (
                      <div className="text-xl font-semibold text-white">${stock.price.toFixed(2)}</div>
                    )}
                    {stock.change !== null && (
                      <div className={`text-sm ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* News Section */}
                <div className="p-4">
                  {stock.has_news && stock.headlines.length > 0 ? (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Latest News ({stock.news_count})
                      </div>
                      <ul className="space-y-2">
                        {stock.headlines.slice(0, 2).map((headline, i) => (
                          <li key={i} className="text-sm text-gray-300 line-clamp-2">
                            • {headline}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      No significant news today. Trading normally.
                    </div>
                  )}
                </div>
                
                {/* Footer */}
                <div className="px-4 py-3 bg-gray-800/30 flex justify-between items-center">
                  <span className="text-xs text-gray-500">{stock.sector}</span>
                  <button
                    onClick={() => removeTicker(stock.ticker)}
                    disabled={loading}
                    className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from portfolio"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            
            {/* Show remaining tickers that might not have data yet */}
            {watchlist.filter(t => !portfolioData.find(p => p.ticker === t)).map((ticker) => (
              <div 
                key={ticker} 
                className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-between group"
              >
                <span className="text-xl font-bold text-white">{ticker}</span>
                <button
                  onClick={() => removeTicker(ticker)}
                  disabled={loading}
                  className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from portfolio"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Coming Soon Section */}
        <div className="mt-12 bg-gradient-to-r from-violet-900/20 to-purple-900/20 rounded-2xl border border-violet-800/30 p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">AI Analysis Coming Soon</h3>
              <p className="text-gray-400">
                We're building advanced AI-powered portfolio analysis including:
              </p>
              <ul className="mt-3 space-y-2 text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-violet-400">•</span>
                  Correlation analysis between your holdings
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-400">•</span>
                  Risk assessment and diversification scoring
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-400">•</span>
                  AI-generated insights based on your portfolio composition
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-400">•</span>
                  Historical backtesting of portfolio performance
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

