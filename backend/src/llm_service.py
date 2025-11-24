import google.generativeai as genai
import os
import textwrap

class LLMService:
    def __init__(self):
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            print("Warning: GOOGLE_API_KEY not found in environment variables.")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-pro')

    def generate_backtest_condition(self, query: str) -> str:
        """
        Generates a Python function string from a natural language query.
        """
        # Load available data context
        data_context = ""
        try:
            context_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'available_data.txt')
            with open(context_path, 'r') as f:
                data_context = f.read()
        except Exception:
            data_context = "Standard OHLCV data + PE ratio available."

        prompt = textwrap.dedent(f"""
            You are an expert Python developer for a financial backtesting application.
            Your task is to convert a user's natural language query into a Python function named `condition`.
            
            The `condition` function takes a pandas DataFrame `data` as input and returns a boolean Series (mask) indicating which dates match the condition.
            
            ### Data Context & Available Columns
            The `data` DataFrame contains more than just S&P 500 data. It has been merged with other indicators.
            REFER TO THIS CATALOG for column names (Symbols are column names):
            
            {data_context}
            
            *NOTE*: 
            - Primary price columns: `Open`, `High`, `Low`, `Close`, `Adj Close`, `Volume` (for S&P 500).
            - Auxiliary columns are named by their simplified symbol (e.g. `data['RSP']`, `data['BTC']`, `data['TNX']`, `data['VIX']`).
            - **IMPORTANT**: Do NOT use Yahoo tickers like 'BTC-USD' or '^VIX' as column names. Use the simplified names 'BTC', 'VIX', 'TNX' as shown in the catalog.
            - `Return`: Daily percentage change of S&P 500.
            - `PE`: Price to Earnings ratio.
            
            ### Rules
            1. The function MUST be named `condition`.
            2. It MUST accept one argument: `data`.
            3. It MUST return a pandas Series of booleans with the same index as `data`.
            4. Do NOT include any imports inside the function (assume pandas as pd, numpy as np are available if needed, but prefer using `data` methods).
            5. Do NOT include markdown formatting (like ```python). Just the code.
            6. Be robust against missing data (check if column exists before using).
            7. **CRITICAL FOR MONTHLY/WEEKLY LOGIC**: If you need to check a condition on a monthly basis (e.g. "previous month was down") and map it to daily data:
               - Do NOT manually use `.resample('M')` then `.map()` with timestamps (this fails due to time mismatches).
               - Instead, assume a helper function `expand_monthly_mask(monthly_mask, daily_index)` is available in the global scope (injected during execution).
               - Example usage:
                 ```python
                 # 1. Calculate monthly metric
                 monthly_returns = data['Adj Close'].resample('M').last().pct_change()
                 # 2. Create monthly boolean mask
                 trigger_months = monthly_returns < -0.05
                 # 3. Use helper to map back to daily
                 return expand_monthly_mask(trigger_months, data.index)
                 ```

            ### Examples
            
            Query: "When the market drops 5% in a week"
            Code:
            def condition(data):
                # 5 trading days ~ 1 week
                weekly_return = data['Adj Close'].pct_change(5)
                return weekly_return < -0.05
                
            Query: "When P/E is above 25 and VIX is below 15"
            Code:
            def condition(data):
                if 'PE' not in data.columns or 'VIX' not in data.columns:
                    return pd.Series(False, index=data.index)
                return (data['PE'] > 25) & (data['VIX'] < 15)

            Query: "When the previous month was down 5%"
            Code:
            def condition(data):
                monthly = data['Adj Close'].resample('M').last().pct_change()
                # Shift by 1 to check "previous" month relative to current days
                prev_month_down = (monthly < -0.05).shift(1)
                return expand_monthly_mask(prev_month_down, data.index)


            ### User Query
            "{query}"
            
            ### Generated Code
        """)
        
        try:
            response = self.model.generate_content(prompt)
            code = response.text.strip()
            # Clean up any potential markdown formatting if the model ignores the rule
            if code.startswith("```python"):
                code = code[9:]
            if code.startswith("```"):
                code = code[3:]
            if code.endswith("```"):
                code = code[:-3]
            return code.strip()
        except Exception as e:
            print(f"Error generating code from LLM: {e}")
            return ""

    def generate_daily_insights(self, market_stats, headlines):
        """
        Analyzes the day and returns a JSON with a score and questions.
        """
        import json
        
        # Load available data context for the questions generation
        data_context = ""
        try:
            context_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'available_data.txt')
            with open(context_path, 'r') as f:
                data_context = f.read()
        except Exception:
            data_context = "Standard OHLCV data + PE ratio available."

        prompt = f"""
        You are a Senior Quantitative Analyst. Your goal is to identify non-obvious but statistically sound market patterns to test.
        
        ### Market Data
        - Date: {market_stats['date']}
        - Return: {market_stats['return_pct']}%
        - Relative Volume: {market_stats['volume_rel']}x normal
        - Volatility Rank: {market_stats['volatility_rank']} (Z-Score)
        
        ### Top Headlines
        {json.dumps(headlines, indent=2)}
        
        ### Available Data for Backtesting
        You can ask questions that reference any of the following data points:
        {data_context}
        
        ### Task
        1. Select the top 3 most relevant headlines.
        2. Rate the "Intrigue Level" (0-100) of today.
        3. Generate 3 backtesting questions.
           - **ANTI-OVERFITTING RULE**: Avoid hyper-specific conditions (e.g. "exact price is $400.01"). 
           - **MONTHLY/WEEKLY CONTEXT**: Prefer questions that look at broader context (e.g. "When the market ends a month down >5% with high volatility").
           - **DATA COMPATIBILITY**: Ensure your questions can actually be answered using the "Available Data" listed above. (e.g. Ask about Bitcoin or Yields or VIX if relevant to the news).
           - **PREDICTIVE SCORE**: For each question, assign a score (0-100) on how likely this pattern represents a real, tradeable edge vs random noise.
             * High Score (80+): Structurally sound logic (e.g. mean reversion after extreme extensions).
             * Low Score (<50): Likely noise or overfitting.

        ### Output Format (JSON ONLY)
        {{
            "intrigue_score": 75,
            "summary": "...",
            "top_news": ["..."],
            "questions": [
                {{
                    "question": "Forward returns when monthly volatility > 2.0 and monthly return < -5%?",
                    "predictive_score": 85
                }},
                {{
                    "question": "What happens after a reversal day on >2x volume?",
                    "predictive_score": 78
                }}
            ]
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            # Clean up markdown
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())
        except Exception as e:
            print(f"LLM Insight Error: {e}")
            return {"intrigue_score": 0, "error": str(e)}
