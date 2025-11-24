import pandas as pd
from .data_loader import DataLoader
from .backtester import Backtester
from .llm_service import LLMService
import json
import os
import uuid
import numpy as np

# Global instances (simple in-memory cache)
loader = None
price_data = None
pe_data = None
bt = None
llm_service = None

SAVED_QUERIES_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'saved_queries.json')

def get_backtester():
    global loader, price_data, pe_data, bt, llm_service
    if bt is None:
        loader = DataLoader()
        # Fetching max history available from yfinance
        price_data = loader.fetch_sp500_data(start_date="1927-01-01")
        # Load P/E data
        pe_data = loader.load_pe_data("data/flat-ui__data-Sat Nov 22 2025.json")
        # Merge
        df = loader.merge_data(price_data, pe_data)
        bt = Backtester(df)
        
    if llm_service is None:
        llm_service = LLMService()
        
    return bt, llm_service

def format_signals(signals_df, max_samples=3000):
    """
    Formats the signals dataframe into a list of dictionaries for the frontend.
    Handles nan values to ensure valid JSON.
    Limits the number of points to max_samples to prevent frontend lag.
    """
    # Cap the number of points to prevent frontend lag
    if len(signals_df) > max_samples:
        # Random sample then sort by index to keep chronological order
        signals_df = signals_df.sample(n=max_samples, random_state=42).sort_index()

    records = []
    for index, row in signals_df.iterrows():
        record = {
            'date': index.strftime('%Y-%m-%d'),
            'price': row['Adj Close']
        }
        for col in row.index:
            if col.startswith('FwdReturn_'):
                period = col.replace('FwdReturn_', '')
                val = row[col]
                # Handle NaN/Infinity for JSON serialization
                if pd.isna(val) or np.isinf(val):
                    record[period] = None
                else:
                    record[period] = val
        records.append(record)
    return records

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
    
    # Get raw signals for charting
    signals_df = bt.get_signals(mask, periods=periods)
    signals_data = format_signals(signals_df)
    
    return {
        "results": results,
        "control": control_results,
        "signals": signals_data
    }

def run_friday_scenario():
    bt, _ = get_backtester()
    
    def condition_friday_negative(data):
        return (data.index.dayofweek == 4) & (data['Return'] < 0)

    periods = ['1W']
    mask = bt.filter_dates(condition_friday_negative)
    results = bt.analyze(mask, periods=periods)
    control_results = bt.get_baseline_stats(periods=periods)
    
    signals_df = bt.get_signals(mask, periods=periods)
    signals_data = format_signals(signals_df)
    
    return {
        "results": results,
        "control": control_results,
        "signals": signals_data
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
    
    signals_df = bt.get_signals(mask, periods=periods)
    signals_data = format_signals(signals_df)
    
    return {
        "results": results,
        "control": control_results,
        "signals": signals_data
    }

def run_pe_range_scenario(min_pe, max_pe):
    """Generic function to run P/E range scenarios"""
    bt, _ = get_backtester()
    
    def condition_pe_range(data):
        if 'PE' not in data.columns:
            return pd.Series(False, index=data.index)
        return (data['PE'] >= min_pe) & (data['PE'] < max_pe)

    periods = ['1Y', '3Y', '5Y', '10Y']
    mask = bt.filter_dates(condition_pe_range)
    results = bt.analyze(mask, periods=periods)
    control_results = bt.get_baseline_stats(periods=periods)
    
    signals_df = bt.get_signals(mask, periods=periods)
    signals_data = format_signals(signals_df)
    
    return {
        "results": results,
        "control": control_results,
        "signals": signals_data
    }

def run_pe_16_17():
    return run_pe_range_scenario(16, 17)

def run_pe_17_18():
    return run_pe_range_scenario(17, 18)

def run_pe_18_19():
    return run_pe_range_scenario(18, 19)

def run_pe_19_20():
    return run_pe_range_scenario(19, 20)

def run_pe_20_21():
    return run_pe_range_scenario(20, 21)

def run_pe_21_22():
    return run_pe_range_scenario(21, 22)

def run_pe_22_23():
    return run_pe_range_scenario(22, 23)


def _execute_code(code, bt):
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
        periods = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y']
        results = bt.analyze(mask, periods=periods)
        
        # Get baseline (control) stats
        control_results = bt.get_baseline_stats(periods=periods)
        
        # Get raw signals
        signals_df = bt.get_signals(mask, periods=periods)
        signals_data = format_signals(signals_df)
        
        return {
            "results": results,
            "control": control_results,
            "signals": signals_data,
            "generated_code": code
        }
        
    except Exception as e:
        print(f"Error executing dynamic scenario: {e}")
        return {"error": f"Error executing generated condition: {str(e)}"}

def run_dynamic_scenario(query):
    bt, llm = get_backtester()
    
    # Generate code from LLM
    code = llm.generate_backtest_condition(query)
    if not code:
        return {"error": "Failed to generate condition from query"}
        
    print(f"Generated code for query '{query}':\n{code}")
    
    return _execute_code(code, bt)

def save_custom_query(name, description, code, original_query):
    try:
        queries = []
        if os.path.exists(SAVED_QUERIES_FILE):
            with open(SAVED_QUERIES_FILE, 'r') as f:
                try:
                    queries = json.load(f)
                except json.JSONDecodeError:
                    queries = []
        
        new_query = {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": description,
            "code": code,
            "original_query": original_query
        }
        
        queries.append(new_query)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(SAVED_QUERIES_FILE), exist_ok=True)
        
        with open(SAVED_QUERIES_FILE, 'w') as f:
            json.dump(queries, f, indent=2)
            
        return new_query
    except Exception as e:
        return {"error": f"Failed to save query: {str(e)}"}

def get_saved_queries():
    try:
        if os.path.exists(SAVED_QUERIES_FILE):
            with open(SAVED_QUERIES_FILE, 'r') as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    return []
        return []
    except Exception as e:
        print(f"Error reading saved queries: {e}")
        return []

def run_saved_query(query_id):
    bt, _ = get_backtester()
    queries = get_saved_queries()
    query = next((q for q in queries if q['id'] == query_id), None)
    
    if not query:
        return {"error": "Query not found"}
        
    return _execute_code(query['code'], bt)

def run_daily_insight_generation():
    bt, llm = get_backtester()
    
    # Need loader to get context, but loader is global.
    # Ensure loader is initialized
    if loader is None:
        # get_backtester initializes it
        get_backtester()
        
    # Get Data
    stats, headlines = loader.get_market_context(bt.data)
    
    # Get Analysis
    analysis = llm.generate_daily_insights(stats, headlines)
    
    return analysis
