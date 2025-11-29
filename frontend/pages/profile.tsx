import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import {
  calculatePortfolioAnalytics,
  HoldingWithPrice,
  PortfolioAnalytics,
  formatRatio,
  interpretSharpeRatio,
  interpretTreynorRatio,
  interpretWinRate,
  isCashTicker,
  isBondTicker,
} from '../utils/portfolioAnalytics';

const API_BASE = 'http://localhost:5001';

interface KnowledgeAssessment {
  basic_concepts: number;
  portfolio_management: number;
  market_mechanics: number;
  fundamental_analysis: number;
  technical_analysis: number;
  options_derivatives: number;
  tax_strategies: number;
  macroeconomics: number;
}

interface UserContext {
  investment_philosophy: string;
  goals: string;
  risk_tolerance: string;
  time_horizon: string;
  income_level: string;
  age_range: string;
  investment_experience: string;
  knowledge_assessment: KnowledgeAssessment;
  notes: string;
}

interface Holding {
  id?: number;
  ticker: string;
  shares: number;
  cost_basis?: number;
  purchase_date?: string;
  account_type: string;
  notes?: string;
}

interface TickerData {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  beta: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
}

interface PortfolioStats {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  portfolioBeta: number;
  weightedDividendYield: number;
  sectorAllocation: Record<string, number>;
  numberOfPositions: number;
  averagePE: number;
  largestPosition: { ticker: string; percent: number } | null;
  diversificationScore: number;
}

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative', description: 'Prioritize capital preservation over growth' },
  { value: 'moderate', label: 'Moderate', description: 'Balance between growth and stability' },
  { value: 'aggressive', label: 'Aggressive', description: 'Maximize growth, accept higher volatility' },
];

const HORIZON_OPTIONS = [
  { value: 'short', label: 'Short (1-3 years)', description: 'Need funds relatively soon' },
  { value: 'medium', label: 'Medium (3-10 years)', description: 'Building towards a mid-term goal' },
  { value: 'long', label: 'Long (10+ years)', description: 'Long-term wealth building' },
];

const ACCOUNT_TYPES = [
  { value: 'taxable', label: 'Taxable Brokerage' },
  { value: 'ira', label: 'Traditional IRA' },
  { value: 'roth_ira', label: 'Roth IRA' },
  { value: '401k', label: '401(k)' },
];

// Knowledge categories with descriptions and example topics
const KNOWLEDGE_CATEGORIES = [
  {
    id: 'basic_concepts',
    name: 'Basic Investment Concepts',
    description: 'Foundational knowledge',
    topics: ['Stocks vs bonds', 'ETFs & mutual funds', 'Dividends', 'Compound interest', 'Risk vs return'],
    icon: '📚',
  },
  {
    id: 'portfolio_management',
    name: 'Portfolio Management',
    description: 'Building & managing portfolios',
    topics: ['Asset allocation', 'Diversification', 'Rebalancing', 'Dollar-cost averaging', 'Index investing'],
    icon: '📊',
  },
  {
    id: 'market_mechanics',
    name: 'Market Mechanics',
    description: 'How markets work',
    topics: ['Order types (market, limit, stop)', 'Bid/ask spreads', 'Market hours', 'Settlement', 'Market makers'],
    icon: '⚙️',
  },
  {
    id: 'fundamental_analysis',
    name: 'Fundamental Analysis',
    description: 'Analyzing company value',
    topics: ['P/E ratios', 'Revenue & earnings', 'Balance sheets', 'Cash flow', 'Valuation methods'],
    icon: '🔍',
  },
  {
    id: 'technical_analysis',
    name: 'Technical Analysis',
    description: 'Chart patterns & indicators',
    topics: ['Support/resistance', 'Moving averages', 'RSI & MACD', 'Volume analysis', 'Chart patterns'],
    icon: '📈',
  },
  {
    id: 'options_derivatives',
    name: 'Options & Derivatives',
    description: 'Advanced instruments',
    topics: ['Calls & puts', 'Options Greeks', 'Covered calls', 'Spreads', 'Futures basics'],
    icon: '🎯',
  },
  {
    id: 'tax_strategies',
    name: 'Tax-Efficient Investing',
    description: 'Tax optimization',
    topics: ['Tax-loss harvesting', 'Long vs short-term gains', 'Tax-advantaged accounts', 'Wash sale rules', 'ROTH conversions'],
    icon: '💰',
  },
  {
    id: 'macroeconomics',
    name: 'Macroeconomics & Cycles',
    description: 'Big picture understanding',
    topics: ['Interest rates & Fed policy', 'Inflation', 'Economic indicators', 'Market cycles', 'Sector rotation'],
    icon: '🌍',
  },
];

const KNOWLEDGE_LEVELS = [
  { value: 0, label: 'No knowledge', color: 'bg-gray-600' },
  { value: 1, label: 'Heard of it', color: 'bg-red-500' },
  { value: 2, label: 'Basic understanding', color: 'bg-orange-500' },
  { value: 3, label: 'Can apply it', color: 'bg-yellow-500' },
  { value: 4, label: 'Proficient', color: 'bg-lime-500' },
  { value: 5, label: 'Expert', color: 'bg-green-500' },
];

const defaultKnowledge: KnowledgeAssessment = {
  basic_concepts: 0,
  portfolio_management: 0,
  market_mechanics: 0,
  fundamental_analysis: 0,
  technical_analysis: 0,
  options_derivatives: 0,
  tax_strategies: 0,
  macroeconomics: 0,
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, backendUser, signOut, isDevMode, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'context' | 'knowledge' | 'portfolio'>('context');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Context form state
  const [context, setContext] = useState<UserContext>({
    investment_philosophy: '',
    goals: '',
    risk_tolerance: 'moderate',
    time_horizon: 'medium',
    income_level: '',
    age_range: '',
    investment_experience: 'beginner',
    knowledge_assessment: { ...defaultKnowledge },
    notes: '',
  });
  
  // Holdings state
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [newHolding, setNewHolding] = useState<Holding>({
    ticker: '',
    shares: 0,
    cost_basis: undefined,
    account_type: 'taxable',
  });

  // Portfolio pricing state
  const [portfolioSize, setPortfolioSize] = useState<number>(0);
  const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
  const [priceLoading, setPriceLoading] = useState(false);

  // Editing shares state
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [editingShares, setEditingShares] = useState<string>('');

  // Max drawdown state
  const [maxDrawdownData, setMaxDrawdownData] = useState<{
    max_drawdown: number;
    peak_value: number;
    trough_value: number;
    peak_date: string | null;
    trough_date: string | null;
  } | null>(null);
  const [drawdownLoading, setDrawdownLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch user context and holdings
  useEffect(() => {
    if (backendUser?.id) {
      fetchContext();
      fetchHoldings();
    }
  }, [backendUser]);

  // Fetch prices when holdings change
  useEffect(() => {
    if (holdings.length > 0) {
      fetchPrices();
      fetchMaxDrawdown();
    }
  }, [holdings]);

  const fetchContext = async () => {
    if (!backendUser?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/context`);
      if (response.ok) {
        const data = await response.json();
        setContext({
          investment_philosophy: data.investment_philosophy || '',
          goals: data.goals || '',
          risk_tolerance: data.risk_tolerance || 'moderate',
          time_horizon: data.time_horizon || 'medium',
          income_level: data.income_level || '',
          age_range: data.age_range || '',
          investment_experience: data.investment_experience || 'beginner',
          knowledge_assessment: data.knowledge_assessment || { ...defaultKnowledge },
          notes: data.notes || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch context:', err);
    }
  };

  const fetchHoldings = async () => {
    if (!backendUser?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/holdings`);
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
      }
    } catch (err) {
      console.error('Failed to fetch holdings:', err);
    }
  };

  // Check if a holding is cash
  const isCash = (ticker: string) => {
    return ticker.toUpperCase() === 'CASH' || ticker.toUpperCase() === '$CASH';
  };

  const fetchPrices = async () => {
    if (holdings.length === 0) return;
    
    setPriceLoading(true);
    try {
      // Filter out cash holdings - they don't need price fetching
      const tickers = holdings.filter(h => !isCash(h.ticker)).map(h => h.ticker);
      
      if (tickers.length > 0) {
        const response = await fetch(`${API_BASE}/api/watchlist/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers, max_tickers: 50 }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const priceMap: Record<string, TickerData> = {};
          (data.tickers || []).forEach((t: TickerData) => {
            priceMap[t.ticker] = t;
          });
          setTickerData(priceMap);
        }
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err);
    } finally {
      setPriceLoading(false);
    }
  };

  const fetchMaxDrawdown = async () => {
    if (holdings.length === 0) return;
    
    setDrawdownLoading(true);
    try {
      // Transform holdings for the API
      const holdingsPayload = holdings.map(h => ({
        ticker: h.ticker,
        shares: h.shares,
        isCash: isCash(h.ticker),
      }));
      
      const response = await fetch(`${API_BASE}/api/portfolio/max-drawdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: holdingsPayload, months: 24 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMaxDrawdownData({
          max_drawdown: data.max_drawdown || 0,
          peak_value: data.peak_value || 0,
          trough_value: data.trough_value || 0,
          peak_date: data.peak_date || null,
          trough_date: data.trough_date || null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch max drawdown:', err);
    } finally {
      setDrawdownLoading(false);
    }
  };

  // Calculate portfolio statistics
  const portfolioStats = useMemo<PortfolioStats>(() => {
    if (holdings.length === 0) {
      return {
        totalValue: 0,
        totalCostBasis: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
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
    let totalCostBasis = 0;
    let dayChange = 0;
    let weightedBeta = 0;
    let weightedDividendYield = 0;
    let peSum = 0;
    let peCount = 0;
    const sectorAllocation: Record<string, number> = {};

    // Calculate position values
    const positionValues: { ticker: string; value: number; percent: number }[] = [];

    holdings.forEach((holding) => {
      // Handle cash specially - price is always $1 per unit (shares = dollars)
      const holdingIsCash = isCash(holding.ticker);
      const data = tickerData[holding.ticker];
      const price = holdingIsCash ? 1 : (data?.price || 0);
      const positionValue = holding.shares * price;
      totalValue += positionValue;

      if (holding.cost_basis) {
        totalCostBasis += holding.shares * (holdingIsCash ? 1 : holding.cost_basis);
      } else if (holdingIsCash) {
        // For cash, cost basis = current value (no gain/loss)
        totalCostBasis += positionValue;
      }

      // Cash doesn't have daily change
      if (!holdingIsCash && data?.change) {
        dayChange += holding.shares * data.change;
      }

      positionValues.push({ ticker: holding.ticker, value: positionValue, percent: 0 });
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

    // Calculate weighted metrics
    holdings.forEach((holding) => {
      const holdingIsCash = isCash(holding.ticker);
      const data = tickerData[holding.ticker];
      const price = holdingIsCash ? 1 : (data?.price || 0);
      const positionValue = holding.shares * price;
      const weight = totalValue > 0 ? positionValue / totalValue : 0;

      // Calculate beta: Cash = 0, Bonds = 0.2, Stocks = 1.0 (if unknown)
      if (holdingIsCash) {
        // Cash contributes 0 to weighted beta
      } else if (data?.beta !== null && data?.beta !== undefined) {
        // Use actual beta from data
        weightedBeta += data.beta * weight;
      } else if (isBondTicker(holding.ticker)) {
        // Bonds default to low beta (~0.2) - low correlation to stock market
        weightedBeta += 0.2 * weight;
      } else {
        // Stocks default to market beta (1.0)
        weightedBeta += 1.0 * weight;
      }

      // Cash has no dividend yield
      if (!holdingIsCash && data?.dividend_yield !== null && data?.dividend_yield !== undefined) {
        weightedDividendYield += data.dividend_yield * weight;
      }

      // Cash has no P/E ratio
      if (!holdingIsCash && data?.pe_ratio !== null && data?.pe_ratio !== undefined && data.pe_ratio > 0) {
        peSum += data.pe_ratio;
        peCount++;
      }

      // Categorize cash under "Cash" sector
      const sector = holdingIsCash ? 'Cash' : (data?.sector || 'Unknown');
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + (weight * 100);
    });

    // Calculate total gain/loss
    const totalGainLoss = totalCostBasis > 0 ? totalValue - totalCostBasis : 0;
    const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
    const dayChangePercent = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

    // Calculate diversification score
    const numPositions = holdings.length;
    const numSectors = Object.keys(sectorAllocation).length;
    const maxPositionWeight = largestPosition?.percent || 0;
    
    let diversificationScore = 0;
    diversificationScore += Math.min(40, numPositions * 4);
    diversificationScore += Math.min(30, numSectors * 5);
    diversificationScore += Math.max(0, 30 - maxPositionWeight);

    return {
      totalValue,
      totalCostBasis,
      totalGainLoss,
      totalGainLossPercent,
      dayChange,
      dayChangePercent,
      portfolioBeta: weightedBeta,
      weightedDividendYield: weightedDividendYield * 100,
      sectorAllocation,
      numberOfPositions: numPositions,
      averagePE: peCount > 0 ? peSum / peCount : 0,
      largestPosition,
      diversificationScore: Math.min(100, Math.max(0, diversificationScore)),
    };
  }, [holdings, tickerData]);

  // Calculate advanced portfolio analytics
  const portfolioAnalytics = useMemo<PortfolioAnalytics | null>(() => {
    if (holdings.length === 0) return null;

    // Transform holdings to the format expected by analytics
    const holdingsWithPrice: HoldingWithPrice[] = holdings.map(h => {
      const holdingIsCash = isCash(h.ticker);
      const data = tickerData[h.ticker];
      
      return {
        ticker: h.ticker,
        shares: h.shares,
        costBasis: h.cost_basis || null,
        currentPrice: holdingIsCash ? 1 : (data?.price || 0),
        beta: holdingIsCash ? 0 : (data?.beta || null),
        isCash: holdingIsCash,
      };
    });

    return calculatePortfolioAnalytics(holdingsWithPrice);
  }, [holdings, tickerData]);

  // Update portfolio size when total value changes
  useEffect(() => {
    if (portfolioStats.totalValue > 0) {
      setPortfolioSize(portfolioStats.totalValue);
    }
  }, [portfolioStats.totalValue]);

  const saveContext = async () => {
    if (!backendUser?.id) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile saved successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const addHolding = async () => {
    if (!backendUser?.id || !newHolding.ticker || !newHolding.shares) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHolding),
      });
      
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
        setNewHolding({ ticker: '', shares: 0, cost_basis: undefined, account_type: 'taxable' });
        setMessage({ type: 'success', text: 'Holding added!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to add holding' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add holding' });
    } finally {
      setSaving(false);
    }
  };

  const deleteHolding = async (holdingId: number) => {
    if (!backendUser?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/holdings/${holdingId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
      }
    } catch (err) {
      console.error('Failed to delete holding:', err);
    }
  };

  const updateHoldingShares = async (holdingId: number, newShares: number) => {
    if (!backendUser?.id || newShares <= 0) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/users/${backendUser.id}/holdings/${holdingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares: newShares }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setHoldings(data.holdings || []);
      }
    } catch (err) {
      console.error('Failed to update holding:', err);
    }
  };

  const startEditingShares = (holdingId: number, currentShares: number) => {
    setEditingHoldingId(holdingId);
    setEditingShares(String(currentShares));
  };

  const finishEditingShares = () => {
    if (editingHoldingId !== null) {
      const newShares = parseFloat(editingShares);
      if (!isNaN(newShares) && newShares > 0) {
        updateHoldingShares(editingHoldingId, newShares);
      }
    }
    setEditingHoldingId(null);
    setEditingShares('');
  };

  const cancelEditingShares = () => {
    setEditingHoldingId(null);
    setEditingShares('');
  };

  const updateKnowledge = (categoryId: string, value: number) => {
    setContext(prev => ({
      ...prev,
      knowledge_assessment: {
        ...prev.knowledge_assessment,
        [categoryId]: value,
      },
    }));
  };

  // Calculate overall knowledge score
  const getOverallScore = () => {
    const scores = Object.values(context.knowledge_assessment);
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20);
  };

  // Get experience level based on knowledge scores
  const getComputedExperience = () => {
    const score = getOverallScore();
    if (score >= 80) return 'Expert';
    if (score >= 60) return 'Advanced';
    if (score >= 40) return 'Intermediate';
    if (score >= 20) return 'Beginner';
    return 'New Investor';
  };

  // Format currency
  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Format large numbers
  const formatCompact = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Get position percentage
  const getPositionPercent = (ticker: string): number => {
    const holding = holdings.find(h => h.ticker === ticker);
    if (!holding) return 0;
    
    // Cash is $1 per share
    const holdingIsCash = isCash(ticker);
    const data = tickerData[ticker];
    const price = holdingIsCash ? 1 : (data?.price || 0);
    if (price === 0) return 0;
    
    const positionValue = holding.shares * price;
    return portfolioStats.totalValue > 0 ? (positionValue / portfolioStats.totalValue) * 100 : 0;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Head>
        <title>Your Profile | Prism</title>
        <meta name="description" content="Configure your investment profile and portfolio" />
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
              <a className="text-xl font-bold text-emerald-400">Prism</a>
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
              <Link href="/profile">
                <a className="text-white font-medium text-sm border-b-2 border-emerald-500 pb-1">
                  Your Profile
                </a>
              </Link>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-sm font-medium">
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
          <h1 className="text-3xl font-bold text-white mb-2">Your Investment Profile</h1>
          <p className="text-gray-400">
            Help us understand your investment style to provide personalized recommendations.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-900/30 border border-green-800 text-green-300' 
              : 'bg-red-900/30 border border-red-800 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('context')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'context'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Philosophy & Goals
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'knowledge'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Knowledge Assessment
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'portfolio'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Current Portfolio
          </button>
        </div>

        {/* Context Tab */}
        {activeTab === 'context' && (
          <div className="space-y-8">
            {/* Investment Philosophy */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Investment Philosophy</h2>
              <textarea
                value={context.investment_philosophy}
                onChange={(e) => setContext({ ...context, investment_philosophy: e.target.value })}
                placeholder="Describe your investment approach. What matters most to you? Value investing, growth stocks, index funds, dividends? What's your strategy?"
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Goals */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Financial Goals</h2>
              <textarea
                value={context.goals}
                onChange={(e) => setContext({ ...context, goals: e.target.value })}
                placeholder="What are you investing for? Retirement, buying a home, financial independence, generating passive income? Be specific about your goals and timeline."
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Risk Tolerance */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Risk Tolerance</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {RISK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setContext({ ...context, risk_tolerance: option.value })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      context.risk_tolerance === option.value
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-white">{option.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Horizon */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Investment Time Horizon</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {HORIZON_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setContext({ ...context, time_horizon: option.value })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      context.time_horizon === option.value
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-white">{option.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Additional Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Age Range</label>
                  <select
                    value={context.age_range}
                    onChange={(e) => setContext({ ...context, age_range: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="18-25">18-25</option>
                    <option value="26-35">26-35</option>
                    <option value="36-45">36-45</option>
                    <option value="46-55">46-55</option>
                    <option value="56-65">56-65</option>
                    <option value="65+">65+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Annual Income Range</label>
                  <select
                    value={context.income_level}
                    onChange={(e) => setContext({ ...context, income_level: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="under-50k">Under $50,000</option>
                    <option value="50k-100k">$50,000 - $100,000</option>
                    <option value="100k-200k">$100,000 - $200,000</option>
                    <option value="200k-500k">$200,000 - $500,000</option>
                    <option value="500k+">$500,000+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Additional Notes</label>
                <textarea
                  value={context.notes}
                  onChange={(e) => setContext({ ...context, notes: e.target.value })}
                  placeholder="Anything else we should know about your situation? Special circumstances, constraints, or preferences?"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveContext}
                disabled={saving}
                className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}

        {/* Knowledge Assessment Tab */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            {/* Overall Score Card */}
            <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl border border-emerald-800/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Your Knowledge Profile</h2>
                  <p className="text-gray-400 text-sm mt-1">Based on your self-assessment across {KNOWLEDGE_CATEGORIES.length} areas</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-emerald-400">{getOverallScore()}</div>
                  <div className="text-sm text-gray-400">out of 100</div>
                  <div className="text-sm font-medium text-emerald-300 mt-1">{getComputedExperience()}</div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Rate Your Knowledge</h3>
              <p className="text-gray-400 text-sm mb-4">
                For each category, rate how well you understand the concepts. Be honest – this helps us tailor recommendations to your actual knowledge level.
              </p>
              <div className="flex flex-wrap gap-2">
                {KNOWLEDGE_LEVELS.map((level) => (
                  <div key={level.value} className="flex items-center gap-2 text-xs">
                    <div className={`w-3 h-3 rounded ${level.color}`}></div>
                    <span className="text-gray-400">{level.value} = {level.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Knowledge Categories */}
            <div className="space-y-4">
              {KNOWLEDGE_CATEGORIES.map((category) => {
                const currentValue = context.knowledge_assessment[category.id as keyof KnowledgeAssessment] || 0;
                const level = KNOWLEDGE_LEVELS.find(l => l.value === currentValue) || KNOWLEDGE_LEVELS[0];
                
                return (
                  <div key={category.id} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{category.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                            <p className="text-sm text-gray-500">{category.description}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${level.color} text-white`}>
                            {level.label}
                          </div>
                        </div>
                        
                        {/* Topics */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {category.topics.map((topic, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded">
                              {topic}
                            </span>
                          ))}
                        </div>
                        
                        {/* Slider */}
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="5"
                            step="1"
                            value={currentValue}
                            onChange={(e) => updateKnowledge(category.id, parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                          <div className="w-8 text-center text-lg font-bold text-emerald-400">{currentValue}</div>
                        </div>
                        
                        {/* Level labels */}
                        <div className="flex justify-between mt-1 text-xs text-gray-600">
                          <span>No knowledge</span>
                          <span>Expert</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveContext}
                disabled={saving}
                className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Knowledge Assessment'}
              </button>
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            {/* Portfolio Summary Stats */}
            {holdings.length > 0 && (
              <>
                {/* Main Value Card */}
                <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl border border-emerald-800/50 p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Total Portfolio Value</div>
                      <div className="text-4xl font-bold text-white">
                        {priceLoading ? (
                          <span className="animate-pulse">Loading...</span>
                        ) : (
                          formatCurrency(portfolioStats.totalValue)
                        )}
                      </div>
                      {portfolioStats.totalCostBasis > 0 && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`text-lg font-semibold ${portfolioStats.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {portfolioStats.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalGainLoss)}
                          </span>
                          <span className={`text-sm px-2 py-0.5 rounded ${portfolioStats.totalGainLoss >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {portfolioStats.totalGainLossPercent >= 0 ? '+' : ''}{portfolioStats.totalGainLossPercent.toFixed(2)}% all time
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400 text-sm mb-1">Today's Change</div>
                      <div className={`text-2xl font-bold ${portfolioStats.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {portfolioStats.dayChange >= 0 ? '+' : ''}{formatCurrency(portfolioStats.dayChange)}
                      </div>
                      <div className={`text-sm ${portfolioStats.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {portfolioStats.dayChangePercent >= 0 ? '+' : ''}{portfolioStats.dayChangePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Portfolio Beta</div>
                    <div className="text-2xl font-bold text-white">{portfolioStats.portfolioBeta.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">
                      {portfolioStats.portfolioBeta > 1.2 ? 'High risk' : 
                       portfolioStats.portfolioBeta < 0.8 ? 'Low risk' : 'Moderate'}
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Positions</div>
                    <div className="text-2xl font-bold text-white">{portfolioStats.numberOfPositions}</div>
                    <div className="text-sm text-gray-500">holdings</div>
                  </div>

                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg P/E Ratio</div>
                    <div className="text-2xl font-bold text-white">
                      {portfolioStats.averagePE > 0 ? portfolioStats.averagePE.toFixed(1) : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">portfolio avg</div>
                  </div>

                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Diversification</div>
                    <div className="text-2xl font-bold text-white">{Math.round(portfolioStats.diversificationScore)}</div>
                    <div className="text-sm text-gray-500">score /100</div>
                  </div>
                </div>

                {/* Sector Allocation */}
                {Object.keys(portfolioStats.sectorAllocation).length > 0 && (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Sector Allocation</h3>
                    <div className="space-y-3">
                      {Object.entries(portfolioStats.sectorAllocation)
                        .sort((a, b) => b[1] - a[1])
                        .map(([sector, percent]) => (
                          <div key={sector} className="flex items-center gap-4">
                            <div className="w-28 text-sm text-gray-400 truncate">{sector}</div>
                            <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>
                            <div className="w-14 text-right text-sm font-medium text-white">{percent.toFixed(1)}%</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Risk Analysis */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Risk Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${
                          portfolioStats.portfolioBeta > 1.2 ? 'bg-red-500' :
                          portfolioStats.portfolioBeta < 0.8 ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-gray-400 text-sm">Volatility</span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {portfolioStats.portfolioBeta > 1.2 ? 'High' :
                         portfolioStats.portfolioBeta < 0.8 ? 'Low' : 'Moderate'}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Beta: {portfolioStats.portfolioBeta.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${
                          (portfolioStats.largestPosition?.percent || 0) > 30 ? 'bg-red-500' :
                          (portfolioStats.largestPosition?.percent || 0) > 20 ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <span className="text-gray-400 text-sm">Concentration</span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {(portfolioStats.largestPosition?.percent || 0) > 30 ? 'High' :
                         (portfolioStats.largestPosition?.percent || 0) > 20 ? 'Moderate' : 'Low'}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {portfolioStats.largestPosition 
                          ? `Largest: ${portfolioStats.largestPosition.ticker} (${portfolioStats.largestPosition.percent.toFixed(1)}%)`
                          : 'No positions'}
                      </p>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${
                          Object.keys(portfolioStats.sectorAllocation).length >= 5 ? 'bg-green-500' :
                          Object.keys(portfolioStats.sectorAllocation).length >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-gray-400 text-sm">Sector Diversity</span>
                      </div>
                      <div className="text-xl font-bold text-white">
                        {Object.keys(portfolioStats.sectorAllocation).length} Sectors
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {Object.keys(portfolioStats.sectorAllocation).length >= 5
                          ? 'Well diversified'
                          : 'Consider more sectors'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Advanced Portfolio Analytics */}
                {portfolioAnalytics && (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="text-lg font-semibold text-white mb-6">Portfolio Analytics</h3>
                    
                    {/* Performance Metrics */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Performance</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-500 text-xs mb-1">Nominal Return</div>
                          <div className={`text-xl font-bold ${portfolioAnalytics.nominalPerformancePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(portfolioAnalytics.nominalPerformancePercent * 100).toFixed(2)}%
                          </div>
                          <div className={`text-sm ${portfolioAnalytics.nominalPerformanceDollars >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {portfolioAnalytics.nominalPerformanceDollars >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.nominalPerformanceDollars)}
                          </div>
                        </div>
                        
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-500 text-xs mb-1">After-Tax Return</div>
                          <div className={`text-xl font-bold ${portfolioAnalytics.afterTaxRRPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(portfolioAnalytics.afterTaxRRPercent * 100).toFixed(2)}%
                          </div>
                          <div className={`text-sm ${portfolioAnalytics.afterTaxRRDollars >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {portfolioAnalytics.afterTaxRRDollars >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.afterTaxRRDollars)}
                          </div>
                        </div>
                        
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-500 text-xs mb-1">vs S&P 500</div>
                          <div className={`text-xl font-bold ${portfolioAnalytics.rrAboveBenchmarkPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {portfolioAnalytics.rrAboveBenchmarkPercent >= 0 ? '+' : ''}{(portfolioAnalytics.rrAboveBenchmarkPercent * 100).toFixed(2)}%
                          </div>
                          <div className={`text-sm ${portfolioAnalytics.rrAboveBenchmarkDollars >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            {portfolioAnalytics.rrAboveBenchmarkDollars >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.rrAboveBenchmarkDollars)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Risk-Adjusted Metrics */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Risk-Adjusted Returns</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Sharpe Ratio */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-gray-500 text-xs">Sharpe Ratio</div>
                            <div className="group relative">
                              <span className="text-gray-600 cursor-help">ⓘ</span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Measures risk-adjusted return. Higher is better. &gt;1.0 is good, &gt;2.0 is excellent.
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {formatRatio(portfolioAnalytics.sharpeRatio)}
                          </div>
                          {portfolioAnalytics.sharpeRatio !== null && (
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                              interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'green' ? 'bg-green-900/50 text-green-400' :
                              interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'lime' ? 'bg-lime-900/50 text-lime-400' :
                              interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
                              interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'orange' ? 'bg-orange-900/50 text-orange-400' :
                              interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'red' ? 'bg-red-900/50 text-red-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {interpretSharpeRatio(portfolioAnalytics.sharpeRatio).label}
                            </div>
                          )}
                        </div>

                        {/* Sortino Ratio */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-gray-500 text-xs">Sortino Ratio</div>
                            <div className="group relative">
                              <span className="text-gray-600 cursor-help">ⓘ</span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Like Sharpe but only penalizes downside volatility. Better for asymmetric returns.
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {formatRatio(portfolioAnalytics.sortinoRatio)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">downside-adjusted</div>
                        </div>

                        {/* Treynor Ratio */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-gray-500 text-xs">Treynor Ratio</div>
                            <div className="group relative">
                              <span className="text-gray-600 cursor-help">ⓘ</span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Return per unit of market risk (beta). Compare to S&P's ~5.5%.
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {portfolioAnalytics.treynorRatio !== null 
                              ? `${(portfolioAnalytics.treynorRatio * 100).toFixed(1)}%`
                              : 'N/A'
                            }
                          </div>
                          {portfolioAnalytics.treynorRatio !== null && (
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                              interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'green' ? 'bg-green-900/50 text-green-400' :
                              interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'lime' ? 'bg-lime-900/50 text-lime-400' :
                              interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
                              interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'orange' ? 'bg-orange-900/50 text-orange-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {interpretTreynorRatio(portfolioAnalytics.treynorRatio).label}
                            </div>
                          )}
                        </div>

                        {/* CAPM Expected Return */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-gray-500 text-xs">CAPM Expected</div>
                            <div className="group relative">
                              <span className="text-gray-600 cursor-help">ⓘ</span>
                              <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                Expected return based on portfolio beta. Rf + β(Rm - Rf)
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {(portfolioAnalytics.portfolioCAPM * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500 mt-1">annual expected</div>
                        </div>
                      </div>
                    </div>

                    {/* Risk & Win/Loss Metrics */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Risk & Position Analysis</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Portfolio Beta */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-500 text-xs mb-1">Portfolio Beta</div>
                          <div className="text-2xl font-bold text-white">
                            {portfolioAnalytics.portfolioBeta.toFixed(2)}
                          </div>
                          <div className={`text-xs mt-1 ${
                            portfolioAnalytics.portfolioBeta > 1.2 ? 'text-red-400' :
                            portfolioAnalytics.portfolioBeta < 0.8 ? 'text-green-400' :
                            'text-yellow-400'
                          }`}>
                            {portfolioAnalytics.portfolioBeta > 1.2 ? 'High volatility' :
                             portfolioAnalytics.portfolioBeta < 0.8 ? 'Low volatility' :
                             'Market-like'}
                          </div>
                        </div>

                        {/* Max Drawdown */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-gray-500 text-xs">Max Drawdown</div>
                            {maxDrawdownData?.peak_date && maxDrawdownData?.trough_date && (
                              <div className="group relative">
                                <span className="text-gray-600 cursor-help">ⓘ</span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  Peak: {maxDrawdownData.peak_date}<br/>
                                  Trough: {maxDrawdownData.trough_date}
                                </div>
                              </div>
                            )}
                          </div>
                          {drawdownLoading ? (
                            <div className="text-xl font-bold text-gray-500 animate-pulse">Loading...</div>
                          ) : maxDrawdownData ? (
                            <>
                              <div className={`text-2xl font-bold ${
                                maxDrawdownData.max_drawdown > 0.2 ? 'text-red-400' :
                                maxDrawdownData.max_drawdown > 0.1 ? 'text-orange-400' :
                                maxDrawdownData.max_drawdown > 0 ? 'text-yellow-400' :
                                'text-green-400'
                              }`}>
                                -{(maxDrawdownData.max_drawdown * 100).toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500 mt-1">24-month historical</div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-bold text-gray-500">N/A</div>
                              <div className="text-xs text-gray-500 mt-1">no historical data</div>
                            </>
                          )}
                        </div>

                        {/* Win Rate */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-500 text-xs mb-1">Win Rate</div>
                          <div className="text-2xl font-bold text-white">
                            {portfolioAnalytics.totalPositionsWithCostBasis > 0
                              ? `${(portfolioAnalytics.winRate * 100).toFixed(0)}%`
                              : 'N/A'
                            }
                          </div>
                          {portfolioAnalytics.totalPositionsWithCostBasis > 0 && (
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                              interpretWinRate(portfolioAnalytics.winRate).color === 'green' ? 'bg-green-900/50 text-green-400' :
                              interpretWinRate(portfolioAnalytics.winRate).color === 'lime' ? 'bg-lime-900/50 text-lime-400' :
                              interpretWinRate(portfolioAnalytics.winRate).color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
                              interpretWinRate(portfolioAnalytics.winRate).color === 'orange' ? 'bg-orange-900/50 text-orange-400' :
                              'bg-red-900/50 text-red-400'
                            }`}>
                              {interpretWinRate(portfolioAnalytics.winRate).label}
                            </div>
                          )}
                        </div>

                        {/* Winners/Losers */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <div className="text-gray-500 text-xs mb-1">Positions</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-green-400">{portfolioAnalytics.winners}W</span>
                            <span className="text-gray-600">/</span>
                            <span className="text-xl font-bold text-red-400">{portfolioAnalytics.losers}L</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {portfolioAnalytics.totalPositionsWithCostBasis} with cost basis
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Note about data requirements */}
                    {!portfolioAnalytics.hasEnoughDataForRatios && (
                      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          💡 Add cost basis to your positions for more accurate analytics calculations.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Add Holding Form */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Add Position</h2>
                <button
                  onClick={() => setNewHolding({ ticker: 'CASH', shares: 0, cost_basis: undefined, account_type: newHolding.account_type })}
                  className="text-sm px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>💵</span> Add Cash
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4" onKeyDown={(e) => {
                if (e.key === 'Enter' && newHolding.ticker && newHolding.shares) {
                  e.preventDefault();
                  addHolding();
                }
              }}>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {isCash(newHolding.ticker) ? 'Type' : 'Ticker'}
                  </label>
                  <input
                    type="text"
                    value={newHolding.ticker}
                    onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value.toUpperCase() })}
                    placeholder="AAPL or CASH"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {isCash(newHolding.ticker) ? 'Amount ($)' : 'Shares'}
                  </label>
                  <input
                    type="number"
                    value={newHolding.shares || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, shares: parseFloat(e.target.value) || 0 })}
                    placeholder={isCash(newHolding.ticker) ? '10000' : '10'}
                    min="0"
                    step={isCash(newHolding.ticker) ? '100' : '0.001'}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Avg Cost (optional)</label>
                  <input
                    type="number"
                    value={newHolding.cost_basis || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, cost_basis: parseFloat(e.target.value) || undefined })}
                    placeholder="150.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Account</label>
                  <select
                    value={newHolding.account_type}
                    onChange={(e) => setNewHolding({ ...newHolding, account_type: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={addHolding}
                disabled={saving || !newHolding.ticker || !newHolding.shares}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                Add Position
              </button>
            </div>

            {/* Holdings List with Percentages */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Your Holdings ({holdings.length})
                </h2>
                {holdings.length > 0 && (
                  <button
                    onClick={fetchPrices}
                    disabled={priceLoading}
                    className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-2"
                  >
                    <svg className={`w-4 h-4 ${priceLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Prices
                  </button>
                )}
              </div>
              
              {holdings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">📊</div>
                  <p>No holdings yet. Add your first position above.</p>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-800/50 text-xs text-gray-500 uppercase tracking-wider">
                    <div className="col-span-3">Stock</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-right">Shares</div>
                    <div className="col-span-2 text-right">Value</div>
                    <div className="col-span-2 text-right">% of Portfolio</div>
                    <div className="col-span-1"></div>
                  </div>

                  <div className="divide-y divide-gray-800">
                    {holdings.map((holding) => {
                      const holdingIsCash = isCash(holding.ticker);
                      const data = tickerData[holding.ticker];
                      const price = holdingIsCash ? 1 : (data?.price || 0);
                      const positionValue = holding.shares * price;
                      const positionPercent = getPositionPercent(holding.ticker);
                      const gainLoss = !holdingIsCash && holding.cost_basis && data?.price 
                        ? (data.price - holding.cost_basis) * holding.shares 
                        : null;
                      const gainLossPercent = !holdingIsCash && holding.cost_basis && data?.price
                        ? ((data.price - holding.cost_basis) / holding.cost_basis) * 100
                        : null;

                      return (
                        <div key={holding.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                          {/* Desktop View */}
                          <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                            <div className="col-span-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                                  holdingIsCash 
                                    ? 'bg-green-900/50 text-green-400' 
                                    : 'bg-gray-800 text-emerald-400'
                                }`}>
                                  {holdingIsCash ? '💵' : holding.ticker.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-semibold text-white">
                                    {holdingIsCash ? 'Cash' : holding.ticker}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {holdingIsCash ? 'Cash reserves' : (data?.name || 'Loading...')}
                                  </div>
                                  {!holdingIsCash && data?.beta && (
                                    <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                                      β {data.beta.toFixed(2)}
                                    </span>
                                  )}
                                  {holdingIsCash && (
                                    <span className="text-xs px-1.5 py-0.5 bg-green-900/30 rounded text-green-400">
                                      β 0.00
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="col-span-2 text-right">
                              {holdingIsCash ? (
                                <div>
                                  <div className="text-white font-medium">$1.00</div>
                                  <div className="text-xs text-gray-500">per unit</div>
                                </div>
                              ) : data?.price ? (
                                <div>
                                  <div className="text-white font-medium">${data.price.toFixed(2)}</div>
                                  {data.change_percent !== null && (
                                    <div className={`text-xs ${data.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {data.change_percent >= 0 ? '+' : ''}{data.change_percent.toFixed(2)}%
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </div>

                            <div className="col-span-2 text-right">
                              {editingHoldingId === holding.id ? (
                                <input
                                  type="number"
                                  value={editingShares}
                                  onChange={(e) => setEditingShares(e.target.value)}
                                  onBlur={finishEditingShares}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') finishEditingShares();
                                    if (e.key === 'Escape') cancelEditingShares();
                                  }}
                                  className="w-24 px-2 py-1 bg-gray-700 border border-emerald-500 rounded text-white text-right focus:outline-none"
                                  autoFocus
                                  step={holdingIsCash ? '100' : '0.001'}
                                />
                              ) : (
                                <div 
                                  className="cursor-pointer hover:text-emerald-400 transition-colors"
                                  onDoubleClick={() => holding.id && startEditingShares(holding.id, holding.shares)}
                                  title="Double-click to edit"
                                >
                                  <div className="text-white">
                                    {holdingIsCash 
                                      ? formatCurrency(holding.shares)
                                      : holding.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                    }
                                  </div>
                                  {!holdingIsCash && holding.cost_basis && (
                                    <div className="text-xs text-gray-500">${holding.cost_basis.toFixed(2)} avg</div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="col-span-2 text-right">
                              {positionValue > 0 ? (
                                <div>
                                  <div className="text-white font-medium">{formatCurrency(positionValue)}</div>
                                  {gainLoss !== null && (
                                    <div className={`text-xs ${gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </div>

                            <div className="col-span-2 text-right">
                              {positionPercent > 0 ? (
                                <div>
                                  <div className="text-lg font-bold text-emerald-400">{positionPercent.toFixed(1)}%</div>
                                  <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(100, positionPercent)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </div>

                            <div className="col-span-1 text-right">
                              <button
                                onClick={() => holding.id && deleteHolding(holding.id)}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Mobile View */}
                          <div className="md:hidden">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                                  holdingIsCash 
                                    ? 'bg-green-900/50 text-green-400' 
                                    : 'bg-gray-800 text-emerald-400'
                                }`}>
                                  {holdingIsCash ? '💵' : holding.ticker.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-semibold text-white">
                                    {holdingIsCash ? 'Cash' : holding.ticker}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {holdingIsCash ? 'Cash reserves' : (data?.name || 'Loading...')}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => holding.id && deleteHolding(holding.id)}
                                className="text-gray-500 hover:text-red-400 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>

                            <div className="grid grid-cols-4 gap-3 text-sm">
                              <div>
                                <div className="text-gray-500 text-xs">{holdingIsCash ? 'Amount' : 'Shares'}</div>
                                {editingHoldingId === holding.id ? (
                                  <input
                                    type="number"
                                    value={editingShares}
                                    onChange={(e) => setEditingShares(e.target.value)}
                                    onBlur={finishEditingShares}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') finishEditingShares();
                                      if (e.key === 'Escape') cancelEditingShares();
                                    }}
                                    className="w-full px-2 py-1 bg-gray-700 border border-emerald-500 rounded text-white focus:outline-none text-sm"
                                    autoFocus
                                    step={holdingIsCash ? '100' : '0.001'}
                                  />
                                ) : (
                                  <div 
                                    className="text-white cursor-pointer hover:text-emerald-400"
                                    onDoubleClick={() => holding.id && startEditingShares(holding.id, holding.shares)}
                                    title="Double-click to edit"
                                  >
                                    {holdingIsCash ? formatCurrency(holding.shares) : holding.shares}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-gray-500 text-xs">Price</div>
                                <div className="text-white">
                                  {holdingIsCash ? '$1.00' : (data?.price ? `$${data.price.toFixed(2)}` : '—')}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500 text-xs">Value</div>
                                <div className="text-white">{positionValue > 0 ? formatCurrency(positionValue) : '—'}</div>
                              </div>
                              <div>
                                <div className="text-gray-500 text-xs">% Portfolio</div>
                                <div className="text-emerald-400 font-bold">{positionPercent > 0 ? `${positionPercent.toFixed(1)}%` : '—'}</div>
                              </div>
                            </div>

                            {positionPercent > 0 && (
                              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-3">
                                <div 
                                  className={`h-full rounded-full ${holdingIsCash ? 'bg-green-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(100, positionPercent)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Coming Soon */}
        <div className="mt-12 bg-gradient-to-r from-emerald-900/20 to-teal-900/20 rounded-2xl border border-emerald-800/30 p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🧠</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">AI Recommendations Coming Soon</h3>
              <p className="text-gray-400">
                Once you've set up your profile and knowledge assessment, our AI will analyze your holdings and provide:
              </p>
              <ul className="mt-3 space-y-2 text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Personalized allocation recommendations based on your knowledge level
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Educational content tailored to fill gaps in your knowledge
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Strategy suggestions appropriate for your experience
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Risk warnings when your portfolio complexity exceeds your knowledge
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
