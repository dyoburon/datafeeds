import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

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
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 20); // Convert to 0-100
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
      <main className="max-w-4xl mx-auto px-6 py-8">
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
            {/* Add Holding Form */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Add Holding</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Ticker</label>
                  <input
                    type="text"
                    value={newHolding.ticker}
                    onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Shares</label>
                  <input
                    type="number"
                    value={newHolding.shares || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, shares: parseFloat(e.target.value) || 0 })}
                    placeholder="10"
                    min="0"
                    step="0.001"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Cost Basis (optional)</label>
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
                Add Holding
              </button>
            </div>

            {/* Holdings List */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">
                  Your Holdings ({holdings.length})
                </h2>
              </div>
              
              {holdings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">📊</div>
                  <p>No holdings yet. Add your first position above.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {holdings.map((holding) => (
                    <div key={holding.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-emerald-400">
                          {holding.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{holding.ticker}</div>
                          <div className="text-sm text-gray-400">
                            {holding.shares} shares
                            {holding.cost_basis && ` · $${holding.cost_basis.toFixed(2)} avg`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400">
                          {ACCOUNT_TYPES.find(t => t.value === holding.account_type)?.label || holding.account_type}
                        </span>
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
                  ))}
                </div>
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
