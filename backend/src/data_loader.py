import yfinance as yf
import pandas as pd
import os

class DataLoader:
    def __init__(self):
        self.ticker = "^GSPC"

    def fetch_sp500_data(self, start_date="1920-01-01"):
        """Fetches S&P 500 data from yfinance."""
        print(f"Fetching {self.ticker} data from {start_date}...")
        df = yf.download(self.ticker, start=start_date, progress=False)
        
        # Flatten multi-index columns if present (common in newer yfinance)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        # Ensure index is datetime
        df.index = pd.to_datetime(df.index)
        
        # Calculate returns if not present
        close_col = 'Adj Close' if 'Adj Close' in df.columns else 'Close'
        if 'Return' not in df.columns:
            df['Return'] = df[close_col].pct_change()
            
        # Standardize on 'Adj Close' for downstream compatibility
        if 'Adj Close' not in df.columns:
            df['Adj Close'] = df['Close']
            
        return df

    def load_pe_data(self, filepath):
        """
        Loads P/E data from a CSV.
        Expected format: Date, PE
        """
        if not os.path.exists(filepath):
            print(f"Warning: P/E data file not found at {filepath}")
            return None
            
        df = pd.read_csv(filepath)
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.set_index('Date')
        return df

    def merge_data(self, price_df, pe_df):
        """Merges price data with P/E data."""
        if pe_df is None:
            return price_df
            
        # Reindex P/E data to match price data, forward filling values
        # This handles cases where P/E dates (e.g., 1st of month) are not trading days
        pe_reindexed = pe_df.reindex(price_df.index, method='ffill')
        
        merged = price_df.copy()
        merged['PE'] = pe_reindexed['PE']
        return merged
