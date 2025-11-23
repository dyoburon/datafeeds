import { useState } from 'react';
import axios from 'axios';

export default function Home() {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeScenario, setActiveScenario] = useState<string>('');
    const [error, setError] = useState<string>('');

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

    return (
        <div className="min-h-screen p-8 font-sans">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Antigravity Backtester</h1>
                <p className="text-gray-600">Analyze historical S&P 500 trends with one click.</p>
            </header>

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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

            <div className="max-w-4xl mx-auto">
                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-500">Crunching 100 years of data...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {results && !loading && (
                    <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
                        <h2 className="text-2xl font-bold mb-6 border-b pb-4">Results</h2>

                        {results.count !== undefined && (
                            <div className="mb-6">
                                <span className="text-gray-500">Occurrences Found:</span>
                                <span className="ml-2 text-xl font-bold">{results.count}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.keys(results).filter(k => k !== 'count').map((period) => {
                                const data = results[period];
                                if (!data || data === "Data not available") return null;

                                return (
                                    <div key={period} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">{period} Later</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span>Mean:</span>
                                                <span className={`font-mono font-bold ${data.mean > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {(data.mean * 100).toFixed(2)}%
                                                </span>
                                            </div>
                                            {data.win_rate !== undefined && (
                                                <div className="flex justify-between">
                                                    <span>Win Rate:</span>
                                                    <span className="font-mono">{(data.win_rate * 100).toFixed(1)}%</span>
                                                </div>
                                            )}
                                            {data.cagr !== undefined && data.cagr !== null && (
                                                <div className="flex justify-between">
                                                    <span>CAGR:</span>
                                                    <span className="font-mono text-purple-600 font-bold">{(data.cagr * 100).toFixed(2)}%</span>
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
