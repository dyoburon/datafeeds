import pandas as pd
import numpy as np

def test_script_logic():
    # Create dummy daily data
    dates = pd.date_range(start='2022-01-01', end='2022-12-31', freq='B')
    data = pd.DataFrame(index=dates)
    data['Adj Close'] = 100.0 + np.random.randn(len(dates)).cumsum()
    data['BTC'] = 20000.0 + np.random.randn(len(dates)).cumsum() * 100
    
    # Simulate the failing script logic
    print("Running logic...")
    
    if 'Adj Close' not in data.columns or 'BTC' not in data.columns:
        print("Missing columns")
        return

    # Logic from user
    sp_monthly_returns = data['Adj Close'].resample('M').last().pct_change()
    btc_monthly_returns = data['BTC'].resample('M').last().pct_change()
    
    # Force a trigger
    # Let's make Feb 2022 a trigger month
    # Set Jan 31 prices
    # Set Feb 28 prices such that SPX > 0 and BTC < -0.15
    
    trigger_months = (sp_monthly_returns > 0) & (btc_monthly_returns < -0.15)
    signal_months = trigger_months.shift(1).fillna(False)

    daily_to_month_map = data.index.to_period('M').to_timestamp(how='end')
    
    print(f"Signal Months Index Type: {type(signal_months.index)}")
    print(f"Signal Months Index sample: {signal_months.index[0]}")
    print(f"Map Source Type: {type(daily_to_month_map)}")
    print(f"Map Source sample: {daily_to_month_map[0]}")

    daily_mask = daily_to_month_map.map(signal_months).fillna(False)
    
    print(f"Daily Mask Type: {type(daily_mask)}")
    print(f"Daily Mask Sum: {daily_mask.sum()}")
    
    # Alternative robust logic (Period based)
    print("\nRobust Period Logic:")
    monthly_periods = signal_months.index.to_period('M')
    signal_months_period = signal_months.copy()
    signal_months_period.index = monthly_periods
    
    daily_periods = data.index.to_period('M')
    robust_mask = daily_periods.map(signal_months_period).fillna(False)
    
    print(f"Robust Mask Sum: {robust_mask.sum()}")

if __name__ == "__main__":
    test_script_logic()

