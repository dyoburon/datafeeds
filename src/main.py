import pandas as pd
from data_loader import DataLoader
from backtester import Backtester

def main():
    # 1. Load Data
    loader = DataLoader()
    # Fetching max history available from yfinance
    price_data = loader.fetch_sp500_data(start_date="1927-01-01")
    
    # Load P/E data (User needs to provide real data for accurate results)
    pe_data = loader.load_pe_data("data/pe_data.csv")
    
    # Merge
    df = loader.merge_data(price_data, pe_data)
    
    print(f"Data loaded: {len(df)} rows from {df.index.min()} to {df.index.max()}")
    
    # 2. Initialize Backtester
    bt = Backtester(df)
    
    print("\n" + "="*50)
    print("SCENARIO 1: In years where returns in November are negative...")
    print("="*50)
    
    def condition_november_negative(data):
        # Resample to monthly to easily get November returns
        # We need to be careful to map back to the daily index for the backtester
        
        # Strategy: Identify the last day of November for years where Nov return was negative
        mask = pd.Series(False, index=data.index)
        
        # Group by Year and Month
        # We want the return from Oct last close to Nov last close
        # Or simply: percent change of the monthly close for November
        
        monthly_data = data['Adj Close'].resample('ME').last()
        monthly_returns = monthly_data.pct_change()
        
        # Filter for Novembers (Month 11) that are negative
        neg_novs = monthly_returns[(monthly_returns.index.month == 11) & (monthly_returns < 0)]
        
        # Now find the corresponding dates in the daily dataframe (the last trading day of that November)
        # Since we used resample('M'), the index of neg_novs are the last days of the months
        
        # We need to find the nearest date in our daily data for these timestamps
        # Usually resample('M') gives the last calendar day, which might not be a trading day?
        # Actually resample('M') defaults to month end frequency.
        
        # Let's just iterate and find the exact index
        for date in neg_novs.index:
            # Find the closest date in data.index <= date
            loc = data.index.get_indexer([date], method='pad')[0]
            if loc != -1:
                mask.iloc[loc] = True
                
        return mask

    nov_mask = bt.filter_dates(condition_november_negative)
    nov_results = bt.analyze(nov_mask, periods=['1M', '3M', '6M', '1Y'])
    
    print(f"Found {nov_results.get('count', 0)} occurrences.")
    for p in ['1M', '3M', '6M', '1Y']:
        if nov_results[p] and nov_results[p] != "Data not available":
            print(f"  {p} Later: Mean Return: {nov_results[p]['mean']:.2%}, Win Rate: {nov_results[p]['win_rate']:.2%}")

    print("\n" + "="*50)
    print("SCENARIO 2: In weeks where Fridays are negative...")
    print("="*50)
    
    def condition_friday_negative(data):
        # Friday is dayofweek 4
        # Check if it's a Friday AND daily return is negative
        return (data.index.dayofweek == 4) & (data['Return'] < 0)

    fri_mask = bt.filter_dates(condition_friday_negative)
    # "Returns the following week" -> 1 Week later
    fri_results = bt.analyze(fri_mask, periods=['1W'])
    
    print(f"Found {fri_results.get('count', 0)} occurrences.")
    if fri_results['1W'] and fri_results['1W'] != "Data not available":
        print(f"  Next Week Return: Mean: {fri_results['1W']['mean']:.2%}, Win Rate: {fri_results['1W']['win_rate']:.2%}")

    print("\n" + "="*50)
    print("SCENARIO 3: When S&P is above 23 P/E...")
    print("="*50)
    
    def condition_high_pe(data):
        if 'PE' not in data.columns:
            return pd.Series(False, index=data.index)
        return data['PE'] > 23

    pe_mask = bt.filter_dates(condition_high_pe)
    pe_results = bt.analyze(pe_mask, periods=['1Y', '3Y', '5Y', '10Y'])
    
    print(f"Found {pe_results.get('count', 0)} trading days with P/E > 23.")
    for p in ['1Y', '3Y', '5Y', '10Y']:
        if p in pe_results and pe_results[p] and pe_results[p] != "Data not available":
            msg = f"  {p} Later: Mean Return: {pe_results[p]['mean']:.2%}, Median: {pe_results[p]['median']:.2%}"
            if pe_results[p].get('cagr') is not None:
                msg += f", CAGR: {pe_results[p]['cagr']:.2%}"
            print(msg)
        else:
            val = pe_results.get(p, "No data")
            print(f"  {p} Later: {val}")

    print("\n" + "="*50)
    print("VERIFICATION: November Negative Returns")
    print("="*50)
    print("Listing first 5 occurrences to allow manual double-checking:")
    nov_signals = bt.get_signals(nov_mask, periods=['1M', '1Y'])
    if len(nov_signals) > 0:
        print(nov_signals.head().to_string())
    else:
        print("No signals found to verify.")

    print("\n" + "="*50)
    print("SUGGESTED BACKTESTING QUESTIONS")
    print("="*50)
    questions = [
        "1. What are the returns after the S&P 500 drops 20% from its all-time high (Bear Market entry)?",
        "2. How does the market perform 1 year after a 'Golden Cross' (50-day MA crosses above 200-day MA)?",
        "3. What are the returns when the RSI (14-day) is below 30 (Oversold)?",
        "4. 'Sell in May and Go Away': What are the returns from May-October vs November-April?",
        "5. What happens when the VIX spikes above 40?",
        "6. How do returns compare when the yield curve (10Y-2Y) is inverted vs normal?",
        "7. What is the performance 1 month after 3 consecutive down days?",
        "8. Returns when the market is at an all-time high vs in a drawdown?",
        "9. Performance during US Presidential Election years vs non-election years?",
        "10. What are the forward returns when the Shiller PE is below 15 (Undervalued)?"
    ]
    for q in questions:
        print(q)

if __name__ == "__main__":
    main()
