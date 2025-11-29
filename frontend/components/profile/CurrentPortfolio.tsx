import React from 'react';
import {
  PortfolioAnalytics,
  formatRatio,
  interpretSharpeRatio,
  interpretTreynorRatio,
  interpretWinRate,
} from '../../utils/portfolioAnalytics';

interface Holding {
  id?: number;
  ticker: string;
  shares: number;
  cost_basis?: number;
  purchase_date?: string;
  account_type: string;
  notes?: string;
}

interface TickerData {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  beta: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
}

interface PortfolioStats {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  portfolioBeta: number;
  weightedDividendYield: number;
  sectorAllocation: Record<string, number>;
  numberOfPositions: number;
  averagePE: number;
  largestPosition: { ticker: string; percent: number } | null;
  diversificationScore: number;
  equitiesPercent: number;
  equitiesValue: number;
  bondsCashPercent: number;
  bondsCashValue: number;
  bondsPercent: number;
  bondsValue: number;
  cashPercent: number;
  cashValue: number;
}

interface MaxDrawdownData {
  max_drawdown: number;
  peak_value: number;
  trough_value: number;
  peak_date: string | null;
  trough_date: string | null;
}

interface CurrentPortfolioProps {
  holdings: Holding[];
  newHolding: Holding;
  setNewHolding: React.Dispatch<React.SetStateAction<Holding>>;
  addHolding: () => Promise<void>;
  deleteHolding: (holdingId: number) => Promise<void>;
  tickerData: Record<string, TickerData>;
  portfolioStats: PortfolioStats;
  portfolioAnalytics: PortfolioAnalytics | null;
  priceLoading: boolean;
  fetchPrices: () => Promise<void>;
  saving: boolean;
  maxDrawdownData: MaxDrawdownData | null;
  drawdownLoading: boolean;
  isCash: (ticker: string) => boolean;
  formatCurrency: (num: number) => string;
  getPositionPercent: (ticker: string) => number;
  // Editing shares state
  editingHoldingId: number | null;
  editingShares: string;
  setEditingShares: React.Dispatch<React.SetStateAction<string>>;
  startEditingShares: (holdingId: number, currentShares: number) => void;
  finishEditingShares: () => void;
  cancelEditingShares: () => void;
}

const ACCOUNT_TYPES = [
  { value: 'taxable', label: 'Taxable Brokerage' },
  { value: 'ira', label: 'Traditional IRA' },
  { value: 'roth_ira', label: 'Roth IRA' },
  { value: '401k', label: '401(k)' },
];

export default function CurrentPortfolio({
  holdings,
  newHolding,
  setNewHolding,
  addHolding,
  deleteHolding,
  tickerData,
  portfolioStats,
  portfolioAnalytics,
  priceLoading,
  fetchPrices,
  saving,
  maxDrawdownData,
  drawdownLoading,
  isCash,
  formatCurrency,
  getPositionPercent,
  editingHoldingId,
  editingShares,
  setEditingShares,
  startEditingShares,
  finishEditingShares,
  cancelEditingShares,
}: CurrentPortfolioProps) {
  return (
    <div className="space-y-6">
      {/* Portfolio Summary Stats */}
      {holdings.length > 0 && (
        <>
          {/* Main Value Card */}
          <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl border border-emerald-800/50 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-gray-400 text-sm mb-1">Total Portfolio Value</div>
                <div className="text-4xl font-bold text-white">
                  {priceLoading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    formatCurrency(portfolioStats.totalValue)
                  )}
                </div>
                {portfolioStats.totalCostBasis > 0 && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-lg font-semibold ${portfolioStats.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {portfolioStats.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalGainLoss)}
                    </span>
                    <span className={`text-sm px-2 py-0.5 rounded ${portfolioStats.totalGainLoss >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {portfolioStats.totalGainLossPercent >= 0 ? '+' : ''}{portfolioStats.totalGainLossPercent.toFixed(2)}% all time
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-sm mb-1">Today's Change</div>
                <div className={`text-2xl font-bold ${portfolioStats.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {portfolioStats.dayChange >= 0 ? '+' : ''}{formatCurrency(portfolioStats.dayChange)}
                </div>
                <div className={`text-sm ${portfolioStats.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {portfolioStats.dayChangePercent >= 0 ? '+' : ''}{portfolioStats.dayChangePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Portfolio Beta</div>
              <div className="text-2xl font-bold text-white">{portfolioStats.portfolioBeta.toFixed(2)}</div>
              <div className="text-sm text-gray-500">
                {portfolioStats.portfolioBeta > 1.2 ? 'High risk' : 
                 portfolioStats.portfolioBeta < 0.8 ? 'Low risk' : 'Moderate'}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Positions</div>
              <div className="text-2xl font-bold text-white">{portfolioStats.numberOfPositions}</div>
              <div className="text-sm text-gray-500">holdings</div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg P/E Ratio</div>
              <div className="text-2xl font-bold text-white">
                {portfolioStats.averagePE > 0 ? portfolioStats.averagePE.toFixed(1) : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">portfolio avg</div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Diversification</div>
              <div className="text-2xl font-bold text-white">{Math.round(portfolioStats.diversificationScore)}</div>
              <div className="text-sm text-gray-500">score /100</div>
            </div>
          </div>

          {/* Sector Allocation */}
          {Object.keys(portfolioStats.sectorAllocation).length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Sector Allocation</h3>
              <div className="space-y-3">
                {Object.entries(portfolioStats.sectorAllocation)
                  .sort((a, b) => b[1] - a[1])
                  .map(([sector, percent]) => (
                    <div key={sector} className="flex items-center gap-4">
                      <div className="w-28 text-sm text-gray-400 truncate">{sector}</div>
                      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                      <div className="w-14 text-right text-sm font-medium text-white">{percent.toFixed(1)}%</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Risk Analysis */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Risk Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    portfolioStats.portfolioBeta > 1.2 ? 'bg-red-500' :
                    portfolioStats.portfolioBeta < 0.8 ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-gray-400 text-sm">Volatility</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {portfolioStats.portfolioBeta > 1.2 ? 'High' :
                   portfolioStats.portfolioBeta < 0.8 ? 'Low' : 'Moderate'}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Beta: {portfolioStats.portfolioBeta.toFixed(2)}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    (portfolioStats.largestPosition?.percent || 0) > 30 ? 'bg-red-500' :
                    (portfolioStats.largestPosition?.percent || 0) > 20 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <span className="text-gray-400 text-sm">Concentration</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {(portfolioStats.largestPosition?.percent || 0) > 30 ? 'High' :
                   (portfolioStats.largestPosition?.percent || 0) > 20 ? 'Moderate' : 'Low'}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {portfolioStats.largestPosition 
                    ? `Largest: ${portfolioStats.largestPosition.ticker} (${portfolioStats.largestPosition.percent.toFixed(1)}%)`
                    : 'No positions'}
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    Object.keys(portfolioStats.sectorAllocation).length >= 5 ? 'bg-green-500' :
                    Object.keys(portfolioStats.sectorAllocation).length >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-400 text-sm">Sector Diversity</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {Object.keys(portfolioStats.sectorAllocation).length} Sectors
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {Object.keys(portfolioStats.sectorAllocation).length >= 5
                    ? 'Well diversified'
                    : 'Consider more sectors'}
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Portfolio Analytics */}
          {portfolioAnalytics && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Portfolio Analytics</h3>
              
              {/* Asset Allocation */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Asset Allocation</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Equities */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <div className="text-gray-500 text-xs">Equities</div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {portfolioStats.equitiesPercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{formatCurrency(portfolioStats.equitiesValue)}</div>
                  </div>

                  {/* Bonds */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                      <div className="text-gray-500 text-xs">Bonds</div>
                    </div>
                    <div className="text-2xl font-bold text-violet-400">
                      {portfolioStats.bondsPercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{formatCurrency(portfolioStats.bondsValue)}</div>
                  </div>

                  {/* Cash */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <div className="text-gray-500 text-xs">Cash</div>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">
                      {portfolioStats.cashPercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{formatCurrency(portfolioStats.cashValue)}</div>
                  </div>

                  {/* Allocation Bar */}
                  <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col justify-center">
                    <div className="flex items-center gap-0.5 h-6 rounded-full overflow-hidden bg-gray-700">
                      {portfolioStats.equitiesPercent > 0 && (
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${portfolioStats.equitiesPercent}%` }}
                        />
                      )}
                      {portfolioStats.bondsPercent > 0 && (
                        <div 
                          className="h-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${portfolioStats.bondsPercent}%` }}
                        />
                      )}
                      {portfolioStats.cashPercent > 0 && (
                        <div 
                          className="h-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${portfolioStats.cashPercent}%` }}
                        />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      {portfolioStats.bondsCashPercent > 0 
                        ? `${portfolioStats.equitiesPercent.toFixed(0)}/${portfolioStats.bondsCashPercent.toFixed(0)} equity/fixed`
                        : '100% equities'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Performance</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-gray-500 text-xs mb-1">Nominal Return</div>
                    <div className={`text-xl font-bold ${portfolioAnalytics.nominalPerformancePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(portfolioAnalytics.nominalPerformancePercent * 100).toFixed(2)}%
                    </div>
                    <div className={`text-sm ${portfolioAnalytics.nominalPerformanceDollars >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      {portfolioAnalytics.nominalPerformanceDollars >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.nominalPerformanceDollars)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-gray-500 text-xs mb-1">After-Tax Return</div>
                    <div className={`text-xl font-bold ${portfolioAnalytics.afterTaxRRPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(portfolioAnalytics.afterTaxRRPercent * 100).toFixed(2)}%
                    </div>
                    <div className={`text-sm ${portfolioAnalytics.afterTaxRRDollars >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      {portfolioAnalytics.afterTaxRRDollars >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.afterTaxRRDollars)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-gray-500 text-xs mb-1">vs S&P 500</div>
                    <div className={`text-xl font-bold ${portfolioAnalytics.rrAboveBenchmarkPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {portfolioAnalytics.rrAboveBenchmarkPercent >= 0 ? '+' : ''}{(portfolioAnalytics.rrAboveBenchmarkPercent * 100).toFixed(2)}%
                    </div>
                    <div className={`text-sm ${portfolioAnalytics.rrAboveBenchmarkDollars >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      {portfolioAnalytics.rrAboveBenchmarkDollars >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.rrAboveBenchmarkDollars)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk-Adjusted Metrics */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Risk-Adjusted Returns</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Sharpe Ratio */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-gray-500 text-xs">Sharpe Ratio</div>
                      <div className="group relative">
                        <span className="text-gray-600 cursor-help">ⓘ</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Measures risk-adjusted return. Higher is better. &gt;1.0 is good, &gt;2.0 is excellent.
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {formatRatio(portfolioAnalytics.sharpeRatio)}
                    </div>
                    {portfolioAnalytics.sharpeRatio !== null && (
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                        interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'green' ? 'bg-green-900/50 text-green-400' :
                        interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'lime' ? 'bg-lime-900/50 text-lime-400' :
                        interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
                        interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'orange' ? 'bg-orange-900/50 text-orange-400' :
                        interpretSharpeRatio(portfolioAnalytics.sharpeRatio).color === 'red' ? 'bg-red-900/50 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {interpretSharpeRatio(portfolioAnalytics.sharpeRatio).label}
                      </div>
                    )}
                  </div>

                  {/* Sortino Ratio */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-gray-500 text-xs">Sortino Ratio</div>
                      <div className="group relative">
                        <span className="text-gray-600 cursor-help">ⓘ</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Like Sharpe but only penalizes downside volatility. Better for asymmetric returns.
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {formatRatio(portfolioAnalytics.sortinoRatio)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">downside-adjusted</div>
                  </div>

                  {/* Treynor Ratio */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-gray-500 text-xs">Treynor Ratio</div>
                      <div className="group relative">
                        <span className="text-gray-600 cursor-help">ⓘ</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Return per unit of market risk (beta). Compare to S&P's ~5.5%.
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {portfolioAnalytics.treynorRatio !== null 
                        ? `${(portfolioAnalytics.treynorRatio * 100).toFixed(1)}%`
                        : 'N/A'
                      }
                    </div>
                    {portfolioAnalytics.treynorRatio !== null && (
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                        interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'green' ? 'bg-green-900/50 text-green-400' :
                        interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'lime' ? 'bg-lime-900/50 text-lime-400' :
                        interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
                        interpretTreynorRatio(portfolioAnalytics.treynorRatio).color === 'orange' ? 'bg-orange-900/50 text-orange-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {interpretTreynorRatio(portfolioAnalytics.treynorRatio).label}
                      </div>
                    )}
                  </div>

                  {/* CAPM Expected Return */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-gray-500 text-xs">CAPM Expected</div>
                      <div className="group relative">
                        <span className="text-gray-600 cursor-help">ⓘ</span>
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Expected return based on portfolio beta. Rf + β(Rm - Rf)
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(portfolioAnalytics.portfolioCAPM * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">annual expected</div>
                  </div>
                </div>
              </div>

              {/* Risk & Win/Loss Metrics */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Risk & Position Analysis</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Portfolio Beta */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-gray-500 text-xs mb-1">Portfolio Beta</div>
                    <div className="text-2xl font-bold text-white">
                      {portfolioAnalytics.portfolioBeta.toFixed(2)}
                    </div>
                    <div className={`text-xs mt-1 ${
                      portfolioAnalytics.portfolioBeta > 1.2 ? 'text-red-400' :
                      portfolioAnalytics.portfolioBeta < 0.8 ? 'text-green-400' :
                      'text-yellow-400'
                    }`}>
                      {portfolioAnalytics.portfolioBeta > 1.2 ? 'High volatility' :
                       portfolioAnalytics.portfolioBeta < 0.8 ? 'Low volatility' :
                       'Market-like'}
                    </div>
                  </div>

                  {/* Max Drawdown */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-gray-500 text-xs">Max Drawdown</div>
                      {maxDrawdownData?.peak_date && maxDrawdownData?.trough_date && (
                        <div className="group relative">
                          <span className="text-gray-600 cursor-help">ⓘ</span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Peak: {maxDrawdownData.peak_date}<br/>
                            Trough: {maxDrawdownData.trough_date}
                          </div>
                        </div>
                      )}
                    </div>
                    {drawdownLoading ? (
                      <div className="text-xl font-bold text-gray-500 animate-pulse">Loading...</div>
                    ) : maxDrawdownData ? (
                      <>
                        <div className={`text-2xl font-bold ${
                          maxDrawdownData.max_drawdown > 0.2 ? 'text-red-400' :
                          maxDrawdownData.max_drawdown > 0.1 ? 'text-orange-400' :
                          maxDrawdownData.max_drawdown > 0 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          -{(maxDrawdownData.max_drawdown * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">24-month historical</div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-500">N/A</div>
                        <div className="text-xs text-gray-500 mt-1">no historical data</div>
                      </>
                    )}
                  </div>

                  {/* Win Rate */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-gray-500 text-xs mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-white">
                      {portfolioAnalytics.totalPositionsWithCostBasis > 0
                        ? `${(portfolioAnalytics.winRate * 100).toFixed(0)}%`
                        : 'N/A'
                      }
                    </div>
                    {portfolioAnalytics.totalPositionsWithCostBasis > 0 && (
                      <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${
                        interpretWinRate(portfolioAnalytics.winRate).color === 'green' ? 'bg-green-900/50 text-green-400' :
                        interpretWinRate(portfolioAnalytics.winRate).color === 'lime' ? 'bg-lime-900/50 text-lime-400' :
                        interpretWinRate(portfolioAnalytics.winRate).color === 'yellow' ? 'bg-yellow-900/50 text-yellow-400' :
                        interpretWinRate(portfolioAnalytics.winRate).color === 'orange' ? 'bg-orange-900/50 text-orange-400' :
                        'bg-red-900/50 text-red-400'
                      }`}>
                        {interpretWinRate(portfolioAnalytics.winRate).label}
                      </div>
                    )}
                  </div>

                  {/* Winners/Losers */}
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-gray-500 text-xs mb-1">Positions</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-green-400">{portfolioAnalytics.winners}W</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-xl font-bold text-red-400">{portfolioAnalytics.losers}L</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {portfolioAnalytics.totalPositionsWithCostBasis} with cost basis
                    </div>
                  </div>
                </div>
              </div>

              {/* Note about data requirements */}
              {!portfolioAnalytics.hasEnoughDataForRatios && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    💡 Add cost basis to your positions for more accurate analytics calculations.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Holding Form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Position</h2>
          <button
            onClick={() => setNewHolding({ ticker: 'CASH', shares: 0, cost_basis: undefined, account_type: newHolding.account_type })}
            className="text-sm px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-lg transition-colors flex items-center gap-1"
          >
            <span>💵</span> Add Cash
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4" onKeyDown={(e) => {
          if (e.key === 'Enter' && newHolding.ticker && newHolding.shares) {
            e.preventDefault();
            addHolding();
          }
        }}>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {isCash(newHolding.ticker) ? 'Type' : 'Ticker'}
            </label>
            <input
              type="text"
              value={newHolding.ticker}
              onChange={(e) => setNewHolding({ ...newHolding, ticker: e.target.value.toUpperCase() })}
              placeholder="AAPL or CASH"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {isCash(newHolding.ticker) ? 'Amount ($)' : 'Shares'}
            </label>
            <input
              type="number"
              value={newHolding.shares || ''}
              onChange={(e) => setNewHolding({ ...newHolding, shares: parseFloat(e.target.value) || 0 })}
              placeholder={isCash(newHolding.ticker) ? '10000' : '10'}
              min="0"
              step={isCash(newHolding.ticker) ? '100' : '0.001'}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Avg Cost (optional)</label>
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
          Add Position
        </button>
      </div>

      {/* Holdings List with Percentages */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Your Holdings ({holdings.length})
          </h2>
          {holdings.length > 0 && (
            <button
              onClick={fetchPrices}
              disabled={priceLoading}
              className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${priceLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Prices
            </button>
          )}
        </div>
        
        {holdings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <p>No holdings yet. Add your first position above.</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-800/50 text-xs text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Stock</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Shares</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">% of Portfolio</div>
              <div className="col-span-1"></div>
            </div>

            <div className="divide-y divide-gray-800">
              {holdings.map((holding) => {
                const holdingIsCash = isCash(holding.ticker);
                const data = tickerData[holding.ticker];
                const price = holdingIsCash ? 1 : (data?.price || 0);
                const positionValue = holding.shares * price;
                const positionPercent = getPositionPercent(holding.ticker);
                const gainLoss = !holdingIsCash && holding.cost_basis && data?.price 
                  ? (data.price - holding.cost_basis) * holding.shares 
                  : null;

                return (
                  <div key={holding.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                    {/* Desktop View */}
                    <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                            holdingIsCash 
                              ? 'bg-green-900/50 text-green-400' 
                              : 'bg-gray-800 text-emerald-400'
                          }`}>
                            {holdingIsCash ? '💵' : holding.ticker.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {holdingIsCash ? 'Cash' : holding.ticker}
                            </div>
                            <div className="text-xs text-gray-500">
                              {holdingIsCash ? 'Cash reserves' : (data?.name || 'Loading...')}
                            </div>
                            {!holdingIsCash && data?.beta && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                                β {data.beta.toFixed(2)}
                              </span>
                            )}
                            {holdingIsCash && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-900/30 rounded text-green-400">
                                β 0.00
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 text-right">
                        {holdingIsCash ? (
                          <div>
                            <div className="text-white font-medium">$1.00</div>
                            <div className="text-xs text-gray-500">per unit</div>
                          </div>
                        ) : data?.price ? (
                          <div>
                            <div className="text-white font-medium">${data.price.toFixed(2)}</div>
                            {data.change_percent !== null && (
                              <div className={`text-xs ${data.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {data.change_percent >= 0 ? '+' : ''}{data.change_percent.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>

                      <div className="col-span-2 text-right">
                        {editingHoldingId === holding.id ? (
                          <input
                            type="number"
                            value={editingShares}
                            onChange={(e) => setEditingShares(e.target.value)}
                            onBlur={finishEditingShares}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') finishEditingShares();
                              if (e.key === 'Escape') cancelEditingShares();
                            }}
                            className="w-24 px-2 py-1 bg-gray-700 border border-emerald-500 rounded text-white text-right focus:outline-none"
                            autoFocus
                            step={holdingIsCash ? '100' : '0.001'}
                          />
                        ) : (
                          <div 
                            className="cursor-pointer hover:text-emerald-400 transition-colors"
                            onDoubleClick={() => holding.id && startEditingShares(holding.id, holding.shares)}
                            title="Double-click to edit"
                          >
                            <div className="text-white">
                              {holdingIsCash 
                                ? formatCurrency(holding.shares)
                                : holding.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })
                              }
                            </div>
                            {!holdingIsCash && holding.cost_basis && (
                              <div className="text-xs text-gray-500">${holding.cost_basis.toFixed(2)} avg</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 text-right">
                        {positionValue > 0 ? (
                          <div>
                            <div className="text-white font-medium">{formatCurrency(positionValue)}</div>
                            {gainLoss !== null && (
                              <div className={`text-xs ${gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>

                      <div className="col-span-2 text-right">
                        {positionPercent > 0 ? (
                          <div>
                            <div className="text-lg font-bold text-emerald-400">{positionPercent.toFixed(1)}%</div>
                            <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, positionPercent)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>

                      <div className="col-span-1 text-right">
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

                    {/* Mobile View */}
                    <div className="md:hidden">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                            holdingIsCash 
                              ? 'bg-green-900/50 text-green-400' 
                              : 'bg-gray-800 text-emerald-400'
                          }`}>
                            {holdingIsCash ? '💵' : holding.ticker.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {holdingIsCash ? 'Cash' : holding.ticker}
                            </div>
                            <div className="text-xs text-gray-500">
                              {holdingIsCash ? 'Cash reserves' : (data?.name || 'Loading...')}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => holding.id && deleteHolding(holding.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-gray-500 text-xs">{holdingIsCash ? 'Amount' : 'Shares'}</div>
                          <div className="text-white">
                            {holdingIsCash ? formatCurrency(holding.shares) : holding.shares}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Price</div>
                          <div className="text-white">
                            {holdingIsCash ? '$1.00' : (data?.price ? `$${data.price.toFixed(2)}` : '—')}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Value</div>
                          <div className="text-white">{positionValue > 0 ? formatCurrency(positionValue) : '—'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">% Portfolio</div>
                          <div className="text-emerald-400 font-bold">{positionPercent > 0 ? `${positionPercent.toFixed(1)}%` : '—'}</div>
                        </div>
                      </div>

                      {positionPercent > 0 && (
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mt-3">
                          <div 
                            className={`h-full rounded-full ${holdingIsCash ? 'bg-green-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, positionPercent)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

