import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

const API_BASE = 'http://localhost:5001';

interface StockAnalysis {
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  key_themes: string[];
  price_context: string;
  notable_headline: string;
}

interface StockNews {
  ticker: string;
  company_name: string;
  sector: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  headlines: string[];
  news_count: number;
  analysis: StockAnalysis;
  error?: string;
}

export default function PortfolioNewsPage() {
  const router = useRouter();
  const { user, backendUser, signOut, isDevMode, loading: authLoading } = useAuth();
  
  const [stocks, setStocks] = useState<StockNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<string>('');
  const [hoursSinceRefresh, setHoursSinceRefresh] = useState<number | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch news on mount
  useEffect(() => {
    if (backendUser?.id) {
      fetchNews();
    }
  }, [backendUser?.id]);

  const fetchNews = async (forceRefresh = false) => {
    if (!backendUser?.id) return;
    
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const url = forceRefresh
        ? `${API_BASE}/api/users/${backendUser.id}/portfolio-news?force_refresh=true`
        : `${API_BASE}/api/users/${backendUser.id}/portfolio-news`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setStocks(data.stocks || []);
        setGeneratedAt(data.generated_at);
        setSource(data.source || '');
        setHoursSinceRefresh(data.hours_since_refresh);
        setNextRefreshIn(data.next_refresh_in_hours);
      }
    } catch (err: any) {
      console.error('News fetch error:', err);
      setError(err.message || 'Failed to fetch news');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchNews(true);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-400 bg-green-900/30';
      case 'bearish': return 'text-red-400 bg-red-900/30';
      case 'mixed': return 'text-yellow-400 bg-yellow-900/30';
      default: return 'text-gray-400 bg-gray-800';
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'Bullish';
      case 'bearish': return 'Bearish';
      case 'mixed': return 'Mixed';
      default: return 'Neutral';
    }
  };

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
        <title>Portfolio News | Prism</title>
        <meta name="description" content="AI-analyzed news for your portfolio holdings" />
      </Head>

      {/* Dev mode banner */}
      {isDevMode && (
        <div className="bg-yellow-900/50 text-yellow-300 text-xs text-center py-1 px-4">
          Dev Mode - Using mock authentication
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
                <a className="text-gray-400 hover:text-white transition-colors text-sm">
                  AI Portfolio
                </a>
              </Link>
              <Link href="/portfolio-news">
                <a className="text-white font-medium text-sm border-b-2 border-violet-500 pb-1">
                  Portfolio News
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
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Portfolio News</h1>
              <p className="text-gray-400">
                AI-analyzed headlines for each stock in your portfolio, explaining recent moves and key developments.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Refreshing...
                </>
              ) : (
                'Refresh News'
              )}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4"></div>
            <p className="text-gray-400">Fetching and analyzing news for your portfolio...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a moment</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading News</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => fetchNews()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && stocks.length === 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
            <h3 className="text-xl font-semibold text-white mb-2">No Holdings Found</h3>
            <p className="text-gray-400 mb-6">
              Add stocks to your portfolio to see AI-analyzed news for each holding.
            </p>
            <Link href="/profile?tab=portfolio">
              <a className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors inline-block">
                Add Holdings
              </a>
            </Link>
          </div>
        )}

        {/* News Results */}
        {!loading && !error && stocks.length > 0 && (
          <div className="space-y-6">
            {/* Cache Status Banner */}
            {source === 'cache' && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div>
                      <p className="text-gray-300 text-sm">
                        Showing cached news from {hoursSinceRefresh !== null ? `${Math.round(hoursSinceRefresh)} hour${Math.round(hoursSinceRefresh) !== 1 ? 's' : ''} ago` : 'earlier'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        Auto-refreshes daily. {nextRefreshIn !== null && `Next refresh in ~${Math.round(nextRefreshIn)} hours.`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="text-violet-400 hover:text-violet-300 text-sm font-medium"
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh Now'}
                  </button>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-gray-500 text-sm">Stocks Analyzed</div>
                <div className="text-2xl font-bold text-white">{stocks.length}</div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-gray-500 text-sm">Bullish Sentiment</div>
                <div className="text-2xl font-bold text-green-400">
                  {stocks.filter(s => s.analysis.sentiment === 'bullish').length}
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-gray-500 text-sm">Bearish Sentiment</div>
                <div className="text-2xl font-bold text-red-400">
                  {stocks.filter(s => s.analysis.sentiment === 'bearish').length}
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-gray-500 text-sm">Total Headlines</div>
                <div className="text-2xl font-bold text-white">
                  {stocks.reduce((sum, s) => sum + s.headlines.length, 0)}
                </div>
              </div>
            </div>

            {/* Stock Cards */}
            {stocks.map((stock) => (
              <div key={stock.ticker} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                {/* Stock Header */}
                <div className="p-6 border-b border-gray-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-2xl font-bold text-white">{stock.ticker}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(stock.analysis.sentiment)}`}>
                          {getSentimentLabel(stock.analysis.sentiment)}
                        </span>
                      </div>
                      <div className="text-gray-400">{stock.company_name}</div>
                      <div className="text-gray-500 text-sm">{stock.sector}</div>
                    </div>
                    {stock.price && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">${stock.price.toFixed(2)}</div>
                        {stock.change_percent !== null && (
                          <div className={`text-lg font-medium ${
                            stock.change_percent > 0 ? 'text-green-400' :
                            stock.change_percent < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {stock.change_percent > 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Analysis */}
                <div className="p-6 bg-gray-800/30">
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">AI Analysis</h4>
                  <p className="text-gray-200 mb-4">{stock.analysis.summary}</p>
                  
                  {stock.analysis.price_context && (
                    <div className="mb-4">
                      <span className="text-gray-500 text-sm">Price Context: </span>
                      <span className="text-gray-300 text-sm">{stock.analysis.price_context}</span>
                    </div>
                  )}

                  {stock.analysis.key_themes && stock.analysis.key_themes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {stock.analysis.key_themes.map((theme, i) => (
                        <span key={i} className="px-3 py-1 bg-violet-900/30 text-violet-300 text-sm rounded-full">
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}

                  {stock.analysis.notable_headline && (
                    <div className="p-3 bg-gray-900/50 rounded-lg border-l-4 border-violet-500">
                      <div className="text-gray-500 text-xs mb-1">Key Headline</div>
                      <p className="text-gray-300 text-sm">{stock.analysis.notable_headline}</p>
                    </div>
                  )}
                </div>

                {/* Headlines */}
                {stock.headlines.length > 0 && (
                  <div className="p-6 border-t border-gray-800">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Recent Headlines ({stock.news_count} total)
                    </h4>
                    <ul className="space-y-2">
                      {stock.headlines.map((headline, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300">
                          <span className="text-gray-600 mt-1">•</span>
                          <span>{headline}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Error Display */}
                {stock.error && (
                  <div className="px-6 pb-6">
                    <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
                      {stock.error}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Generated timestamp */}
            {generatedAt && (
              <div className="text-center text-gray-500 text-sm pt-4">
                {source === 'cache' ? 'News cached' : 'News fetched and analyzed'} at {new Date(generatedAt).toLocaleString()}
                {source === 'generated' && ' (fresh)'}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

