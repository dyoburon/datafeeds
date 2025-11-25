import google.generativeai as genai
import os
import textwrap
import json

class LLMService:
    def __init__(self):
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            print("Warning: GOOGLE_API_KEY not found in environment variables.")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-pro')

    def generate_backtest_condition(self, query: str) -> dict:
        """
        Generates a Python function string and extracted periods from a natural language query.
        Returns a dict: {'code': str, 'periods': list[str] or None}
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
            Your task is to:
            1. Convert a user's natural language query into a Python function named `condition`.
            2. Extract specific forward return periods if requested (e.g. "3-month returns" -> ["3M"]).

            ### Output Format (JSON ONLY)
            {{
                "code": "def condition(data): ...",
                "periods": ["3M", "1Y"]  // or null if user didn't specify
            }}

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
            8. **CRITICAL FOR CALENDAR/WEEK LOGIC (e.g. Thanksgiving Week)**:
               - Do NOT use `zip(year, week)` with `.isin()`. This is fragile.
               - Instead, create a unique integer ID for weeks: `year * 100 + week`.
               - Example:
                 ```python
                 # 1. Get ISO info
                 iso = data.index.isocalendar()
                 # 2. Create ID
                 data['week_id'] = iso.year * 100 + iso.week
                 # 3. Filter
                 target_weeks = data.loc[is_thanksgiving_day, 'week_id'].unique()
                 is_thanksgiving_week = data['week_id'].isin(target_weeks)
                 ```
            9. **CRITICAL FOR "FOR THE YEAR" STATS**: When checking if a value is "High for the Year" or "Top Quartile for the Year":
               - Do NOT use `groupby(data.index.year)`. This causes Look-Ahead Bias (using future December data to judge November).
               - Use `rolling(252)` (approx 1 trading year) instead.
               - Example: `threshold = data['VIX'].rolling(252).quantile(0.75)` followed by `data['VIX'] > threshold`.

            ### Examples
            
            Query: "When the market drops 5% in a week"
            Output:
            {{
                "code": "def condition(data):\\n    # 5 trading days ~ 1 week\\n    weekly_return = data['Adj Close'].pct_change(5)\\n    return weekly_return < -0.05",
                "periods": null
            }}
            
            Query: "Forward 3-month returns when P/E is above 25"
            Output:
            {{
                "code": "def condition(data):\\n    if 'PE' not in data.columns:\\n        return pd.Series(False, index=data.index)\\n    return data['PE'] > 25",
                "periods": ["3M"]
            }}

            Query: "When the previous month was down 5%"
            Output:
            {{
                "code": "def condition(data):\\n    monthly = data['Adj Close'].resample('M').last().pct_change()\\n    # Shift by 1 to check 'previous' month relative to current days\\n    prev_month_down = (monthly < -0.05).shift(1)\\n    return expand_monthly_mask(prev_month_down, data.index)",
                "periods": null
            }}

            ### User Query
            "{query}"
            
            ### Generated JSON
        """)
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            # Clean up any potential markdown formatting if the model ignores the rule
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
                
            # Parse JSON
            import json
            result = json.loads(text.strip())
            return result
            
        except Exception as e:
            print(f"Error generating code from LLM: {e}")
            return {"code": "", "periods": None}

    def generate_daily_insights(self, market_stats, headlines):
        """
        Analyzes the day and returns a JSON with a score and questions.
        """
        
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
           - **FUNDAMENTAL FOCUS**: Avoid pure technical analysis like "200-day Moving Average" or "Golden Cross". Focus on Macro, Fundamentals, and Inter-market relationships.
           - **RELATIONSHIPS**: Ask about Yield Curve (10Y-2Y), Bond Yields (TNX), Credit Spreads (HYG), Volatility (VIX), and their relationship to the S&P 500.
           - **MONTHLY/WEEKLY CONTEXT**: Prefer questions that look at broader context (e.g. "When the market ends a month down >5% with high volatility").
           - **DATA COMPATIBILITY**: Ensure your questions can actually be answered using the "Available Data" listed above. (e.g. Ask about Bitcoin or Yields or VIX if relevant to the news).
           - **PREDICTIVE SCORE**: For each question, assign a score (0-100) on how likely this pattern represents a real, tradeable edge vs random noise.
             * High Score (80+): Structurally sound logic (e.g. mean reversion after extreme extensions).
             * Low Score (<50): Likely noise or overfitting.
           - **INSIGHT EXPLANATION**: Provide a 1-sentence explanation of WHY this question is interesting (the hypothesis).

        ### Output Format (JSON ONLY)
        {{
            "intrigue_score": 75,
            "summary": "...",
            "top_news": ["..."],
            "questions": [
                {{
                    "question": "Forward returns when monthly volatility > 2.0 and monthly return < -5%?",
                    "insight_explanation": "High volatility combined with a sharp drop often signals panic selling, potentially creating a mean-reversion opportunity.",
                    "predictive_score": 85
                }},
                {{
                    "question": "What happens after a reversal day on >2x volume?",
                    "insight_explanation": "High volume reversals often indicate a climax in sentiment and can mark a short-term bottom.",
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
            
    def generate_replacement_question(self, market_stats, bad_question, reason):
        """
        Generates a single replacement question because the previous one failed validation.
        """
        # Load available data context
        data_context = ""
        try:
            context_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'available_data.txt')
            with open(context_path, 'r') as f:
                data_context = f.read()
        except Exception:
            data_context = "Standard OHLCV data + PE ratio available."

        prompt = f"""
        You are a Senior Quantitative Analyst. 
        The previous backtesting question you generated was invalid.
        
        ### Invalid Question
        "{bad_question}"
        
        ### Reason for Failure
        {reason}
        
        ### Task
        Generate ONE replacement backtesting question that is:
        1. Valid (actually has occurrences in history).
        2. Relevant to today's market context.
        3. Uses available data.
        4. Includes a predictive score and insight explanation.
        
        ### Market Data
        - Date: {market_stats['date']}
        - Return: {market_stats['return_pct']}%
        
        ### Available Data
        {data_context}

        ### Output Format (JSON ONLY)
        {{
            "question": "New valid question...",
            "insight_explanation": "Why this question matters...",
            "predictive_score": 80
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())
        except Exception as e:
            print(f"LLM Replacement Error: {e}")
            return None

    def generate_result_interpretation(self, question, results_data):
        """
        Generates a brief interpretation of the backtest results.
        """
        prompt = f"""
        You are a Senior Quantitative Analyst. Interpret these backtest results for a user.
        
        ### Question
        "{question}"
        
        ### Backtest Results
        Occurrences: {results_data.get('count', 0)}
        
        Stats (Signal vs Baseline):
        {json.dumps(results_data.get('results', {}), indent=2)}
        
        Control/Baseline Stats:
        {json.dumps(results_data.get('control', {}), indent=2)}
        
        ### Task
        Write a 2-3 sentence interpretation. 
        - Did the signal outperform the baseline? 
        - Is the win rate significantly better?
        - Is there a specific time horizon (e.g. 1M vs 1Y) where it works best?
        - Be objective. If the results are mixed or negative, say so.
        
        ### Output Format (JSON ONLY)
        {{
            "result_explanation": "The signal shows a strong short-term edge, outperforming the baseline by 2% over the next month with a 65% win rate. However, this advantage fades over longer timeframes."
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text.strip())
        except Exception as e:
            print(f"LLM Result Interpretation Error: {e}")
            return {"result_explanation": "Unable to interpret results."}
