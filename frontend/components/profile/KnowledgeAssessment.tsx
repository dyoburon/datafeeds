import React from 'react';

interface KnowledgeAssessmentData {
  basic_concepts: number;
  portfolio_management: number;
  market_mechanics: number;
  fundamental_analysis: number;
  technical_analysis: number;
  options_derivatives: number;
  tax_strategies: number;
  macroeconomics: number;
}

interface KnowledgeAssessmentProps {
  knowledgeAssessment: KnowledgeAssessmentData;
  updateKnowledge: (categoryId: string, value: number) => void;
  saveContext: () => Promise<void>;
  saving: boolean;
  getOverallScore: () => number;
  getComputedExperience: () => string;
}

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

export default function KnowledgeAssessment({
  knowledgeAssessment,
  updateKnowledge,
  saveContext,
  saving,
  getOverallScore,
  getComputedExperience,
}: KnowledgeAssessmentProps) {
  return (
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
          const currentValue = knowledgeAssessment[category.id as keyof KnowledgeAssessmentData] || 0;
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
  );
}

