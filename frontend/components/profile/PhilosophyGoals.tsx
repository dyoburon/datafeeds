import React from 'react';

interface UserContext {
  investment_philosophy: string;
  goals: string;
  risk_tolerance: string;
  time_horizon: string;
  income_level: string;
  age_range: string;
  investment_experience: string;
  notes: string;
}

interface PhilosophyGoalsProps {
  context: UserContext;
  setContext: React.Dispatch<React.SetStateAction<any>>;
  saveContext: () => Promise<void>;
  saving: boolean;
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

export default function PhilosophyGoals({ context, setContext, saveContext, saving }: PhilosophyGoalsProps) {
  return (
    <div className="space-y-8">
      {/* Investment Philosophy */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Investment Philosophy</h2>
        <textarea
          value={context.investment_philosophy}
          onChange={(e) => setContext((prev: any) => ({ ...prev, investment_philosophy: e.target.value }))}
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
          onChange={(e) => setContext((prev: any) => ({ ...prev, goals: e.target.value }))}
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
              onClick={() => setContext((prev: any) => ({ ...prev, risk_tolerance: option.value }))}
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
              onClick={() => setContext((prev: any) => ({ ...prev, time_horizon: option.value }))}
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
              onChange={(e) => setContext((prev: any) => ({ ...prev, age_range: e.target.value }))}
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
              onChange={(e) => setContext((prev: any) => ({ ...prev, income_level: e.target.value }))}
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
            onChange={(e) => setContext((prev: any) => ({ ...prev, notes: e.target.value }))}
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
  );
}

