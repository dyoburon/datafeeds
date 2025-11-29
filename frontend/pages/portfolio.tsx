import { useState, useEffect, useMemo } from 'react';
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
  beta: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  headlines: string[];
  news_count: number;
  has_news: boolean;
  error?: string;
}

interface Position {
  ticker: string;
  shares: number;
}

interface PortfolioStats {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  portfolioBeta: number;
  weightedDividendYield: number;
  sectorAllocation: Record<string, number>;
  numberOfPositions: number;
  averagePE: number;
  largestPosition: { ticker: string; percent: number } | null;
  diversificationScore: number;
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
  
  // Portfolio size and positions state
  const [portfolioSize, setPortfolioSize] = useState<number>(100000);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [editingShares, setEditingShares] = useState<string | null>(null);
  const [tempShares, setTempShares] = useState<string>('');

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

  // Calculate portfolio statistics
  const portfolioStats = useMemo<PortfolioStats>(() => {
    if (portfolioData.length === 0) {
      return {
        totalValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        portfolioBeta: 0,
        weightedDividendYield: 0,
        sectorAllocation: {},
        numberOfPositions: 0,
        averagePE: 0,
        largestPosition: null,
        diversificationScore: 0,
      };
    }

    let totalValue = 0;
    let totalGainLoss = 0;
    let weightedBeta = 0;
    let weightedDividendYield = 0;
    let peSum = 0;
    let peCount = 0;
    const sectorAllocation: Record<string, number> = {};

    // Calculate position values
    const positionValues: { ticker: string; value: number; percent: number }[] = [];

    portfolioData.forEach((stock) => {
      const shares = positions[stock.ticker] || 0;
      const price = stock.price || 0;
      const positionValue = shares * price;
      totalValue += positionValue;

      if (stock.change !== null) {
        totalGainLoss += shares * stock.change;
      }

      positionValues.push({ ticker: stock.ticker, value: positionValue, percent: 0 });
    });

    // Calculate percentages
    positionValues.forEach((pos) => {
      pos.percent = totalValue > 0 ? (pos.value / totalValue) * 100 : 0;
    });

    // Find largest position
    const largestPosition = positionValues.reduce<{ ticker: string; percent: number } | null>(
      (largest, pos) => {
        if (!largest || pos.percent > largest.percent) {
          return { ticker: pos.ticker, percent: pos.percent };
        }
        return largest;
      },
      null
    );

    portfolioData.forEach((stock) => {
      const shares = positions[stock.ticker] || 0;
      const price = stock.price || 0;
      const positionValue = shares * price;
      const weight = totalValue > 0 ? positionValue / totalValue : 0;

      // Weighted beta
      if (stock.beta !== null && stock.beta !== undefined) {
        weightedBeta += stock.beta * weight;
      }

      // Weighted dividend yield
      if (stock.dividend_yield !== null && stock.dividend_yield !== undefined) {
        weightedDividendYield += stock.dividend_yield * weight;
      }

      // Average P/E
      if (stock.pe_ratio !== null && stock.pe_ratio !== undefined && stock.pe_ratio > 0) {
        peSum += stock.pe_ratio;
        peCount++;
      }

      // Sector allocation
      const sector = stock.sector || 'Unknown';
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + (weight * 100);
    });

    // Calculate diversification score (0-100)
    // Based on number of positions, sector diversity, and position concentration
    const numPositions = Object.values(positions).filter(s => s > 0).length;
    const numSectors = Object.keys(sectorAllocation).length;
    const maxPositionWeight = largestPosition?.percent || 0;
    
    let diversificationScore = 0;
    // Position count score (0-40): more positions = better, diminishing returns after 10
    diversificationScore += Math.min(40, numPositions * 4);
    // Sector diversity score (0-30): more sectors = better
    diversificationScore += Math.min(30, numSectors * 5);
    // Concentration score (0-30): lower max position = better
    diversificationScore += Math.max(0, 30 - maxPositionWeight);

    return {
      totalValue,
      totalGainLoss,
      totalGainLossPercent: totalValue > 0 ? (totalGainLoss / (totalValue - totalGainLoss)) * 100 : 0,
      portfolioBeta: weightedBeta,
      weightedDividendYield: weightedDividendYield * 100, // Convert to percentage
      sectorAllocation,
      numberOfPositions: numPositions,
      averagePE: peCount > 0 ? peSum / peCount : 0,
      largestPosition,
      diversificationScore: Math.min(100, Math.max(0, diversificationScore)),
    };
  }, [portfolioData, positions]);

  // Get position percentage of portfolio
  const getPositionPercent = (ticker: string): number => {
    const stock = portfolioData.find(s => s.ticker === ticker);
    if (!stock || !stock.price) return 0;
    const shares = positions[ticker] || 0;
    const positionValue = shares * stock.price;
    return portfolioStats.totalValue > 0 ? (positionValue / portfolioStats.totalValue) * 100 : 0;
  };

  // Get position value
  const getPositionValue = (ticker: string): number => {
    const stock = portfolioData.find(s => s.ticker === ticker);
    if (!stock || !stock.price) return 0;
    const shares = positions[ticker] || 0;
    return shares * stock.price;
  };

  const fetchPortfolioData = async () => {
    if (watchlist.length === 0) return;
    
    setDataLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/watchlist/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: watchlist, max_tickers: 50 }),
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
      // Also remove from positions
      const newPositions = { ...positions };
      delete newPositions[ticker];
      setPositions(newPositions);
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

  const updateShares = (ticker: string, shares: number) => {
    setPositions(prev => ({
      ...prev,
      [ticker]: Math.max(0, shares)
    }));
  };

  const startEditingShares = (ticker: string) => {
    setEditingShares(ticker);
    setTempShares(String(positions[ticker] || 0));
  };

  const finishEditingShares = () => {
    if (editingShares) {
      const shares = parseFloat(tempShares) || 0;
      updateShares(editingShares, shares);
    }
    setEditingShares(null);
    setTempShares('');
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

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
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
        <title>Instead AI Portfolio | Prism</title>
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
            <h1 className="text-3xl font-bold text-white">Instead AI Portfolio</h1>
          </div>
          <p className="text-gray-400 ml-13">
            Track and analyze your portfolio with AI-powered insights. Add stocks and enter your positions to see allocation percentages.
          </p>
        </div>

        {/* Portfolio Size Input */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Total Portfolio Size</h2>
              <p className="text-gray-500 text-sm">Enter your total investment capital to calculate position sizes</p>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
              <input
                type="text"
                value={portfolioSize.toLocaleString()}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setPortfolioSize(parseInt(value) || 0);
                }}
                className="w-full md:w-64 pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-right text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Portfolio Statistics Dashboard */}
        {portfolioData.length > 0 && Object.values(positions).some(s => s > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            {/* Total Portfolio Value */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Portfolio Value</div>
              <div className="text-xl font-bold text-white">{formatCurrency(portfolioStats.totalValue)}</div>
              <div className={`text-sm ${portfolioStats.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioStats.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalGainLoss)} today
              </div>
            </div>

            {/* Portfolio Beta */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Portfolio Beta</div>
              <div className="text-xl font-bold text-white">{portfolioStats.portfolioBeta.toFixed(2)}</div>
              <div className="text-sm text-gray-500">
                {portfolioStats.portfolioBeta > 1.2 ? 'High volatility' : 
                 portfolioStats.portfolioBeta < 0.8 ? 'Low volatility' : 'Moderate'}
              </div>
            </div>

            {/* Number of Positions */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Positions</div>
              <div className="text-xl font-bold text-white">{portfolioStats.numberOfPositions}</div>
              <div className="text-sm text-gray-500">active holdings</div>
            </div>

            {/* Average P/E */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg P/E Ratio</div>
              <div className="text-xl font-bold text-white">
                {portfolioStats.averagePE > 0 ? portfolioStats.averagePE.toFixed(1) : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">portfolio average</div>
            </div>

            {/* Dividend Yield */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Dividend Yield</div>
              <div className="text-xl font-bold text-white">
                {portfolioStats.weightedDividendYield > 0 ? `${portfolioStats.weightedDividendYield.toFixed(2)}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">weighted average</div>
            </div>

            {/* Diversification Score */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Diversification</div>
              <div className="text-xl font-bold text-white">{Math.round(portfolioStats.diversificationScore)}/100</div>
              <div className="text-sm text-gray-500">
                {portfolioStats.diversificationScore >= 70 ? 'Well diversified' : 
                 portfolioStats.diversificationScore >= 40 ? 'Moderate' : 'Concentrated'}
              </div>
            </div>
          </div>
        )}

        {/* Sector Allocation */}
        {portfolioData.length > 0 && Object.values(positions).some(s => s > 0) && Object.keys(portfolioStats.sectorAllocation).length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Sector Allocation</h3>
            <div className="space-y-3">
              {Object.entries(portfolioStats.sectorAllocation)
                .sort((a, b) => b[1] - a[1])
                .map(([sector, percent]) => (
                  <div key={sector} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-400 truncate">{sector}</div>
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium text-white">{percent.toFixed(1)}%</div>
                  </div>
                ))}
            </div>
          </div>
        )}

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
            Your Holdings 
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="space-y-4">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Stock</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Shares</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">% of Portfolio</div>
              <div className="col-span-1"></div>
            </div>

            {portfolioData.map((stock) => {
              const positionPercent = getPositionPercent(stock.ticker);
              const positionValue = getPositionValue(stock.ticker);
              const shares = positions[stock.ticker] || 0;
              
              return (
                <div 
                  key={stock.ticker} 
                  className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors group"
                >
                  {/* Desktop View */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 items-center">
                    {/* Stock Info */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-white">{stock.ticker}</span>
                            {stock.beta !== null && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                                β {stock.beta.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-500 text-sm truncate max-w-[200px]">{stock.name}</div>
                          <div className="text-gray-600 text-xs">{stock.sector}</div>
                        </div>
                      </div>
                    </div>

                    {/* Price & Change */}
                    <div className="col-span-2 text-right">
                      {stock.price && (
                        <div className="text-lg font-semibold text-white">${stock.price.toFixed(2)}</div>
                      )}
                      {stock.change_percent !== null && (
                        <div className={`text-sm font-medium ${
                          stock.change_percent > 0 ? 'text-green-400' : 
                          stock.change_percent < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {stock.change_percent > 0 ? '▲' : stock.change_percent < 0 ? '▼' : '–'} {Math.abs(stock.change_percent || 0).toFixed(2)}%
                        </div>
                      )}
                    </div>

                    {/* Shares Input */}
                    <div className="col-span-2 text-right">
                      {editingShares === stock.ticker ? (
                        <input
                          type="number"
                          value={tempShares}
                          onChange={(e) => setTempShares(e.target.value)}
                          onBlur={finishEditingShares}
                          onKeyDown={(e) => e.key === 'Enter' && finishEditingShares()}
                          className="w-24 px-2 py-1 bg-gray-800 border border-violet-500 rounded text-white text-right focus:outline-none"
                          autoFocus
                          step="0.001"
                        />
                      ) : (
                        <button
                          onClick={() => startEditingShares(stock.ticker)}
                          className="text-lg font-medium text-white hover:text-violet-400 transition-colors"
                        >
                          {shares > 0 ? shares.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                          <span className="text-xs text-gray-500 ml-1">shares</span>
                        </button>
                      )}
                    </div>

                    {/* Position Value */}
                    <div className="col-span-2 text-right">
                      <div className="text-lg font-medium text-white">
                        {positionValue > 0 ? formatCurrency(positionValue) : '—'}
                      </div>
                    </div>

                    {/* Portfolio % */}
                    <div className="col-span-2 text-right">
                      {positionPercent > 0 ? (
                        <div>
                          <div className="text-lg font-bold text-violet-400">{positionPercent.toFixed(1)}%</div>
                          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                            <div 
                              className="h-full bg-violet-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, positionPercent)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => removeTicker(stock.ticker)}
                        disabled={loading}
                        className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from portfolio"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">{stock.ticker}</span>
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
                        <div className="text-gray-400 text-sm">{stock.name}</div>
                      </div>
                      {stock.price && (
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white">${stock.price.toFixed(2)}</div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Shares</div>
                        {editingShares === stock.ticker ? (
                          <input
                            type="number"
                            value={tempShares}
                            onChange={(e) => setTempShares(e.target.value)}
                            onBlur={finishEditingShares}
                            onKeyDown={(e) => e.key === 'Enter' && finishEditingShares()}
                            className="w-full px-2 py-1 bg-gray-800 border border-violet-500 rounded text-white focus:outline-none text-sm"
                            autoFocus
                            step="0.001"
                          />
                        ) : (
                          <button
                            onClick={() => startEditingShares(stock.ticker)}
                            className="text-white font-medium hover:text-violet-400"
                          >
                            {shares > 0 ? shares.toLocaleString(undefined, { maximumFractionDigits: 3 }) : 'Add'}
                          </button>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Value</div>
                        <div className="text-white font-medium">
                          {positionValue > 0 ? formatCurrency(positionValue) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs mb-1">% Portfolio</div>
                        <div className="text-violet-400 font-bold">
                          {positionPercent > 0 ? `${positionPercent.toFixed(1)}%` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Additional metrics for mobile */}
                    <div className="flex gap-3 mt-3 text-xs">
                      {stock.beta !== null && (
                        <span className="px-2 py-1 bg-gray-800 rounded text-gray-400">
                          Beta: {stock.beta.toFixed(2)}
                        </span>
                      )}
                      {stock.pe_ratio !== null && (
                        <span className="px-2 py-1 bg-gray-800 rounded text-gray-400">
                          P/E: {stock.pe_ratio.toFixed(1)}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-gray-800 rounded text-gray-400">
                        {stock.sector}
                      </span>
                    </div>
                  </div>

                  {/* News Section - Both Views */}
                  {stock.has_news && stock.headlines.length > 0 && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Latest News ({stock.news_count})
                      </div>
                      <ul className="space-y-1">
                        {stock.headlines.slice(0, 2).map((headline, i) => (
                          <li key={i} className="text-sm text-gray-400 line-clamp-1">
                            • {headline}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Show remaining tickers that might not have data yet */}
            {watchlist.filter(t => !portfolioData.find(p => p.ticker === t)).map((ticker) => (
              <div 
                key={ticker} 
                className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between group"
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

        {/* Risk Analysis Section */}
        {portfolioData.length > 0 && Object.values(positions).some(s => s > 0) && (
          <div className="mt-8 bg-gradient-to-r from-gray-900 to-gray-900 rounded-2xl border border-gray-800 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Risk Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Beta Interpretation */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    portfolioStats.portfolioBeta > 1.2 ? 'bg-red-500' :
                    portfolioStats.portfolioBeta < 0.8 ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-gray-400 text-sm">Volatility Risk</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {portfolioStats.portfolioBeta > 1.2 ? 'High' :
                   portfolioStats.portfolioBeta < 0.8 ? 'Low' : 'Moderate'}
                </div>
                <p className="text-gray-500 text-sm">
                  {portfolioStats.portfolioBeta > 1.2 
                    ? 'Your portfolio is more volatile than the market. Expect larger swings.'
                    : portfolioStats.portfolioBeta < 0.8 
                    ? 'Your portfolio is less volatile than the market. More stable returns expected.'
                    : 'Your portfolio moves roughly in line with the market.'}
                </p>
              </div>

              {/* Concentration Risk */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    (portfolioStats.largestPosition?.percent || 0) > 30 ? 'bg-red-500' :
                    (portfolioStats.largestPosition?.percent || 0) > 20 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <span className="text-gray-400 text-sm">Concentration Risk</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {(portfolioStats.largestPosition?.percent || 0) > 30 ? 'High' :
                   (portfolioStats.largestPosition?.percent || 0) > 20 ? 'Moderate' : 'Low'}
                </div>
                <p className="text-gray-500 text-sm">
                  {portfolioStats.largestPosition 
                    ? `Largest position: ${portfolioStats.largestPosition.ticker} at ${portfolioStats.largestPosition.percent.toFixed(1)}%`
                    : 'No positions yet'}
                </p>
              </div>

              {/* Sector Diversity */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    Object.keys(portfolioStats.sectorAllocation).length >= 5 ? 'bg-green-500' :
                    Object.keys(portfolioStats.sectorAllocation).length >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-400 text-sm">Sector Diversity</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {Object.keys(portfolioStats.sectorAllocation).length} Sectors
                </div>
                <p className="text-gray-500 text-sm">
                  {Object.keys(portfolioStats.sectorAllocation).length >= 5
                    ? 'Good sector diversification across your holdings.'
                    : 'Consider adding stocks from different sectors.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {portfolioData.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => {
                // Calculate equal weight allocation
                const equalWeight = portfolioSize / watchlist.length;
                const newPositions: Record<string, number> = {};
                portfolioData.forEach(stock => {
                  if (stock.price && stock.price > 0) {
                    newPositions[stock.ticker] = parseFloat((equalWeight / stock.price).toFixed(3));
                  }
                });
                setPositions(newPositions);
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Equal Weight Portfolio
            </button>
            <button
              onClick={() => setPositions({})}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Clear All Positions
            </button>
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
