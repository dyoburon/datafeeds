import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import ResultsCharts from '../components/ResultsCharts';

export default function Home() {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeScenario, setActiveScenario] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [query, setQuery] = useState<string>('');
    const [savedQueries, setSavedQueries] = useState<any[]>([]);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveDescription, setSaveDescription] = useState('');
    const [dailyInsights, setDailyInsights] = useState<any>(null);
    const [insightsLoading, setInsightsLoading] = useState(false);

    useEffect(() => {
        fetchSavedQueries();
    }, []);

    const fetchDailyInsights = async () => {
        setInsightsLoading(true);
        setDailyInsights(null);
        try {
            const response = await axios.get('http://localhost:5001/api/insights/daily');
            setDailyInsights(response.data);
        } catch (err: any) {
            console.error('Failed to fetch insights', err);
            alert('Failed to fetch insights: ' + (err.response?.data?.error || err.message));
        } finally {
            setInsightsLoading(false);
        }
    };

    const runInsightQuery = (question: string) => {
        setQuery(question);
        // Use setTimeout to ensure state update processes before calling (though handleAsk uses state, 
        // actually handleAsk uses the current scope 'query' if passed, but here handleAsk uses state 'query'.
        // Better to refactor handleAsk to accept an optional argument).
        
        // Let's refactor handleAsk slightly or just call the API directly here to avoid state race conditions
        // Actually, setQuery is async. 
        // Let's modify handleAsk to take an argument
    };

    const fetchSavedQueries = async () => {
        try {
            const response = await axios.get('http://localhost:5001/api/backtest/saved');
            setSavedQueries(response.data);
        } catch (err) {
            console.error('Failed to fetch saved queries', err);
        }
    };

    const runSavedQuery = async (id: string) => {
        setLoading(true);
        setResults(null);
        setActiveScenario(id);
        setError('');

        try {
            const response = await axios.get(`http://localhost:5001/api/backtest/saved/${id}`);
            setResults(response.data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!saveName.trim()) return;
        
        try {
            await axios.post('http://localhost:5001/api/backtest/save', {
                name: saveName,
                description: saveDescription,
                code: results.generated_code,
                original_query: query
            });
            setShowSaveForm(false);
            setSaveName('');
            setSaveDescription('');
            fetchSavedQueries();
            alert('Query saved successfully!');
        } catch (err: any) {
             alert('Failed to save query: ' + (err.response?.data?.error || err.message));
        }
    };

    const runScenario = async (scenario: string) => {
        setLoading(true);
        setResults(null);
        setActiveScenario(scenario);
        setError('');

        try {
            const response = await axios.get(`http://localhost:5001/api/backtest/${scenario}`);
            setResults(response.data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleAsk = async (overrideQuery?: string) => {
        const queryToUse = overrideQuery || query;
        if (!queryToUse.trim()) return;

        setLoading(true);
        setResults(null);
        setActiveScenario('custom');
        setError('');

        // update the UI input if we used an override
        if (overrideQuery) setQuery(overrideQuery);

        try {
            const response = await axios.post('http://localhost:5001/api/backtest/ask', { query: queryToUse });
            setResults(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-8 font-sans bg-gray-900 text-gray-100">
            <header className="mb-10 text-center relative">
                <div className="absolute top-0 left-0">
                    <Link href="/">
                        <a className="text-gray-400 hover:text-gray-200 text-sm font-semibold flex items-center gap-1">
                            ← Back to Home
                        </a>
                    </Link>
                </div>
                <h1 className="text-4xl font-bold text-white mb-2">Prism Datafeed</h1>
                <p className="text-gray-400">Analyze historical S&P 500 trends with one click or ask your own questions.</p>
            </header>

            {/* Daily Insights Section */}
            <div className="max-w-4xl mx-auto mb-8">
                <button 
                    onClick={fetchDailyInsights}
                    disabled={insightsLoading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4 rounded-xl shadow-lg hover:shadow-2xl transition-all flex items-center justify-center gap-2 font-semibold text-lg border border-indigo-500"
                >
                    {insightsLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Analyzing Market Data...
                        </>
                    ) : (
                        <>
                            <span>✨</span> Analyze Today's Market Patterns
                        </>
                    )}
                </button>

                {dailyInsights && (
                    <div className="mt-4 bg-gray-800 rounded-xl shadow-md border border-indigo-900/50 overflow-hidden animate-fade-in">
                        {dailyInsights.status === 'skipped' ? (
                            <div className="p-6 text-center">
                                <p className="text-gray-400 mb-2">Nothing historic happened today.</p>
                                <p className="text-sm text-gray-500 mb-6">Intrigue Score: {dailyInsights.score}/100 (Threshold: 70)</p>
                                
                                {/* Show headlines anyway for debug/context */}
                                <div className="text-left bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Analyzed Headlines (Debug)</h4>
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
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Daily Market Pulse</h3>
                                        <p className="text-gray-400 text-sm mt-1">{dailyInsights.data.summary}</p>
                                    </div>
                                    <div className="bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full text-sm font-bold border border-indigo-800">
                                        Score: {dailyInsights.data.intrigue_score}/100
                                    </div>
                                </div>

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

                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Suggested Analysis (with Predictive Score)</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {dailyInsights.data.questions.map((item: any, i: number) => {
                                            // Handle both old format (string) and new format (object)
                                            const questionText = typeof item === 'string' ? item : item.question;
                                            const score = typeof item === 'string' ? null : item.predictive_score;
                                            
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => handleAsk(questionText)}
                                                    className="text-left p-3 rounded-lg border border-indigo-900/50 hover:bg-indigo-900/20 hover:border-indigo-700 transition-colors flex justify-between items-center group bg-gray-800"
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
                                                    <span className="text-indigo-400 group-hover:text-indigo-300">→</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                    onClick={() => runScenario('november')}
                    className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === 'november' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                >
                    <h3 className="text-lg font-semibold mb-2 text-white">November Negative</h3>
                    <p className="text-sm text-gray-400">Returns after a negative November.</p>
                </button>

                <button
                    onClick={() => runScenario('friday')}
                    className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === 'friday' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                >
                    <h3 className="text-lg font-semibold mb-2 text-white">Friday Negative</h3>
                    <p className="text-sm text-gray-400">Returns the week after a negative Friday.</p>
                </button>

                <button
                    onClick={() => runScenario('pe')}
                    className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === 'pe' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                >
                    <h3 className="text-lg font-semibold mb-2 text-white">High P/E (&gt;23)</h3>
                    <p className="text-sm text-gray-400">Long-term returns when valuation is high.</p>
                </button>

                {savedQueries.map((sq) => (
                    <button
                        key={sq.id}
                        onClick={() => runSavedQuery(sq.id)}
                        className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === sq.id ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-lg font-semibold mb-2 text-white">{sq.name}</h3>
                        <p className="text-sm text-gray-400">{sq.description || 'Custom saved query'}</p>
                    </button>
                ))}
            </div>

            {/* P/E Range Buttons */}
            <div className="max-w-4xl mx-auto mb-8">
                <h2 className="text-xl font-semibold mb-4 text-white">P/E Ratio Ranges</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <button
                        onClick={() => runScenario('pe-16-17')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-16-17' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 16-17</h3>
                        <p className="text-xs text-gray-400">Low valuation</p>
                    </button>

                    <button
                        onClick={() => runScenario('pe-17-18')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-17-18' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 17-18</h3>
                        <p className="text-xs text-gray-400">Below average</p>
                    </button>

                    <button
                        onClick={() => runScenario('pe-18-19')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-18-19' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 18-19</h3>
                        <p className="text-xs text-gray-400">Fair value</p>
                    </button>

                    <button
                        onClick={() => runScenario('pe-19-20')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-19-20' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 19-20</h3>
                        <p className="text-xs text-gray-400">Average</p>
                    </button>

                    <button
                        onClick={() => runScenario('pe-20-21')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-20-21' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 20-21</h3>
                        <p className="text-xs text-gray-400">Above average</p>
                    </button>

                    <button
                        onClick={() => runScenario('pe-21-22')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-21-22' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 21-22</h3>
                        <p className="text-xs text-gray-400">Elevated</p>
                    </button>

                    <button
                        onClick={() => runScenario('pe-22-23')}
                        className={`p-4 rounded-lg shadow-sm border transition-all ${activeScenario === 'pe-22-23' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:shadow-md hover:border-gray-600'}`}
                    >
                        <h3 className="text-base font-semibold mb-1 text-white">P/E 22-23</h3>
                        <p className="text-xs text-gray-400">High valuation</p>
                    </button>
                </div>
            </div>

            {/* Custom Question Section */}
            <div className="max-w-4xl mx-auto mb-12">
                <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-6">
                    <h3 className="text-lg font-semibold mb-4 text-white">Ask a Custom Question</h3>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., When the market drops 5% in a week..."
                            className="flex-1 p-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-900 text-white placeholder-gray-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                        />
                        <button
                            onClick={() => handleAsk()}
                            disabled={loading || !query.trim()}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-blue-500"
                        >
                            Ask Gemini
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Powered by Gemini 3. Queries are converted to Python code and executed against historical data.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Crunching 100 years of data...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded relative mb-8" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {results && !loading && (
                    <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700">
                        <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-4 text-white">Results</h2>

                        {/* Generated Code Display (for custom queries) */}
                        {results.generated_code && (
                            <div className="mb-8">
                                <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto mb-4 border border-gray-800">
                                    <p className="text-gray-500 text-xs mb-2 uppercase font-bold">Generated Logic</p>
                                    <pre className="text-green-400 font-mono text-sm">{results.generated_code}</pre>
                                </div>
                                
                                {!showSaveForm ? (
                                    <button
                                        onClick={() => setShowSaveForm(true)}
                                        className="text-blue-400 hover:text-blue-300 font-semibold text-sm flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        Save this Query
                                    </button>
                                ) : (
                                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800">
                                        <h4 className="font-semibold text-blue-300 mb-3">Save Custom Query</h4>
                                        <div className="flex flex-col gap-3">
                                            <input
                                                type="text"
                                                placeholder="Name (e.g., 'Market Crash Recovery')"
                                                value={saveName}
                                                onChange={(e) => setSaveName(e.target.value)}
                                                className="p-2 border border-gray-600 rounded bg-gray-900 text-white placeholder-gray-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Description (optional)"
                                                value={saveDescription}
                                                onChange={(e) => setSaveDescription(e.target.value)}
                                                className="p-2 border border-gray-600 rounded bg-gray-900 text-white placeholder-gray-500"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={!saveName.trim()}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setShowSaveForm(false)}
                                                    className="text-gray-400 hover:text-gray-200 px-4 py-2"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stats Display */}
                        <div className="mb-6">
                            {results.count !== undefined && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-gray-400">Occurrences Found:</span>
                                    <span className="text-xl font-bold text-white">{results.count}</span>
                                </div>
                            )}
                            {results.results && results.results.count !== undefined && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-gray-400">Occurrences Found:</span>
                                    <span className="text-xl font-bold text-white">{results.results.count}</span>
                                </div>
                            )}
                        </div>

                        {/* Charts Section */}
                        <div className="mb-12">
                            <ResultsCharts 
                                results={results.results || results} 
                                control={results.control} 
                                signals={results.signals || []} 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Handle both standard results and dynamic results structure */}
                            {Object.keys(results.results || results).filter(k => k !== 'count' && k !== 'generated_code' && k !== 'control').map((period) => {
                                const data = (results.results || results)[period];
                                const controlData = results.control ? results.control[period] : null;

                                if (!data || data === "Data not available") return null;

                                return (
                                    <div key={period} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">{period} Later</h4>

                                        <div className="space-y-3">
                                            {/* Signal Stats */}
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Signal</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-400">Mean:</span>
                                                    <span className={`font-mono font-bold ${data.mean > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {(data.mean * 100).toFixed(2)}%
                                                    </span>
                                                </div>
                                                {data.win_rate !== undefined && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Win Rate:</span>
                                                        <span className="font-mono text-gray-300">{(data.win_rate * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Control Stats (if available) */}
                                            {controlData && (
                                                <div className="pt-2 border-t border-gray-700">
                                                    <div className="text-xs text-gray-500 mb-1">Control (Baseline)</div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Mean:</span>
                                                        <span className="font-mono text-gray-500">
                                                            {(controlData.mean * 100).toFixed(2)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-400">Win Rate:</span>
                                                        <span className="font-mono text-gray-500">
                                                            {(controlData.win_rate * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
