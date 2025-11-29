import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import {
  calculatePortfolioAnalytics,
  HoldingWithPrice,
  PortfolioAnalytics,
  isCashTicker,
  isBondTicker,
} from '../utils/portfolioAnalytics';
import PhilosophyGoals from '../components/profile/PhilosophyGoals';
import KnowledgeAssessment from '../components/profile/KnowledgeAssessment';
import CurrentPortfolio from '../components/profile/CurrentPortfolio';

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
  // Asset Allocation
  equitiesPercent: number;
  equitiesValue: number;
  bondsCashPercent: number;
  bondsCashValue: number;
  bondsPercent: number;
  bondsValue: number;
  cashPercent: number;
  cashValue: number;
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
        equitiesPercent: 0,
        equitiesValue: 0,
        bondsCashPercent: 0,
        bondsCashValue: 0,
        bondsPercent: 0,
        bondsValue: 0,
        cashPercent: 0,
        cashValue: 0,
      };
    }

    let totalValue = 0;
    let totalCostBasis = 0;
    let dayChange = 0;
    let weightedBeta = 0;
    let weightedDividendYield = 0;
    let peSum = 0;
    let peCount = 0;
    let equitiesValue = 0;
    let bondsValue = 0;
    let cashValue = 0;
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

      // Track asset allocation
      if (holdingIsCash || isCashTicker(holding.ticker)) {
        cashValue += positionValue;
      } else if (isBondTicker(holding.ticker)) {
        bondsValue += positionValue;
      } else {
        equitiesValue += positionValue;
      }

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

    // Calculate asset allocation percentages
    const bondsCashValue = bondsValue + cashValue;
    const equitiesPercent = totalValue > 0 ? (equitiesValue / totalValue) * 100 : 0;
    const bondsPercent = totalValue > 0 ? (bondsValue / totalValue) * 100 : 0;
    const cashPercent = totalValue > 0 ? (cashValue / totalValue) * 100 : 0;
    const bondsCashPercent = totalValue > 0 ? (bondsCashValue / totalValue) * 100 : 0;

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
      equitiesPercent,
      equitiesValue,
      bondsCashPercent,
      bondsCashValue,
      bondsPercent,
      bondsValue,
      cashPercent,
      cashValue,
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
        <title>Profile | Prism</title>
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
                  Profile
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
          <PhilosophyGoals
            context={context}
            setContext={setContext}
            saveContext={saveContext}
            saving={saving}
          />
        )}

        {/* Knowledge Assessment Tab */}
        {activeTab === 'knowledge' && (
          <KnowledgeAssessment
            knowledgeAssessment={context.knowledge_assessment}
            updateKnowledge={updateKnowledge}
            saveContext={saveContext}
            saving={saving}
            getOverallScore={getOverallScore}
            getComputedExperience={getComputedExperience}
          />
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <CurrentPortfolio
            holdings={holdings}
            newHolding={newHolding}
            setNewHolding={setNewHolding}
            addHolding={addHolding}
            deleteHolding={deleteHolding}
            tickerData={tickerData}
            portfolioStats={portfolioStats}
            portfolioAnalytics={portfolioAnalytics}
            priceLoading={priceLoading}
            fetchPrices={fetchPrices}
            saving={saving}
            maxDrawdownData={maxDrawdownData}
            drawdownLoading={drawdownLoading}
            isCash={isCash}
            formatCurrency={formatCurrency}
            getPositionPercent={getPositionPercent}
            editingHoldingId={editingHoldingId}
            editingShares={editingShares}
            setEditingShares={setEditingShares}
            startEditingShares={startEditingShares}
            finishEditingShares={finishEditingShares}
            cancelEditingShares={cancelEditingShares}
          />
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
