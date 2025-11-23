import { useState } from 'react';
import axios from 'axios';

export default function Home() {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeScenario, setActiveScenario] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [query, setQuery] = useState<string>('');

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

    const handleAsk = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setResults(null);
        setActiveScenario('custom');
        setError('');

        try {
            const response = await axios.post('http://localhost:5001/api/backtest/ask', { query });
            setResults(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-8 font-sans bg-gray-50">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Antigravity Backtester</h1>
                <p className="text-gray-600">Analyze historical S&P 500 trends with one click or ask your own questions.</p>
            </header>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                    onClick={() => runScenario('november')}
                    className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === 'november' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:shadow-md'}`}
                >
                    <h3 className="text-lg font-semibold mb-2">November Negative</h3>
                    <p className="text-sm text-gray-500">Returns after a negative November.</p>
                </button>

                <button
                    onClick={() => runScenario('friday')}
                    className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === 'friday' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:shadow-md'}`}
                >
                    <h3 className="text-lg font-semibold mb-2">Friday Negative</h3>
                    <p className="text-sm text-gray-500">Returns the week after a negative Friday.</p>
                </button>

                <button
                    onClick={() => runScenario('pe')}
                    className={`p-6 rounded-xl shadow-sm border transition-all ${activeScenario === 'pe' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:shadow-md'}`}
                >
                    <h3 className="text-lg font-semibold mb-2">High P/E (&gt;23)</h3>
                    <p className="text-sm text-gray-500">Long-term returns when valuation is high.</p>
                </button>
            </div>

            {/* Custom Question Section */}
            <div className="max-w-4xl mx-auto mb-12">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold mb-4">Ask a Custom Question</h3>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., When the market drops 5% in a week..."
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                        />
                        <button
                            onClick={handleAsk}
                            disabled={loading || !query.trim()}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Ask Gemini
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Powered by Gemini 3. Queries are converted to Python code and executed against historical data.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-500">Crunching 100 years of data...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-8" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {results && !loading && (
                    <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                        <h2 className="text-2xl font-bold mb-6 border-b pb-4">Results</h2>

                        {/* Generated Code Display (for custom queries) */}
                        {results.generated_code && (
                            <div className="mb-8 bg-gray-900 rounded-lg p-4 overflow-x-auto">
                                <p className="text-gray-400 text-xs mb-2 uppercase font-bold">Generated Logic</p>
                                <pre className="text-green-400 font-mono text-sm">{results.generated_code}</pre>
                            </div>
                        )}

                        {/* Stats Display */}
                        <div className="mb-6">
                            {results.count !== undefined && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-gray-500">Occurrences Found:</span>
                                    <span className="text-xl font-bold">{results.count}</span>
                                </div>
                            )}
                            {results.results && results.results.count !== undefined && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-gray-500">Occurrences Found:</span>
                                    <span className="text-xl font-bold">{results.results.count}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Handle both standard results and dynamic results structure */}
                            {Object.keys(results.results || results).filter(k => k !== 'count' && k !== 'generated_code' && k !== 'control').map((period) => {
                                const data = (results.results || results)[period];
                                const controlData = results.control ? results.control[period] : null;

                                if (!data || data === "Data not available") return null;

                                return (
                                    <div key={period} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-3">{period} Later</h4>

                                        <div className="space-y-3">
                                            {/* Signal Stats */}
                                            <div>
                                                <div className="text-xs text-gray-400 mb-1">Signal</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm text-gray-600">Mean:</span>
                                                    <span className={`font-mono font-bold ${data.mean > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {(data.mean * 100).toFixed(2)}%
                                                    </span>
                                                </div>
                                                {data.win_rate !== undefined && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-600">Win Rate:</span>
                                                        <span className="font-mono text-gray-800">{(data.win_rate * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Control Stats (if available) */}
                                            {controlData && (
                                                <div className="pt-2 border-t border-gray-200">
                                                    <div className="text-xs text-gray-400 mb-1">Control (Baseline)</div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-600">Mean:</span>
                                                        <span className="font-mono text-gray-500">
                                                            {(controlData.mean * 100).toFixed(2)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm text-gray-600">Win Rate:</span>
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
