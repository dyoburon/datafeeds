import pandas as pd
from .data_loader import DataLoader
from .backtester import Backtester

# Global instances (simple in-memory cache)
loader = None
price_data = None
pe_data = None
bt = None

def get_backtester():
    global loader, price_data, pe_data, bt
    if bt is None:
        loader = DataLoader()
        # Fetching max history available from yfinance
        price_data = loader.fetch_sp500_data(start_date="1927-01-01")
        # Load P/E data
        pe_data = loader.load_pe_data("backend/data/pe_data.csv")
        # Merge
        df = loader.merge_data(price_data, pe_data)
        bt = Backtester(df)
    return bt

def run_november_scenario():
    bt = get_backtester()
    
    def condition_november_negative(data):
        mask = pd.Series(False, index=data.index)
        monthly_data = data['Adj Close'].resample('ME').last()
        monthly_returns = monthly_data.pct_change()
        neg_novs = monthly_returns[(monthly_returns.index.month == 11) & (monthly_returns < 0)]
        
        for date in neg_novs.index:
            loc = data.index.get_indexer([date], method='pad')[0]
            if loc != -1:
                mask.iloc[loc] = True
        return mask

    mask = bt.filter_dates(condition_november_negative)
    results = bt.analyze(mask, periods=['1M', '3M', '6M', '1Y'])
    return results

def run_friday_scenario():
    bt = get_backtester()
    
    def condition_friday_negative(data):
        return (data.index.dayofweek == 4) & (data['Return'] < 0)

    mask = bt.filter_dates(condition_friday_negative)
    results = bt.analyze(mask, periods=['1W'])
    return results

def run_pe_scenario():
    bt = get_backtester()
    
    def condition_high_pe(data):
        if 'PE' not in data.columns:
            return pd.Series(False, index=data.index)
        return data['PE'] > 23

    mask = bt.filter_dates(condition_high_pe)
    results = bt.analyze(mask, periods=['1Y', '3Y', '5Y', '10Y'])
    return results
