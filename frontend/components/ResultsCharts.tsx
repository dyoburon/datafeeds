import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ResultsChartsProps {
  results: any;
  control: any;
  signals: any[];
  compact?: boolean; // For accordion view
}

const ResultsCharts: React.FC<ResultsChartsProps> = ({ results, control, signals, compact = false }) => {
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

  // GUARD: If no periods are available, show a message
  const availablePeriods = periods.filter(p => results[p] && results[p] !== 'Data not available');
  
  if (availablePeriods.length === 0 || comparisonData.length === 0) {
    return (
      <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-700 text-center">
        <p className="text-yellow-400 font-medium">Not Enough Data</p>
        <p className="text-gray-400 text-sm mt-1">
          Forward returns could not be calculated for the requested periods.
        </p>
      </div>
    );
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl">
          <p className="text-white font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
              <span className={`font-mono font-bold ${entry.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {entry.value}%
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Compact view for accordion
  if (compact) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h4 className="text-sm font-bold text-gray-300 mb-3">Average Return: Signal vs Baseline</h4>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart
              data={comparisonData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#4b5563' }}
              />
              <YAxis 
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#4b5563' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Signal" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Signal" />
              <Bar dataKey="Baseline" fill="#6b7280" radius={[4, 4, 0, 0]} name="Baseline" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Simple legend */}
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-gray-400">Signal Strategy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span className="text-gray-400">Market Baseline</span>
          </div>
        </div>
      </div>
    );
  }

  // Full view (original behavior but dark mode)
  return (
    <div className="space-y-8">
      {/* Chart 1: Signal vs Baseline Comparison */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-4">Average Return Comparison: Signal vs. Baseline</h3>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={comparisonData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#4b5563' }}
              />
              <YAxis 
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#4b5563' }}
                label={{ 
                  value: 'Average Return (%)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { textAnchor: 'middle', fill: '#9ca3af' } 
                }} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Signal" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Signal Strategy" />
              <Bar dataKey="Baseline" fill="#6b7280" radius={[4, 4, 0, 0]} name="Market Baseline" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex justify-center gap-8 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm text-gray-300">Signal Strategy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-500"></div>
            <span className="text-sm text-gray-300">Market Baseline (Buy & Hold)</span>
          </div>
        </div>
        <div className="mt-6 text-sm text-gray-400 space-y-2 bg-gray-900 p-4 rounded-lg border border-gray-700">
          <p className="font-semibold text-gray-300">Chart Explanation:</p>
          <p>
            This chart compares the average performance of your strategy (<strong className="text-blue-400">Signal Strategy</strong>) against the general market performance (<strong className="text-gray-400">Market Baseline</strong>) over various time horizons.
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1">
            <li><strong className="text-blue-400">Signal Strategy (Blue):</strong> The average return achieved after your specific condition was met.</li>
            <li><strong className="text-gray-400">Market Baseline (Gray):</strong> The average return for the S&P 500 over the same time periods across all historical data (Buy & Hold).</li>
          </ul>
          <p>
            If the blue bar is higher than the gray bar, your strategy historically outperforms the market average for that time period.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultsCharts;
