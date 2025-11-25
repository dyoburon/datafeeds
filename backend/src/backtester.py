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
        Supports dynamic calculation for custom periods (e.g., '5D', '21D').
        """
        subset = self.data[condition_mask]
        results = {}
        
        if len(subset) == 0:
            return {"count": 0}

        results['count'] = len(subset)
        
        # Helper to parse period string to days (e.g. "5D" -> 5, "2W" -> 10)
        def parse_period(p):
            if p.endswith('D'): return int(p[:-1])
            if p.endswith('W'): return int(p[:-1]) * 5
            if p.endswith('M'): return int(p[:-1]) * 21
            if p.endswith('Y'): return int(p[:-1]) * 252
            return None

        for period in periods:
            col = f'FwdReturn_{period}'
            
            # 1. Check if pre-calculated
            if col in self.data.columns:
                vals = self.data.loc[subset.index, col] # Use loc to ensure alignment
            
            # 2. If not, calculate on the fly
            else:
                days = parse_period(period)
                if days:
                    # Calculate specifically for these indices
                    # We calculate for full DF to ensure correct shifting
                    temp_series = self.data['Adj Close'].shift(-days) / self.data['Adj Close'] - 1
                    vals = temp_series.loc[subset.index]
                else:
                    results[period] = "Invalid period format"
                    continue

            # Clean up NaN values (e.g. recent dates where future return is unknown)
            vals = vals.dropna()

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
                period_years = {'3Y': 3, '5Y': 5, '10Y': 10}
                if period in period_years:
                    years = period_years[period]
                    if stats['mean'] > -1: # Avoid complex numbers
                        stats['cagr'] = (1 + stats['mean'])**(1/years) - 1
                    else:
                        stats['cagr'] = None
                else:
                    stats['cagr'] = None
                    
                results[period] = stats
            else:
                results[period] = "Data not available"
                
        return results

    @staticmethod
    def expand_monthly_mask(monthly_mask, daily_index):
        """
        Robustly maps a monthly boolean mask (indexed by month-end) to a daily index.
        Returns a daily boolean Series where every day in a marked month is True.
        """
        # Convert both to PeriodIndex ('M') to ignore specific timestamps
        monthly_periods = monthly_mask.index.to_period('M')
        
        # Ensure it is a Series indexed by Period
        period_mask = monthly_mask.copy()
        period_mask.index = monthly_periods
        
        # Create daily periods
        daily_periods = daily_index.to_period('M')
        
        # Map
        daily_result = daily_periods.map(period_mask)
        
        # Convert Index/array back to Series
        daily_series = pd.Series(daily_result, index=daily_index)
        
        # Fill NaNs (months not in the mask) with False
        return daily_series.fillna(False).astype(bool)

    def get_signals(self, condition_mask, periods=['1M']):
        """
        Returns a dataframe with the signal dates and their forward returns.
        Dynamically calculates columns if missing.
        """
        subset = self.data[condition_mask].copy()
        
        # Helper to parse period string to days (e.g. "5D" -> 5, "2W" -> 10)
        def parse_period(p):
            if p.endswith('D'): return int(p[:-1])
            if p.endswith('W'): return int(p[:-1]) * 5
            if p.endswith('M'): return int(p[:-1]) * 21
            if p.endswith('Y'): return int(p[:-1]) * 252
            return None

        cols_to_return = ['Adj Close']
        
        for p in periods:
            col_name = f'FwdReturn_{p}'
            if col_name not in self.data.columns:
                days = parse_period(p)
                if days:
                    self.data[col_name] = self.data['Adj Close'].shift(-days) / self.data['Adj Close'] - 1
            
            if col_name in self.data.columns:
                 # We need to ensure 'subset' has this column
                 # subset is a copy, so we need to join or assign
                 subset[col_name] = self.data.loc[subset.index, col_name]
                 cols_to_return.append(col_name)

        return subset[cols_to_return]

    def get_baseline_stats(self, periods=['1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y']):
        """
        Calculates baseline statistics for the entire dataset (control group).
        """
        # Create a mask of all True values
        mask = pd.Series([True] * len(self.data), index=self.data.index)
        return self.analyze(mask, periods=periods)
