/**
 * Portfolio Analytics Utility
 * 
 * Provides comprehensive portfolio analysis including:
 * - Risk metrics (Sharpe, Sortino, Treynor ratios)
 * - Performance metrics (nominal, after-tax, vs benchmark)
 * - CAPM calculations
 * - Win/loss analysis
 */

// ============================================
// INTERNAL ASSUMPTIONS (Not displayed to user)
// ============================================
export const ASSUMPTIONS = {
  // 2025 Inflation Rate (estimated)
  inflationRate: 0.028, // 2.8%
  
  // Effective Tax Rate for capital gains (blended short/long term estimate)
  effectiveTaxRate: 0.20, // 20%
  
  // S&P 500 Expected Annual Performance
  spPerformance: 0.10, // 10% historical average
  
  // S&P 500 After-Tax Return Rate
  get spAfterTaxRR() {
    return this.spPerformance * (1 - this.effectiveTaxRate);
  },
  
  // Risk Free Rate (10-year Treasury yield approximation)
  riskFreeRate: 0.045, // 4.5%
  
  // S&P 500 Beta (by definition)
  spBeta: 1.0,
  
  // S&P 500 Treynor Ratio
  get spTreynorRatio() {
    return (this.spPerformance - this.riskFreeRate) / this.spBeta;
  },
  
  // Market volatility (S&P 500 annual standard deviation, historical ~15-20%)
  marketVolatility: 0.18, // 18%
  
  // Market risk premium
  get marketRiskPremium() {
    return this.spPerformance - this.riskFreeRate;
  },
};

// ============================================
// TYPE DEFINITIONS
// ============================================
export interface HoldingWithPrice {
  ticker: string;
  shares: number;
  costBasis: number | null;
  currentPrice: number;
  beta: number | null;
  isCash: boolean;
}

export interface PortfolioAnalytics {
  // Performance Metrics
  nominalPerformancePercent: number;
  nominalPerformanceDollars: number;
  afterTaxRRPercent: number;
  afterTaxRRDollars: number;
  rrAboveBenchmarkPercent: number;
  rrAboveBenchmarkDollars: number;
  
  // Risk Metrics
  sharpeRatio: number | null;
  portfolioBeta: number;
  portfolioCAPM: number; // Expected return based on CAPM
  maxDrawdownPercent: number;
  treynorRatio: number | null;
  sortinoRatio: number | null;
  
  // Win/Loss Analysis
  winners: number;
  losers: number;
  winRate: number;
  totalPositionsWithCostBasis: number;
  
  // Portfolio Summary
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  
  // Additional context
  hasEnoughDataForRatios: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a ticker is cash
 */
export function isCashTicker(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  return upper === 'CASH' || upper === '$CASH';
}

/**
 * Check if a ticker is likely a bond ETF/fund
 * These typically have very low or negative correlation to stocks
 */
export function isBondTicker(ticker: string): boolean {
  const bondTickers = [
    // Treasury bonds
    'TLT', 'IEF', 'SHY', 'GOVT', 'VGIT', 'VGLT', 'SCHO', 'SCHR', 'TIP', 'STIP', 'SCHP',
    // Aggregate bonds
    'BND', 'AGG', 'BNDX', 'SCHZ', 'FBND',
    // Corporate bonds
    'LQD', 'VCIT', 'VCSH', 'IGIB', 'IGSB',
    // High yield
    'HYG', 'JNK', 'USHY', 'SHYG',
    // Municipal bonds
    'MUB', 'VTEB', 'TFI',
    // International bonds
    'IAGG', 'BWX', 'EMB', 'VWOB',
    // Short-term / money market like
    'SHV', 'BIL', 'SGOV', 'TFLO',
  ];
  return bondTickers.includes(ticker.toUpperCase());
}

/**
 * Get default beta for a ticker type
 * - Cash: 0
 * - Bonds: ~0.2 (low correlation to stock market)
 * - Stocks: 1.0 (market beta)
 */
function getDefaultBeta(ticker: string, isCash: boolean): number {
  if (isCash) return 0;
  if (isBondTicker(ticker)) return 0.2; // Bonds have low correlation to stocks
  return 1.0; // Default to market beta for stocks
}

/**
 * Calculate portfolio beta (weighted average)
 */
export function calculatePortfolioBeta(holdings: HoldingWithPrice[]): number {
  let totalValue = 0;
  let weightedBeta = 0;
  
  holdings.forEach(h => {
    const value = h.shares * h.currentPrice;
    totalValue += value;
    
    // Use actual beta if available, otherwise use appropriate default
    const beta = (h.beta !== null && h.beta !== undefined) 
      ? h.beta 
      : getDefaultBeta(h.ticker, h.isCash);
    weightedBeta += beta * value;
  });
  
  return totalValue > 0 ? weightedBeta / totalValue : 0;
}

/**
 * Calculate portfolio volatility estimate using beta
 * σ_portfolio ≈ β_portfolio * σ_market
 */
export function estimatePortfolioVolatility(portfolioBeta: number): number {
  return Math.abs(portfolioBeta) * ASSUMPTIONS.marketVolatility;
}

/**
 * Calculate Sharpe Ratio
 * Sharpe = (Portfolio Return - Risk Free Rate) / Portfolio Std Dev
 */
export function calculateSharpeRatio(
  portfolioReturn: number,
  portfolioVolatility: number
): number | null {
  if (portfolioVolatility === 0) return null;
  return (portfolioReturn - ASSUMPTIONS.riskFreeRate) / portfolioVolatility;
}

/**
 * Calculate Treynor Ratio
 * Treynor = (Portfolio Return - Risk Free Rate) / Portfolio Beta
 */
export function calculateTreynorRatio(
  portfolioReturn: number,
  portfolioBeta: number
): number | null {
  if (portfolioBeta === 0) return null;
  return (portfolioReturn - ASSUMPTIONS.riskFreeRate) / portfolioBeta;
}

/**
 * Calculate Sortino Ratio
 * Sortino = (Portfolio Return - Risk Free Rate) / Downside Deviation
 * 
 * For estimation without historical data, we use:
 * Downside Dev ≈ Portfolio Volatility * 0.7 (approximation assuming ~30% of volatility is upside)
 */
export function calculateSortinoRatio(
  portfolioReturn: number,
  portfolioVolatility: number
): number | null {
  // Estimate downside deviation as ~70% of total volatility
  const downsideDeviation = portfolioVolatility * 0.7;
  if (downsideDeviation === 0) return null;
  return (portfolioReturn - ASSUMPTIONS.riskFreeRate) / downsideDeviation;
}

/**
 * Calculate CAPM Expected Return
 * E(R) = Rf + β * (E(Rm) - Rf)
 */
export function calculateCAPM(portfolioBeta: number): number {
  return ASSUMPTIONS.riskFreeRate + portfolioBeta * ASSUMPTIONS.marketRiskPremium;
}

/**
 * Calculate Max Drawdown from cost basis
 * This is a simplified calculation based on current unrealized losses
 */
export function calculateMaxDrawdown(holdings: HoldingWithPrice[]): number {
  let totalCostBasis = 0;
  let totalCurrentValue = 0;
  let peakValue = 0;
  
  holdings.forEach(h => {
    if (h.costBasis && !h.isCash) {
      const costValue = h.shares * h.costBasis;
      const currentValue = h.shares * h.currentPrice;
      totalCostBasis += costValue;
      totalCurrentValue += currentValue;
      // Assume cost basis was a "peak" for simplicity
      peakValue += costValue;
    }
  });
  
  if (peakValue === 0) return 0;
  
  // Drawdown = (Peak - Current) / Peak
  const drawdown = (peakValue - totalCurrentValue) / peakValue;
  return Math.max(0, drawdown); // Only return positive drawdowns (losses)
}

/**
 * Calculate win/loss statistics based on cost basis
 */
export function calculateWinLossStats(holdings: HoldingWithPrice[]): {
  winners: number;
  losers: number;
  winRate: number;
  totalWithCostBasis: number;
} {
  let winners = 0;
  let losers = 0;
  
  holdings.forEach(h => {
    if (h.costBasis && !h.isCash) {
      if (h.currentPrice >= h.costBasis) {
        winners++;
      } else {
        losers++;
      }
    }
  });
  
  const total = winners + losers;
  
  return {
    winners,
    losers,
    winRate: total > 0 ? winners / total : 0,
    totalWithCostBasis: total,
  };
}

// ============================================
// MAIN ANALYTICS FUNCTION
// ============================================

/**
 * Calculate comprehensive portfolio analytics
 */
export function calculatePortfolioAnalytics(
  holdings: HoldingWithPrice[]
): PortfolioAnalytics {
  // Filter out holdings with no price data
  const validHoldings = holdings.filter(h => h.currentPrice > 0 || h.isCash);
  
  // Calculate basic totals
  let totalValue = 0;
  let totalCostBasis = 0;
  
  validHoldings.forEach(h => {
    const value = h.shares * h.currentPrice;
    totalValue += value;
    
    if (h.costBasis) {
      totalCostBasis += h.shares * (h.isCash ? 1 : h.costBasis);
    } else if (h.isCash) {
      totalCostBasis += value; // Cash cost basis = current value
    }
  });
  
  const totalGainLoss = totalCostBasis > 0 ? totalValue - totalCostBasis : 0;
  
  // Calculate nominal performance
  const nominalPerformancePercent = totalCostBasis > 0 
    ? totalGainLoss / totalCostBasis 
    : 0;
  const nominalPerformanceDollars = totalGainLoss;
  
  // Calculate after-tax return
  // Only gains are taxed, losses can offset
  const taxOnGains = totalGainLoss > 0 
    ? totalGainLoss * ASSUMPTIONS.effectiveTaxRate 
    : 0;
  const afterTaxGainLoss = totalGainLoss - taxOnGains;
  const afterTaxRRPercent = totalCostBasis > 0 
    ? afterTaxGainLoss / totalCostBasis 
    : 0;
  const afterTaxRRDollars = afterTaxGainLoss;
  
  // Calculate return above benchmark
  // Compare after-tax return to S&P after-tax return
  const benchmarkReturn = totalCostBasis * ASSUMPTIONS.spAfterTaxRR;
  const rrAboveBenchmarkDollars = afterTaxGainLoss - benchmarkReturn;
  const rrAboveBenchmarkPercent = afterTaxRRPercent - ASSUMPTIONS.spAfterTaxRR;
  
  // Calculate portfolio beta
  const portfolioBeta = calculatePortfolioBeta(validHoldings);
  
  // Calculate CAPM expected return
  const portfolioCAPM = calculateCAPM(portfolioBeta);
  
  // Estimate portfolio volatility
  const portfolioVolatility = estimatePortfolioVolatility(portfolioBeta);
  
  // Calculate risk ratios
  const hasEnoughData = totalCostBasis > 0 && validHoldings.length > 0;
  
  const sharpeRatio = hasEnoughData 
    ? calculateSharpeRatio(nominalPerformancePercent, portfolioVolatility)
    : null;
    
  const treynorRatio = hasEnoughData && portfolioBeta !== 0
    ? calculateTreynorRatio(nominalPerformancePercent, portfolioBeta)
    : null;
    
  const sortinoRatio = hasEnoughData
    ? calculateSortinoRatio(nominalPerformancePercent, portfolioVolatility)
    : null;
  
  // Calculate max drawdown
  const maxDrawdownPercent = calculateMaxDrawdown(validHoldings);
  
  // Calculate win/loss stats
  const winLossStats = calculateWinLossStats(validHoldings);
  
  return {
    // Performance Metrics
    nominalPerformancePercent,
    nominalPerformanceDollars,
    afterTaxRRPercent,
    afterTaxRRDollars,
    rrAboveBenchmarkPercent,
    rrAboveBenchmarkDollars,
    
    // Risk Metrics
    sharpeRatio,
    portfolioBeta,
    portfolioCAPM,
    maxDrawdownPercent,
    treynorRatio,
    sortinoRatio,
    
    // Win/Loss Analysis
    winners: winLossStats.winners,
    losers: winLossStats.losers,
    winRate: winLossStats.winRate,
    totalPositionsWithCostBasis: winLossStats.totalWithCostBasis,
    
    // Portfolio Summary
    totalValue,
    totalCostBasis,
    totalGainLoss,
    
    // Context
    hasEnoughDataForRatios: hasEnoughData,
  };
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format a ratio for display (handles null and provides context)
 */
export function formatRatio(ratio: number | null, decimals: number = 2): string {
  if (ratio === null) return 'N/A';
  return ratio.toFixed(decimals);
}

/**
 * Get Sharpe ratio interpretation
 */
export function interpretSharpeRatio(sharpe: number | null): {
  label: string;
  color: string;
  description: string;
} {
  if (sharpe === null) {
    return { 
      label: 'Insufficient Data', 
      color: 'gray',
      description: 'Need cost basis data to calculate'
    };
  }
  
  if (sharpe < 0) {
    return { 
      label: 'Negative', 
      color: 'red',
      description: 'Underperforming risk-free rate'
    };
  }
  if (sharpe < 0.5) {
    return { 
      label: 'Below Average', 
      color: 'orange',
      description: 'Low risk-adjusted return'
    };
  }
  if (sharpe < 1.0) {
    return { 
      label: 'Acceptable', 
      color: 'yellow',
      description: 'Moderate risk-adjusted return'
    };
  }
  if (sharpe < 2.0) {
    return { 
      label: 'Good', 
      color: 'lime',
      description: 'Strong risk-adjusted return'
    };
  }
  return { 
    label: 'Excellent', 
    color: 'green',
    description: 'Exceptional risk-adjusted return'
  };
}

/**
 * Get Treynor ratio interpretation
 */
export function interpretTreynorRatio(treynor: number | null): {
  label: string;
  color: string;
} {
  if (treynor === null) return { label: 'N/A', color: 'gray' };
  
  const spTreynor = ASSUMPTIONS.spTreynorRatio;
  
  if (treynor < 0) return { label: 'Negative', color: 'red' };
  if (treynor < spTreynor * 0.5) return { label: 'Below Market', color: 'orange' };
  if (treynor < spTreynor) return { label: 'Near Market', color: 'yellow' };
  if (treynor < spTreynor * 1.5) return { label: 'Above Market', color: 'lime' };
  return { label: 'Excellent', color: 'green' };
}

/**
 * Get win rate interpretation
 */
export function interpretWinRate(winRate: number): {
  label: string;
  color: string;
} {
  if (winRate >= 0.7) return { label: 'Excellent', color: 'green' };
  if (winRate >= 0.6) return { label: 'Good', color: 'lime' };
  if (winRate >= 0.5) return { label: 'Break Even', color: 'yellow' };
  if (winRate >= 0.4) return { label: 'Below Average', color: 'orange' };
  return { label: 'Poor', color: 'red' };
}

