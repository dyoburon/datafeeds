import pandas as pd
import numpy as np

def test_vix_thanksgiving():
    # Create sample data for 2023
    # Thanksgiving 2023 was Nov 23 (Thursday)
    
    dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='B') # Business days
    data = pd.DataFrame(index=dates)
    data['VIX'] = 20.0 # Baseline VIX
    
    # Simulate VIX spike in Nov 2023 to force top quartile
    data.loc['2023-11-01':'2023-11-30', 'VIX'] = 40.0 
    
    print(f"Data Range: {data.index.min()} to {data.index.max()}")
    
    # --- LOGIC FROM USER SCRIPT ---
    
    # Part 1: Identify US Thanksgiving weeks.
    is_thanksgiving_day = (data.index.month == 11) & \
                          (data.index.dayofweek == 3) & \
                          (data.index.day.isin(range(22, 29)))
                          
    print(f"Thanksgiving days found: {is_thanksgiving_day.sum()}")
    if is_thanksgiving_day.sum() > 0:
        print(f"Thanksgiving Date: {data.index[is_thanksgiving_day][0]}")

    # Create a unique ID for each week (Year * 100 + WeekNumber) to be robust.
    iso = data.index.isocalendar()
    week_id = iso.year * 100 + iso.week
    
    # !! POTENTIAL ISSUE: week_id is a Series, but index alignment? 
    # It should be fine since `iso` comes from data.index
    
    thanksgiving_week_ids = week_id[is_thanksgiving_day].unique()
    print(f"Thanksgiving Week IDs: {thanksgiving_week_ids}")
    
    is_thanksgiving_week = week_id.isin(thanksgiving_week_ids)
    print(f"Thanksgiving Week Days Count: {is_thanksgiving_week.sum()}")

    # Part 2: Check VIX yearly quartile condition.
    year = data.index.year
    
    # The problematic line?
    # data.groupby(year)['VIX']...
    # `year` is just an Index attribute, not a column.
    # groupby() typically expects column names or a Series/array of same length.
    # Passing `year` (which is Int64Index) should work but let's verify.
    
    vix_q3_yearly = data.groupby(year)['VIX'].transform('quantile', 0.75)
    
    print(f"VIX Q3 Head: {vix_q3_yearly.head()}")
    print(f"VIX Q3 Unique: {vix_q3_yearly.unique()}")
    
    is_vix_top_quartile = data['VIX'] > vix_q3_yearly
    print(f"VIX Top Quartile Count: {is_vix_top_quartile.sum()}")

    # Part 3: Combine conditions.
    final_mask = is_thanksgiving_week & is_vix_top_quartile
    print(f"Final Matches: {final_mask.sum()}")
    
    if final_mask.sum() == 0:
        print("\nDIAGNOSIS: Zero matches found.")
        print("1. Thanksgiving Week Days:", is_thanksgiving_week.sum())
        print("2. High VIX Days:", is_vix_top_quartile.sum())
        
        # Check intersection manually
        tg_indices = data.index[is_thanksgiving_week]
        print("\nVIX values during Thanksgiving Week:")
        print(data.loc[tg_indices, 'VIX'])
        print("Thresholds during Thanksgiving Week:")
        print(vix_q3_yearly.loc[tg_indices])

if __name__ == "__main__":
    test_vix_thanksgiving()

