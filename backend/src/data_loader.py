import yfinance as yf
import pandas as pd
import os

class DataLoader:
    def __init__(self):
        self.ticker = "^GSPC"

    def fetch_sp500_data(self, start_date="1920-01-01"):
        """Fetches S&P 500 data AND additional reference tickers from yfinance."""
        print(f"Fetching {self.ticker} and additional data from {start_date}...")
        
        # 1. Fetch Primary (S&P 500)
        df = self._fetch_ticker(self.ticker, start_date)
        
        # 2. Fetch Additional Tickers (Equal Weight, Crypto, Yields, VIX)
        # Note: Some start much later than 1920.
        additional_tickers = {
            'RSP': 'RSP',       # S&P 500 Equal Weight (Breadth Proxy)
            'HYG': 'HYG',       # High Yield Bonds (Credit Risk)
            'BTC-USD': 'BTC',   # Bitcoin (Risk-On Sentiment)
            '^TNX': 'TNX',      # 10-Year Treasury Yield
            '^VIX': 'VIX'       # Volatility Index
        }
        
        for ticker, name in additional_tickers.items():
            try:
                aux_df = self._fetch_ticker(ticker, start_date)
                # Join on 'Adj Close' mostly
                aux_close = aux_df['Adj Close']
                aux_close.name = name  # Rename series to the simple name
                
                # Left join to the main S&P df to keep its index as master
                df = df.join(aux_close, how='left')
                
            except Exception as e:
                print(f"Warning: Failed to fetch {name} ({ticker}): {e}")

        return df

    def _fetch_ticker(self, symbol, start_date):
        """Helper to fetch and clean a single ticker."""
        df = yf.download(symbol, start=start_date, progress=False)
        
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        df.index = pd.to_datetime(df.index)
        
        # Basic cleanup
        if 'Adj Close' not in df.columns and 'Close' in df.columns:
            df['Adj Close'] = df['Close']
            
        # Calculate Return for this specific ticker
        if 'Return' not in df.columns and 'Adj Close' in df.columns:
            df['Return'] = df['Adj Close'].pct_change()
            
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
            headlines = []
            for n in news:
                if 'title' in n:
                    headlines.append(n['title'])
                elif 'content' in n and 'title' in n['content']:
                    headlines.append(n['content']['title'])
        except Exception as e:
            print(f"News fetch error: {e}")
            headlines = ["No news available"]

        return stats, headlines
