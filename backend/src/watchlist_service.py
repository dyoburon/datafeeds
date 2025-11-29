"""
Watchlist Service

Fetches news and performance data for stocks in a user's watchlist using yFinance.
Provides summarized data for inclusion in daily market analysis emails.
"""

import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import concurrent.futures


def get_ticker_data(ticker: str) -> Dict:
    """
    Fetch news and daily performance for a single ticker.
    
    Returns:
        Dict with ticker info, performance, and news
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Get basic info
        info = stock.info or {}
        
        # Get today's performance
        hist = stock.history(period="2d")
        
        performance = {
            "current_price": None,
            "previous_close": None,
            "change": None,
            "change_percent": None,
            "volume": None,
            "avg_volume": None,
        }
        
        if len(hist) >= 1:
            latest = hist.iloc[-1]
            performance["current_price"] = round(latest['Close'], 2)
            performance["volume"] = int(latest['Volume']) if latest['Volume'] else None
            
            if len(hist) >= 2:
                prev = hist.iloc[-2]
                performance["previous_close"] = round(prev['Close'], 2)
                performance["change"] = round(latest['Close'] - prev['Close'], 2)
                performance["change_percent"] = round(
                    ((latest['Close'] - prev['Close']) / prev['Close']) * 100, 2
                )
        
        # Get average volume from info
        performance["avg_volume"] = info.get("averageVolume")
        
        # Get news
        news = stock.news or []
        
        # Process news - extract relevant fields
        processed_news = []
        for article in news[:10]:  # Limit to 10 most recent
            processed_news.append({
                "title": article.get("title", ""),
                "publisher": article.get("publisher", ""),
                "link": article.get("link", ""),
                "published": article.get("providerPublishTime", 0),
                "type": article.get("type", ""),
            })
        
        return {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName") or ticker,
            "sector": info.get("sector", "Unknown"),
            "performance": performance,
            "news": processed_news,
            "news_count": len(processed_news),
            "error": None
        }
        
    except Exception as e:
        return {
            "ticker": ticker,
            "name": ticker,
            "sector": "Unknown",
            "performance": {},
            "news": [],
            "news_count": 0,
            "error": str(e)
        }


def get_watchlist_data(tickers: List[str], max_tickers: int = 5) -> List[Dict]:
    """
    Fetch data for multiple tickers in parallel.
    Returns top N tickers sorted by news count.
    
    Args:
        tickers: List of ticker symbols
        max_tickers: Maximum number of tickers to return (default 5)
    
    Returns:
        List of ticker data dicts, sorted by news count (most news first)
    """
    if not tickers:
        return []
    
    results = []
    
    # Fetch data in parallel for speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_ticker = {
            executor.submit(get_ticker_data, ticker): ticker 
            for ticker in tickers
        }
        
        for future in concurrent.futures.as_completed(future_to_ticker):
            try:
                data = future.result()
                results.append(data)
            except Exception as e:
                ticker = future_to_ticker[future]
                results.append({
                    "ticker": ticker,
                    "name": ticker,
                    "sector": "Unknown",
                    "performance": {},
                    "news": [],
                    "news_count": 0,
                    "error": str(e)
                })
    
    # Sort by news count (most news first), then by ticker name
    results.sort(key=lambda x: (-x["news_count"], x["ticker"]))
    
    # Return top N
    return results[:max_tickers]


def generate_ticker_summary(ticker_data: Dict) -> str:
    """
    Generate a brief text summary for a ticker.
    
    Args:
        ticker_data: Data dict from get_ticker_data
    
    Returns:
        Human-readable summary string
    """
    ticker = ticker_data["ticker"]
    name = ticker_data["name"]
    perf = ticker_data.get("performance", {})
    news = ticker_data.get("news", [])
    
    # Performance summary
    change_pct = perf.get("change_percent")
    price = perf.get("current_price")
    
    if change_pct is not None and price is not None:
        direction = "up" if change_pct > 0 else "down" if change_pct < 0 else "flat"
        perf_text = f"${price} ({'+' if change_pct > 0 else ''}{change_pct}%)"
    else:
        perf_text = "Price data unavailable"
        direction = "unknown"
    
    # News summary
    if news:
        headlines = [n["title"] for n in news[:3]]
        news_text = f"{len(news)} news item{'s' if len(news) > 1 else ''}: " + "; ".join(headlines[:2])
        if len(headlines) > 2:
            news_text += f" (+{len(headlines) - 2} more)"
    else:
        news_text = "No recent news"
    
    return f"{name} ({ticker}): {perf_text}. {news_text}"


def get_watchlist_for_email(tickers: List[str], max_tickers: int = 5) -> Dict:
    """
    Get watchlist data formatted for email inclusion.
    
    Args:
        tickers: User's watchlist tickers
        max_tickers: Max tickers to include (default 5)
    
    Returns:
        Dict with formatted watchlist data for email template
    """
    if not tickers:
        return {
            "has_data": False,
            "tickers": [],
            "message": "No stocks in watchlist"
        }
    
    data = get_watchlist_data(tickers, max_tickers)
    
    # Format for email
    formatted = []
    for item in data:
        perf = item.get("performance", {})
        news = item.get("news", [])
        
        change_pct = perf.get("change_percent")
        
        # Determine status
        if change_pct is not None:
            if change_pct > 2:
                status = "strong_up"
            elif change_pct > 0:
                status = "up"
            elif change_pct < -2:
                status = "strong_down"
            elif change_pct < 0:
                status = "down"
            else:
                status = "flat"
        else:
            status = "unknown"
        
        formatted.append({
            "ticker": item["ticker"],
            "name": item["name"],
            "sector": item["sector"],
            "price": perf.get("current_price"),
            "change": perf.get("change"),
            "change_percent": change_pct,
            "status": status,
            "volume": perf.get("volume"),
            "avg_volume": perf.get("avg_volume"),
            "headlines": [n["title"] for n in news[:3]],
            "news_count": len(news),
            "has_news": len(news) > 0,
            "summary": generate_ticker_summary(item),
            "error": item.get("error")
        })
    
    # Count how many were excluded
    excluded_count = max(0, len(tickers) - max_tickers)
    
    return {
        "has_data": len(formatted) > 0,
        "tickers": formatted,
        "total_in_watchlist": len(tickers),
        "showing": len(formatted),
        "excluded_count": excluded_count,
        "message": None if formatted else "Could not fetch watchlist data"
    }


# Quick test
if __name__ == "__main__":
    test_tickers = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "AMD"]
    result = get_watchlist_for_email(test_tickers, max_tickers=5)
    
    print(f"\nWatchlist Summary ({result['showing']}/{result['total_in_watchlist']} stocks):\n")
    
    for t in result["tickers"]:
        print(f"  {t['ticker']}: ${t['price']} ({t['change_percent']:+.2f}%)")
        print(f"    News: {t['news_count']} items")
        for h in t['headlines'][:2]:
            print(f"      - {h[:60]}...")
        print()

