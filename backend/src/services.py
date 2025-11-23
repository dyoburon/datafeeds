import pandas as pd
from .data_loader import DataLoader
from .backtester import Backtester
from .llm_service import LLMService
import pandas as pd

# Global instances (simple in-memory cache)
loader = None
price_data = None
pe_data = None
pe_data = None
bt = None
llm_service = None

def get_backtester():
    global loader, price_data, pe_data, bt, llm_service
    if bt is None:
        loader = DataLoader()
        # Fetching max history available from yfinance
        price_data = loader.fetch_sp500_data(start_date="1927-01-01")
        # Load P/E data
        pe_data = loader.load_pe_data("backend/data/pe_data.csv")
        # Merge
        df = loader.merge_data(price_data, pe_data)
        bt = Backtester(df)
        
    if llm_service is None:
        llm_service = LLMService()
        
    return bt, llm_service

def run_november_scenario():
    bt, _ = get_backtester()
    
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

    periods = ['1M', '3M', '6M', '1Y']
    mask = bt.filter_dates(condition_november_negative)
    results = bt.analyze(mask, periods=periods)
    control_results = bt.get_baseline_stats(periods=periods)
    
    return {
        "results": results,
        "control": control_results
    }

def run_friday_scenario():
    bt, _ = get_backtester()
    
    def condition_friday_negative(data):
        return (data.index.dayofweek == 4) & (data['Return'] < 0)

    periods = ['1W']
    mask = bt.filter_dates(condition_friday_negative)
    results = bt.analyze(mask, periods=periods)
    control_results = bt.get_baseline_stats(periods=periods)
    
    return {
        "results": results,
        "control": control_results
    }

def run_pe_scenario():
    bt, _ = get_backtester()
    
    def condition_high_pe(data):
        if 'PE' not in data.columns:
            return pd.Series(False, index=data.index)
        return data['PE'] > 23

    periods = ['1Y', '3Y', '5Y', '10Y']
    mask = bt.filter_dates(condition_high_pe)
    results = bt.analyze(mask, periods=periods)
    control_results = bt.get_baseline_stats(periods=periods)
    
    return {
        "results": results,
        "control": control_results
    }

def run_dynamic_scenario(query):
    bt, llm = get_backtester()
    
    # Generate code from LLM
    code = llm.generate_backtest_condition(query)
    if not code:
        return {"error": "Failed to generate condition from query"}
        
    print(f"Generated code for query '{query}':\n{code}")
    
    # Safe execution dictionary
    local_scope = {'pd': pd}
    
    try:
        # Execute the generated code to define the 'condition' function
        exec(code, local_scope)
        
        if 'condition' not in local_scope:
            return {"error": "Generated code did not define 'condition' function"}
            
        condition_func = local_scope['condition']
        
        # Apply filter
        mask = bt.filter_dates(condition_func)
        
        # Analyze specific results
        # We'll use a broad set of periods since we don't know what the user wants
        periods = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y']
        results = bt.analyze(mask, periods=periods)
        
        # Get baseline (control) stats
        control_results = bt.get_baseline_stats(periods=periods)
        
        return {
            "results": results,
            "control": control_results,
            "generated_code": code
        }
        
    except Exception as e:
        print(f"Error executing dynamic scenario: {e}")
        return {"error": f"Error executing generated condition: {str(e)}"}
