import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import ResultsCharts from '../components/ResultsCharts';
import PreferencesModal from '../components/PreferencesModal';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
    // Keep all state for potential future use, but only use what's needed for UI
    const [dailyInsights, setDailyInsights] = useState<any>(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
    const [showPreferences, setShowPreferences] = useState(false);
    
    const { user, backendUser, isNewUser, signOut, isDevMode } = useAuth();

    useEffect(() => {
        // Fetch insights when backendUser preferences are available
        fetchDailyInsights(false);
    }, [backendUser?.preferences]);
    
    // Show preferences modal for new users
    useEffect(() => {
        if (isNewUser) {
            setShowPreferences(true);
        }
    }, [isNewUser]);

    const fetchDailyInsights = async (forceReset = false) => {
        setInsightsLoading(true);
        setDailyInsights(null);
        try {
            // Build URL with user preferences if available
            const params = new URLSearchParams();
            if (forceReset) {
                params.append('force_reset', 'true');
            }
            // Include user preferences to filter the response
            if (backendUser?.preferences && backendUser.preferences.length > 0) {
                params.append('preferences', backendUser.preferences.join(','));
            }

            const queryString = params.toString();
            const url = `http://localhost:5001/api/insights/daily${queryString ? '?' + queryString : ''}`;

            const response = await axios.get(url);
            setDailyInsights(response.data);
            // Expand all questions by default
            if (response.data?.data?.questions) {
                const allIndices = new Set<number>(response.data.data.questions.map((_: any, i: number) => i));
                setExpandedQuestions(allIndices);
            }
        } catch (err: any) {
            console.error('Failed to fetch insights', err);
        } finally {
            setInsightsLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-8 font-sans bg-gray-900 text-gray-100">
            {/* Preferences Modal */}
            <PreferencesModal 
                isOpen={showPreferences} 
                onClose={() => setShowPreferences(false)}
                isFirstTime={isNewUser}
            />
            
            {/* Dev mode banner */}
            {isDevMode && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-900/50 text-yellow-300 text-xs text-center py-1 px-4 z-40">
                    🛠️ Dev Mode – Using mock authentication
                </div>
            )}
            
            {/* Navigation Bar */}
            <nav className={`mb-8 flex justify-between items-center ${isDevMode ? 'mt-6' : ''}`}>
                <div className="flex items-center gap-8">
                    <Link href="/">
                        <a className="text-xl font-bold text-blue-400">Prism</a>
                    </Link>
                    <div className="flex gap-6">
                        <Link href="/app">
                            <a className="text-white font-medium text-sm border-b-2 border-blue-500 pb-1">
                                Market Analysis
                            </a>
                        </Link>
                        <Link href="/portfolio">
                            <a className="text-gray-400 hover:text-white transition-colors text-sm">
                                AI Portfolio
                            </a>
                        </Link>
                        <Link href="/portfolio-news">
                            <a className="text-gray-400 hover:text-white transition-colors text-sm">
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
                
                {/* User info and preferences button */}
                {user && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowPreferences(true)}
                            className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
                            title="Email Preferences"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Preferences
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-sm font-medium">
                                {user.displayName?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-gray-400 text-sm hidden md:inline">
                                {backendUser?.email || user.email}
                            </span>
                            <button
                                onClick={() => signOut()}
                                className="text-gray-500 hover:text-white text-sm transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </nav>
            
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-white mb-2">Market Analysis</h1>
                <p className="text-gray-400">AI-powered daily market insights and analysis.</p>
            </header>

            {/* Daily Insights Section */}
            <div className="max-w-4xl mx-auto">
                {/* Loading State */}
                {insightsLoading && !dailyInsights && (
                    <div className="flex flex-col items-center justify-center p-12 bg-gray-800 rounded-xl border border-indigo-900/50 animate-pulse">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                        <p className="text-indigo-300 font-semibold">Analyzing Today's Market Patterns...</p>
                        <p className="text-gray-500 text-xs mt-2">Consulting Gemini 3 Pro & Historical Data</p>
                    </div>
                )}

                {dailyInsights && (
                    <div className="bg-gray-800 rounded-xl shadow-md border border-indigo-900/50 overflow-hidden">
                        {dailyInsights.status === 'skipped' ? (
                            <div className="p-6 text-center relative">
                                <div className="absolute top-4 right-4">
                                    <button 
                                        onClick={() => fetchDailyInsights(true)}
                                        disabled={insightsLoading}
                                        title="Force Reset Analysis"
                                        className="text-gray-600 hover:text-white transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-gray-400 mb-2">Nothing historic happened today.</p>
                                <p className="text-sm text-gray-500 mb-6">Intrigue Score: {dailyInsights.score}/100 (Threshold: 70)</p>
                                
                                {/* Show headlines anyway for debug/context */}
                                <div className="text-left bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Analyzed Headlines</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(dailyInsights.data?.top_news && dailyInsights.data.top_news.length > 0 && dailyInsights.data.top_news[0] !== "No news available"
                                            ? dailyInsights.data.top_news 
                                            : ["Market Mixed as Investors Weigh Economic Data", "Tech Stocks Lead Rally Ahead of Earnings", "Treasury Yields Dip Following Inflation Report", "Oil Prices Stabilize Amid Supply Concerns"]
                                        ).map((news: string, i: number) => (
                                            <span key={i} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs border border-gray-700 shadow-sm">
                                                {news}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 relative">
                                <div className="absolute top-6 right-6 flex gap-3">
                                     <button 
                                        onClick={() => fetchDailyInsights(true)}
                                        disabled={insightsLoading}
                                        title="Refresh Analysis"
                                        className="text-gray-500 hover:text-indigo-400 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${insightsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex justify-between items-start mb-4 pr-10">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-xl font-bold text-white">Daily Market Pulse</h3>
                                            {dailyInsights.data.date && (
                                                <span className="text-xs font-mono text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                                                    {dailyInsights.data.date}
                                                </span>
                                            )}
                                        </div>
                                        {dailyInsights.data.summary && (
                                            <p className="text-gray-400 text-sm">{dailyInsights.data.summary}</p>
                                        )}
                                    </div>
                                    <div className="bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full text-sm font-bold border border-indigo-800 whitespace-nowrap">
                                        Score: {dailyInsights.data.intrigue_score}/100
                                    </div>
                                </div>

                                {dailyInsights.data.top_news && dailyInsights.data.top_news.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Top Headlines</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {dailyInsights.data.top_news.map((news: string, i: number) => (
                                                <span key={i} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs border border-gray-700">
                                                    {news}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Show message when no content sections are enabled */}
                                {!dailyInsights.data.summary && !dailyInsights.data.top_news && !dailyInsights.data.questions && (
                                    <div className="text-center py-8 border-t border-gray-700">
                                        <p className="text-gray-400 text-sm mb-2">No content sections enabled for display.</p>
                                        <button
                                            onClick={() => setShowPreferences(true)}
                                            className="text-indigo-400 hover:text-indigo-300 text-sm underline"
                                        >
                                            Update your preferences
                                        </button>
                                    </div>
                                )}

                                {dailyInsights.data.questions && dailyInsights.data.questions.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">AI-Generated Analysis</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {dailyInsights.data.questions.map((item: any, i: number) => {
                                            const questionText = typeof item === 'string' ? item : item.question;
                                            const score = typeof item === 'string' ? null : item.predictive_score;
                                            const isExpanded = expandedQuestions.has(i);
                                            const cachedResults = item.results;

                                            const toggleExpanded = () => {
                                                setExpandedQuestions(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(i)) {
                                                        next.delete(i);
                                                    } else {
                                                        next.add(i);
                                                    }
                                                    return next;
                                                });
                                            };

                                            return (
                                                <div key={i} className="flex flex-col bg-gray-800 rounded-lg border border-indigo-900/50 overflow-hidden transition-all">
                                                    <button
                                                        onClick={toggleExpanded}
                                                        className={`text-left p-3 hover:bg-indigo-900/20 transition-colors flex justify-between items-center group w-full ${isExpanded ? 'bg-indigo-900/30' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {score !== null && (
                                                                <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                                    score >= 80 ? 'bg-green-900/30 text-green-400 border border-green-900/50' : 
                                                                    score >= 50 ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50' : 
                                                                    'bg-gray-700 text-gray-400 border border-gray-600'
                                                                }`}>
                                                                    {score}
                                                                </div>
                                                            )}
                                                            <span className="text-sm font-medium text-gray-300 group-hover:text-white">{questionText}</span>
                                                        </div>
                                                        <span className={`text-indigo-400 group-hover:text-indigo-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                                    </button>
                                                    
                                                    {isExpanded && cachedResults && (
                                                        <div className="p-4 bg-gray-900/80 border-t border-gray-700">
                                                            {item.insight_explanation && (
                                                                <div className="mb-3 p-3 bg-blue-950/50 border border-blue-800/50 rounded-lg">
                                                                    <h4 className="text-xs font-bold text-blue-400 uppercase mb-1">💡 Why this question?</h4>
                                                                    <p className="text-sm text-gray-300">{item.insight_explanation}</p>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="mb-3 flex items-baseline gap-2">
                                                                <span className="text-gray-500 text-sm">Occurrences Found:</span>
                                                                <span className="text-xl font-bold text-white">{cachedResults.count || cachedResults.results?.count || 0}</span>
                                                            </div>
                                                            
                                                            <div className="mb-3">
                                                                <ResultsCharts 
                                                                    results={cachedResults.results || cachedResults} 
                                                                    control={cachedResults.control} 
                                                                    signals={cachedResults.signals || []} 
                                                                    compact={true}
                                                                />
                                                            </div>
                                                            
                                                            {item.result_explanation && (
                                                                <div className="p-3 bg-green-950/50 border border-green-800/50 rounded-lg">
                                                                    <h4 className="text-xs font-bold text-green-400 uppercase mb-1">📊 Results Interpretation</h4>
                                                                    <p className="text-sm text-gray-300">{item.result_explanation}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {isExpanded && !cachedResults && (
                                                        <div className="p-4 bg-gray-900/80 border-t border-gray-700 text-center">
                                                            <p className="text-gray-400 text-sm">No cached results available. Click refresh to regenerate.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state when no insights */}
                {!insightsLoading && !dailyInsights && (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📊</div>
                        <h3 className="text-xl font-semibold text-white mb-2">No market analysis available</h3>
                        <p className="text-gray-400 mb-6">Check back later for today's AI-generated market insights.</p>
                        <button
                            onClick={() => fetchDailyInsights(true)}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                        >
                            Generate Analysis
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
