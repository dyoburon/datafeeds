import yfinance as yf
import json

def test_fetch_headlines():
    ticker_symbol = "^GSPC"
    print(f"Testing yfinance news fetch for: {ticker_symbol}")
    
    try:
        ticker = yf.Ticker(ticker_symbol)
        news = ticker.news
        
        print(f"Raw news object type: {type(news)}")
        print(f"Number of news items: {len(news)}")
        
        if not news:
            print("WARNING: No news returned!")
            return

        print("\n--- First 3 Headlines ---")
        for i, item in enumerate(news[:3]):
            print(f"{i+1}. {item.get('title', 'NO TITLE')}")
            print(f"   Link: {item.get('link', 'NO LINK')}")
            print("-" * 30)
            
        print("\nFull raw structure of first item:")
        print(json.dumps(news[0], indent=2))

    except Exception as e:
        print(f"ERROR: Failed to fetch news. Reason: {e}")

if __name__ == "__main__":
    test_fetch_headlines()

