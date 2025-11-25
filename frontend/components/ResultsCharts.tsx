import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

interface ResultsChartsProps {
  results: any;
  control: any;
  signals: any[];
}

const ResultsCharts: React.FC<ResultsChartsProps> = ({ results, control, signals }) => {
  // 1. Prepare Data for Mean Return Comparison (Bar Chart)
  const periods = Object.keys(results).filter(
    (k) => k !== 'count' && k !== 'generated_code' && k !== 'control' && k !== 'signals'
  );

  const comparisonData = periods.map((period) => {
    const signalData = results[period];
    const controlData = control ? control[period] : null;

    if (!signalData || signalData === 'Data not available') return null;

    return {
      name: period,
      Signal: signalData.mean ? parseFloat((signalData.mean * 100).toFixed(2)) : 0,
      Baseline: controlData && controlData.mean ? parseFloat((controlData.mean * 100).toFixed(2)) : 0,
    };
  }).filter(Boolean);

  // 2. Prepare Data for Signals Scatter Plot
  // We need to decide which period to plot on Y-axis. 
  // Let's find the longest available period that isn't '10Y' (too long?) or just pick the first one.
  // Or let user select? For now, we'll pick '1Y' if available, else the last one.
  const availablePeriods = periods.filter(p => results[p] && results[p] !== 'Data not available');
  const scatterPeriod = availablePeriods.find(p => p === '1Y') || availablePeriods[availablePeriods.length - 1];

  const scatterData = signals && signals.map((s) => {
      // Handle nested signal objects (new format) vs flat (old format)
      const val = s[scatterPeriod];
      
      // If val is explicitly null/undefined, skip
      if (val === null || val === undefined) return null;
      
      return {
          date: s.date,
          return: parseFloat((val * 100).toFixed(2)),
          price: s.price
      };
  }).filter(Boolean) || [];

  // GUARD: If no periods are available (e.g. all "Data not available"), show a message instead of empty charts
  if (availablePeriods.length === 0) {
      return (
          <div className="bg-yellow-900/20 p-6 rounded-xl border border-yellow-800 text-center">
              <h3 className="text-lg font-bold text-yellow-400 mb-2">Not Enough Data</h3>
              <p className="text-gray-300">
                  Although {signals ? signals.length : 0} occurrences were found, there wasn't enough forward-looking data to calculate returns for the requested periods. 
                  This often happens with very recent signals or when data for auxiliary tickers (like HYG) is missing for older dates.
              </p>
          </div>
      );
  }

  return (
    <div className="space-y-12">
      {/* Chart 1: Signal vs Baseline Comparison */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Average Return Comparison: Signal vs. Baseline</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis 
                label={{ 
                  value: 'Average Return (%)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { textAnchor: 'middle' } 
                }} 
              />
              <Tooltip 
                formatter={(value: any) => [`${value}%`, '']} 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  padding: '8px'
                }}
                cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                wrapperStyle={{ zIndex: 1000 }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                content={({ payload }) => (
                  <div className="flex justify-center gap-6 pt-4">
                    {payload?.map((entry: any, index: number) => (
                      <div key={`item-${index}`} className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm text-gray-700">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
              <Bar name="Signal Strategy" dataKey="Signal" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar name="Market Baseline (Buy & Hold)" dataKey="Baseline" fill="#9ca3af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 text-sm text-gray-600 space-y-2 bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold">Chart Explanation:</p>
            <p>
                This chart compares the average performance of your strategy (<strong>Signal Strategy</strong>) against the general market performance (<strong>Market Baseline</strong>) over various time horizons.
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1">
                <li><strong>Signal Strategy (Blue):</strong> The average return achieved after your specific condition was met.</li>
                <li><strong>Market Baseline (Gray):</strong> The average return for the S&P 500 over the same time periods across all historical data (Buy & Hold).</li>
            </ul>
            <p>
                If the blue bar is higher than the gray bar, your strategy historically outperforms the market average for that time period.
            </p>
        </div>
      </div>

      {/* Chart 2: Signal Performance Over Time */}
      {scatterData.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Historical Trade Performance Distribution ({scatterPeriod})</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                    dataKey="date" 
                    type="category" 
                    allowDuplicatedCategory={false}
                    tick={{fontSize: 12}}
                    interval="preserveStartEnd"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    label={{ value: 'Trade Date', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis 
                    type="number" 
                    dataKey="return" 
                    name="Return" 
                    unit="%" 
                    label={{ value: 'Return on Trade (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                />
                <ZAxis type="number" range={[60, 60]} />
                <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
                                    <p className="font-bold mb-1">{data.date}</p>
                                    <p className="text-sm">Return: <span className={data.return >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{data.return}%</span></p>
                                    <p className="text-xs text-gray-500">Price: {data.price}</p>
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                <Legend />
                <Scatter name="Individual Trade Return" data={scatterData} fill="#10b981" shape="circle" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
           <div className="mt-6 text-sm text-gray-600 space-y-2 bg-gray-50 p-4 rounded-lg">
            <p className="font-semibold">Chart Explanation:</p>
            <p>
                This scatter plot visualizes every individual trade occurrence in history. Each dot represents a specific date when the signal was triggered.
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1">
                <li>The <strong>horizontal axis</strong> represents the date of the trade.</li>
                <li>The <strong>vertical axis</strong> indicates the percentage return achieved <strong>{scatterPeriod}</strong> after the signal.</li>
            </ul>
            <p>
                This visualization helps identify the consistency of the strategy. Look for clusters of positive (green) results versus negative results to understand if the strategy works better in certain market eras or if it has become less effective over time.
            </p>
        </div>
        </div>
      )}
    </div>
  );
};

export default ResultsCharts;

