import pandas as pd
import numpy as np

class Backtester:
    def __init__(self, data):
        self.data = data.copy()
        self._precalculate_forward_returns()

    def _precalculate_forward_returns(self):
        """Pre-calculates forward returns for common periods."""
        # Trading days approximation: 1m=21, 3m=63, 6m=126, 1y=252, 3y=756, 5y=1260, 10y=2520
        periods = {
            '1W': 5,
            '1M': 21, 
            '3M': 63, 
            '6M': 126, 
            '1Y': 252, 
            '3Y': 756, 
            '5Y': 1260, 
            '10Y': 2520
        }
        
        for name, days in periods.items():
            # Calculate percentage change from today to 'days' in the future
            # shift(-days) brings the future price to the current row
            self.data[f'FwdReturn_{name}'] = self.data['Adj Close'].shift(-days) / self.data['Adj Close'] - 1

    def filter_dates(self, condition_func):
        """
        Returns a boolean Series where condition_func(row) is True.
        condition_func should accept the entire dataframe or a row.
        However, for vectorization, it's better if condition_func operates on the dataframe columns.
        """
        try:
            return condition_func(self.data)
        except Exception as e:
            print(f"Error applying filter: {e}")
            return pd.Series([False] * len(self.data), index=self.data.index)

    def analyze(self, condition_mask, periods=['1M', '3M', '6M', '1Y']):
        """
        Analyzes returns for dates where condition_mask is True.
        """
        subset = self.data[condition_mask]
        results = {}
        
        if len(subset) == 0:
            return {"count": 0}

        results['count'] = len(subset)
        
        for period in periods:
            col = f'FwdReturn_{period}'
            if col in subset.columns:
                vals = subset[col].dropna()
                if len(vals) > 0:
                    stats = {
                        'mean': vals.mean(),
                        'median': vals.median(),
                        'std': vals.std(),
                        'min': vals.min(),
                        'max': vals.max(),
                        'win_rate': (vals > 0).mean()
                    }
                    
                    # Calculate CAGR for periods > 1 Year
                    # We approximate years based on trading days: 252 days/year
                    # Period string to years map
                    period_years = {
                        '3Y': 3,
                        '5Y': 5,
                        '10Y': 10
                    }
                    
                    if period in period_years:
                        years = period_years[period]
                        # CAGR = (1 + MeanReturn)^(1/n) - 1
                        # Note: This uses the arithmetic mean of total returns. 
                        # For a true portfolio CAGR, we'd need the geometric mean of the returns, 
                        # but for "average outcome of this signal", this is the standard way to present it.
                        if stats['mean'] > -1: # Avoid complex numbers
                            stats['cagr'] = (1 + stats['mean'])**(1/years) - 1
                        else:
                            stats['cagr'] = None
                    else:
                        stats['cagr'] = None
                        
                    results[period] = stats
                else:
                    results[period] = None
            else:
                results[period] = "Data not available"
                
        return results

    def get_signals(self, condition_mask, periods=['1M']):
        """
        Returns a dataframe with the signal dates and their forward returns.
        Useful for verification.
        """
        subset = self.data[condition_mask].copy()
        cols = ['Adj Close'] + [f'FwdReturn_{p}' for p in periods if f'FwdReturn_{p}' in subset.columns]
        return subset[cols]
