import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

const API_BASE = 'http://localhost:5001';

interface ProfileCompleteness {
  is_complete: boolean;
  missing_sections: {
    section: string;
    name: string;
    message: string;
  }[];
  completion_percentage: number;
  completed_items: number;
  total_items: number;
}

interface AIAnalysis {
  overall_assessment?: {
    summary: string;
    risk_score: number;
    diversification_score: number;
    alignment_with_goals: string;
  };
  portfolio_themes?: {
    theme: string;
    current_exposure: string;
    assessment: string;
  }[];
  allocation_recommendations?: {
    action: string;
    ticker: string;
    current_allocation?: string;
    target_allocation?: string;
    kelly_fraction?: string;
    rationale: string;
    priority: string;
    sharpe_impact?: string;
  }[];
  new_investment_ideas?: {
    thesis: string;
    secular_trend: string;
    suggested_exposure: string;
    allocation_recommendation: string;
    correlation_benefit: string;
    risk_factors: string[];
    time_horizon: string;
  }[];
  macro_considerations?: {
    current_environment: string;
    portfolio_positioning: string;
    adjustments_suggested?: string;
  };
  rebalancing_priority?: string[];
  key_risks?: {
    risk: string;
    mitigation: string;
    urgency: string;
  }[];
  educational_note?: string;
  generated_at?: string;
}

export default function PortfolioPage() {
  const router = useRouter();
  const { user, backendUser, signOut, isDevMode, loading: authLoading } = useAuth();
  
  const [profileCompleteness, setProfileCompleteness] = useState<ProfileCompleteness | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string>('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [profileChanged, setProfileChanged] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch analysis on mount and when user changes
  useEffect(() => {
    if (backendUser?.id) {
      fetchAnalysis();
    }
  }, [backendUser?.id]);

  const fetchAnalysis = async (forceRefresh = false) => {
    if (!backendUser?.id) return;
    
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setAnalysisLoading(true);
    }
    setAnalysisError(null);
    
    try {
      const url = forceRefresh 
        ? `${API_BASE}/api/users/${backendUser.id}/portfolio-analysis?force_refresh=true`
        : `${API_BASE}/api/users/${backendUser.id}/portfolio-analysis`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'incomplete_profile') {
        setProfileCompleteness(data.completeness);
        setAiAnalysis(null);
      } else if (data.status === 'success') {
        setProfileCompleteness(null);
        setAiAnalysis(data.analysis);
        setAnalysisSource(data.source);
        setGeneratedAt(data.generated_at);
        setProfileChanged(data.profile_changed || false);
        setCooldownRemaining(data.cooldown_remaining_minutes || null);
      } else if (data.error) {
        setAnalysisError(data.error);
      }
    } catch (err: any) {
      console.error('Analysis fetch error:', err);
      setAnalysisError(err.message || 'Failed to fetch analysis');
    } finally {
      setAnalysisLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalysis(true);
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
        <title>AI Portfolio Analysis | Prism</title>
        <meta name="description" content="AI-powered portfolio analysis and recommendations" />
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
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">AI Portfolio Analysis</h1>
              <p className="text-gray-400">
                Personalized recommendations based on your profile, current market conditions, and modern portfolio theory.
              </p>
            </div>
            {aiAnalysis && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
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
                  'Refresh Analysis'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {analysisLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4"></div>
            <p className="text-gray-400">Loading your portfolio analysis...</p>
          </div>
        )}

        {/* Error State */}
        {analysisError && !analysisLoading && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
            <h3 className="text-lg font-semibold text-red-400 mb-2">Analysis Error</h3>
            <p className="text-gray-400 mb-4">{analysisError}</p>
            <button
              onClick={() => fetchAnalysis()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Incomplete Profile State */}
        {profileCompleteness && !profileCompleteness.is_complete && !analysisLoading && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Complete Your Profile</h2>
              <p className="text-gray-400">
                To generate personalized portfolio analysis, please complete all sections of your profile.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Profile Completion</span>
                <span className="text-violet-400 font-medium">{profileCompleteness.completion_percentage}%</span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${profileCompleteness.completion_percentage}%` }}
                />
              </div>
            </div>

            {/* Missing Sections */}
            <div className="space-y-4">
              {profileCompleteness.missing_sections.map((section, i) => (
                <div key={i} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-white mb-1">{section.name}</h3>
                      <p className="text-gray-400 text-sm">{section.message}</p>
                    </div>
                    <Link href={`/profile?tab=${section.section}`}>
                      <a className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
                        Complete
                      </a>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/profile">
                <a className="text-violet-400 hover:text-violet-300 font-medium">
                  Go to Profile Settings →
                </a>
              </Link>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {aiAnalysis && !analysisLoading && (
          <div className="space-y-6">
            {/* Status Banner */}
            {(profileChanged || analysisSource === 'cache') && (
              <div className={`rounded-lg p-4 ${
                profileChanged 
                  ? 'bg-yellow-900/20 border border-yellow-800/50' 
                  : 'bg-gray-800/50 border border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    {profileChanged ? (
                      <p className="text-yellow-400 text-sm">
                        Your profile has changed. {cooldownRemaining 
                          ? `New analysis available in ${cooldownRemaining} minute${cooldownRemaining > 1 ? 's' : ''}.` 
                          : 'Refresh to get updated recommendations.'}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Showing cached analysis from {generatedAt ? new Date(generatedAt).toLocaleString() : 'earlier'}
                      </p>
                    )}
                  </div>
                  {!cooldownRemaining && profileChanged && (
                    <button
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="text-violet-400 hover:text-violet-300 text-sm font-medium"
                    >
                      Refresh Now
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Overall Assessment */}
            {aiAnalysis.overall_assessment && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Overall Assessment</h2>
                <p className="text-gray-300 mb-6">{aiAnalysis.overall_assessment.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <div className="text-gray-500 text-sm mb-2">Risk Score</div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-white">{aiAnalysis.overall_assessment.risk_score}/10</span>
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            aiAnalysis.overall_assessment.risk_score <= 3 ? 'bg-green-500' :
                            aiAnalysis.overall_assessment.risk_score <= 6 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${aiAnalysis.overall_assessment.risk_score * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <div className="text-gray-500 text-sm mb-2">Diversification</div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-white">{aiAnalysis.overall_assessment.diversification_score}/10</span>
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            aiAnalysis.overall_assessment.diversification_score >= 7 ? 'bg-green-500' :
                            aiAnalysis.overall_assessment.diversification_score >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${aiAnalysis.overall_assessment.diversification_score * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <div className="text-gray-500 text-sm mb-2">Goal Alignment</div>
                    <p className="text-gray-300 text-sm">{aiAnalysis.overall_assessment.alignment_with_goals}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Portfolio Themes */}
            {aiAnalysis.portfolio_themes && aiAnalysis.portfolio_themes.length > 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Portfolio Themes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiAnalysis.portfolio_themes.map((theme, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{theme.theme}</span>
                        <span className="text-violet-400 text-sm font-medium">{theme.current_exposure}</span>
                      </div>
                      <p className="text-gray-400 text-sm">{theme.assessment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allocation Recommendations */}
            {aiAnalysis.allocation_recommendations && aiAnalysis.allocation_recommendations.length > 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Allocation Recommendations</h2>
                <div className="space-y-4">
                  {aiAnalysis.allocation_recommendations.map((rec, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-xl p-5 border-l-4 border-violet-500">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              rec.action === 'INCREASE' ? 'bg-green-900/50 text-green-400' :
                              rec.action === 'DECREASE' ? 'bg-red-900/50 text-red-400' :
                              rec.action === 'ADD' ? 'bg-blue-900/50 text-blue-400' :
                              rec.action === 'REMOVE' ? 'bg-red-900/50 text-red-400' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {rec.action}
                            </span>
                            <span className="font-bold text-white text-lg">{rec.ticker}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              rec.priority === 'HIGH' ? 'bg-red-900/30 text-red-400' :
                              rec.priority === 'MEDIUM' ? 'bg-yellow-900/30 text-yellow-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {rec.priority} Priority
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mb-3">{rec.rationale}</p>
                          <div className="flex flex-wrap gap-4 text-sm">
                            {rec.current_allocation && (
                              <span className="text-gray-500">Current: <span className="text-gray-300">{rec.current_allocation}</span></span>
                            )}
                            {rec.target_allocation && (
                              <span className="text-gray-500">Target: <span className="text-violet-400 font-medium">{rec.target_allocation}</span></span>
                            )}
                            {rec.kelly_fraction && (
                              <span className="text-gray-500">Kelly: <span className="text-cyan-400">{rec.kelly_fraction}</span></span>
                            )}
                          </div>
                        </div>
                        {rec.sharpe_impact && (
                          <div className="text-right">
                            <div className="text-gray-500 text-xs">Sharpe Impact</div>
                            <div className="text-violet-400 text-sm font-medium">{rec.sharpe_impact}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Investment Ideas */}
            {aiAnalysis.new_investment_ideas && aiAnalysis.new_investment_ideas.length > 0 && (
              <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-2xl border border-cyan-800/30 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">New Investment Ideas</h2>
                <div className="space-y-4">
                  {aiAnalysis.new_investment_ideas.map((idea, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <span className="px-2 py-1 bg-cyan-900/50 text-cyan-400 text-xs rounded font-medium">
                            {idea.secular_trend}
                          </span>
                          <div className="mt-2 text-lg font-semibold text-white">{idea.suggested_exposure}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-500 text-xs">Suggested Allocation</div>
                          <div className="text-cyan-400 text-xl font-bold">{idea.allocation_recommendation}</div>
                        </div>
                      </div>
                      <p className="text-gray-300 mb-4">{idea.thesis}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Correlation Benefit:</span>
                          <p className="text-gray-300">{idea.correlation_benefit}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Time Horizon:</span>
                          <p className="text-gray-300">{idea.time_horizon}</p>
                        </div>
                      </div>
                      {idea.risk_factors && idea.risk_factors.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <span className="text-gray-500 text-sm">Risk Factors:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {idea.risk_factors.map((risk, j) => (
                              <span key={j} className="px-2 py-1 bg-red-900/20 text-red-400 text-xs rounded">
                                {risk}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Macro Considerations */}
            {aiAnalysis.macro_considerations && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Macro Considerations</h2>
                <div className="space-y-4">
                  <div>
                    <span className="text-gray-500 text-sm">Current Environment</span>
                    <p className="text-gray-300 mt-1">{aiAnalysis.macro_considerations.current_environment}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">Portfolio Positioning</span>
                    <p className="text-gray-300 mt-1">{aiAnalysis.macro_considerations.portfolio_positioning}</p>
                  </div>
                  {aiAnalysis.macro_considerations.adjustments_suggested && (
                    <div>
                      <span className="text-gray-500 text-sm">Suggested Adjustments</span>
                      <p className="text-gray-300 mt-1">{aiAnalysis.macro_considerations.adjustments_suggested}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rebalancing Priority */}
            {aiAnalysis.rebalancing_priority && aiAnalysis.rebalancing_priority.length > 0 && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Rebalancing Priority</h2>
                <ol className="space-y-3">
                  {aiAnalysis.rebalancing_priority.map((action, i) => (
                    <li key={i} className="flex items-start gap-4 text-gray-300">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        i === 0 ? 'bg-violet-600 text-white' :
                        i === 1 ? 'bg-violet-500/50 text-white' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{action}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Key Risks */}
            {aiAnalysis.key_risks && aiAnalysis.key_risks.length > 0 && (
              <div className="bg-red-900/10 rounded-2xl border border-red-900/30 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Key Risks</h2>
                <div className="space-y-4">
                  {aiAnalysis.key_risks.map((risk, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                          risk.urgency === 'HIGH' ? 'bg-red-900/50 text-red-400' :
                          risk.urgency === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {risk.urgency}
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-300 mb-2">{risk.risk}</p>
                          <p className="text-gray-500 text-sm">
                            <span className="text-gray-400">Mitigation:</span> {risk.mitigation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Educational Note */}
            {aiAnalysis.educational_note && (
              <div className="bg-gradient-to-r from-emerald-900/20 to-teal-900/20 rounded-2xl border border-emerald-800/30 p-6">
                <h2 className="text-xl font-semibold text-white mb-2">Learning Opportunity</h2>
                <p className="text-gray-300">{aiAnalysis.educational_note}</p>
              </div>
            )}

            {/* Generated timestamp */}
            {generatedAt && (
              <div className="text-center text-gray-500 text-sm pt-4">
                Analysis generated {new Date(generatedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
