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
        prompt = textwrap.dedent(f"""
            You are an expert Python developer for a financial backtesting application.
            Your task is to convert a user's natural language query into a Python function named `condition`.
            
            The `condition` function takes a pandas DataFrame `data` as input and returns a boolean Series (mask) indicating which dates match the condition.
            
            ### Data Structure
            The `data` DataFrame has the following columns:
            - Index: DatetimeIndex
            - `Open`, `High`, `Low`, `Close`, `Adj Close`, `Volume` (Standard OHLCV)
            - `Return`: Daily percentage change (float)
            - `PE`: Price to Earnings ratio (float, forward filled)
            
            ### Rules
            1. The function MUST be named `condition`.
            2. It MUST accept one argument: `data`.
            3. It MUST return a pandas Series of booleans with the same index as `data`.
            4. Do NOT include any imports inside the function (assume pandas as pd, numpy as np are available if needed, but prefer using `data` methods).
            5. Do NOT include markdown formatting (like ```python). Just the code.
            6. Be robust against missing data if possible.
            
            ### Examples
            
            Query: "When the market drops 5% in a week"
            Code:
            def condition(data):
                # 5 trading days ~ 1 week
                weekly_return = data['Adj Close'].pct_change(5)
                return weekly_return < -0.05
                
            Query: "When P/E is above 25"
            Code:
            def condition(data):
                if 'PE' not in data.columns:
                    return pd.Series(False, index=data.index)
                return data['PE'] > 25

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
        
        prompt = f"""
        You are a Senior Market Analyst. Analyze today's market data and news.
        
        ### Market Data
        - Date: {market_stats['date']}
        - Return: {market_stats['return_pct']}%
        - Relative Volume: {market_stats['volume_rel']}x normal
        - Volatility Rank: {market_stats['volatility_rank']} (Z-Score)
        
        ### Top Headlines
        {json.dumps(headlines, indent=2)}
        
        ### Task
        1. Select the top 3 most relevant headlines that explain today's move.
        2. Rate the "Intrigue Level" (0-100) of today. Is this a common day (low score) or an outlier/turning point (high score)?
        3. Generate 3 backtesting questions to see if this pattern has happened before.
        
        ### Output Format (JSON ONLY)
        {{
            "intrigue_score": 75,
            "summary": "Market rallied on low volume despite hawkish Fed news.",
            "top_news": ["Headline 1", "Headline 2"],
            "questions": [
                "How does the market perform 1 week after a >1% gain on low volume?",
                "What happens when the market diverges from a major negative news headline?",
                "Win rate of 'Turnaround Tuesdays' after a red Monday?"
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
