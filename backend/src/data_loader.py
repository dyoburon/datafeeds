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
        Loads P/E data from Shiller JSON file.
        Extracts Date and PE10 (Shiller P/E ratio) columns.
        """
        if not os.path.exists(filepath):
            print(f"Warning: P/E data file not found at {filepath}")
            return None
        
        import json
        
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        # Create DataFrame from JSON
        df = pd.DataFrame(data)
        
        # Convert Date to datetime and set as index
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.set_index('Date')
        
        # Extract just the PE10 column and rename to PE
        pe_df = df[['PE10']].copy()
        pe_df = pe_df.rename(columns={'PE10': 'PE'})
        
        # Sort by date and remove duplicates
        pe_df = pe_df.sort_index()
        pe_df = pe_df[~pe_df.index.duplicated(keep='first')]
        
        return pe_df

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

    def get_market_context(self, df):
        """
        Fetches today's technical stats and top news to feed the LLM.
        """
        # 1. Technical Stats
        today = df.iloc[-1]
        # Ensure we have enough data
        if len(df) < 30:
             prev_30 = df
        else:
             prev_30 = df.iloc[-30:]
        
        stats = {
            "date": str(today.name.date()),
            "close": round(today['Adj Close'], 2),
            "return_pct": round(today['Return'] * 100, 2),
            "volume_rel": round(today['Volume'] / prev_30['Volume'].mean(), 2) if prev_30['Volume'].mean() != 0 else 0,
            "volatility_rank": round(today['Return'] / prev_30['Return'].std(), 2) if prev_30['Return'].std() != 0 else 0
        }

        # 2. News Headlines (Top 8)
        try:
            ticker = yf.Ticker(self.ticker)
            news = ticker.news[:8] # Get raw top 8
            headlines = [n['title'] for n in news]
        except Exception as e:
            print(f"News fetch error: {e}")
            headlines = ["No news available"]

        return stats, headlines
