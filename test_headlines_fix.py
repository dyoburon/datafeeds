import yfinance as yf
import json

def test_fetch_headlines_fixed():
    ticker_symbol = "^GSPC"
    print(f"Testing yfinance news fetch for: {ticker_symbol}")
    
    try:
        ticker = yf.Ticker(ticker_symbol)
        news = ticker.news
        
        headlines = []
        for n in news:
            # Try to find title in different places
            if 'title' in n:
                headlines.append(n['title'])
            elif 'content' in n and 'title' in n['content']:
                headlines.append(n['content']['title'])
            else:
                headlines.append("Unknown Title")
                
        print(f"Found {len(headlines)} headlines:")
        for h in headlines[:5]:
            print(f"- {h}")

    except Exception as e:
        print(f"ERROR: Failed to fetch news. Reason: {e}")

if __name__ == "__main__":
    test_fetch_headlines_fixed()

