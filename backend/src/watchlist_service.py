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
            "beta": None,
            "market_cap": None,
            "pe_ratio": None,
            "dividend_yield": None,
            "fifty_two_week_high": None,
            "fifty_two_week_low": None,
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
        
        # Get additional metrics from info
        performance["avg_volume"] = info.get("averageVolume")
        performance["beta"] = info.get("beta")
        performance["market_cap"] = info.get("marketCap")
        performance["pe_ratio"] = info.get("trailingPE") or info.get("forwardPE")
        performance["dividend_yield"] = info.get("dividendYield")
        performance["fifty_two_week_high"] = info.get("fiftyTwoWeekHigh")
        performance["fifty_two_week_low"] = info.get("fiftyTwoWeekLow")
        
        # Get news - handle different yfinance versions
        news = []
        try:
            raw_news = stock.news
            if raw_news:
                news = raw_news if isinstance(raw_news, list) else []
        except Exception as news_err:
            print(f"News fetch warning for {ticker}: {news_err}")
            news = []
        
        # Process news - extract relevant fields with flexible field mapping
        processed_news = []
        for article in news[:10]:  # Limit to 10 most recent
            if not isinstance(article, dict):
                continue
            
            # Try multiple field names for title (yfinance versions vary)
            title = (
                article.get("title") or 
                article.get("headline") or 
                article.get("content", {}).get("title") if isinstance(article.get("content"), dict) else None or
                ""
            )
            
            # Try multiple field names for other fields
            publisher = (
                article.get("publisher") or 
                article.get("source") or
                article.get("provider") or
                ""
            )
            
            link = (
                article.get("link") or 
                article.get("url") or
                article.get("canonicalUrl", {}).get("url") if isinstance(article.get("canonicalUrl"), dict) else None or
                ""
            )
            
            published = (
                article.get("providerPublishTime") or 
                article.get("publishTime") or
                article.get("pubDate") or
                0
            )
            
            if title:  # Only add if we have a title
                processed_news.append({
                    "title": title,
                    "publisher": publisher,
                    "link": link,
                    "published": published,
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
            "beta": perf.get("beta"),
            "market_cap": perf.get("market_cap"),
            "pe_ratio": perf.get("pe_ratio"),
            "dividend_yield": perf.get("dividend_yield"),
            "fifty_two_week_high": perf.get("fifty_two_week_high"),
            "fifty_two_week_low": perf.get("fifty_two_week_low"),
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


def get_monthly_historical_prices(tickers: List[str], months: int = 24) -> Dict:
    """
    Fetch monthly historical closing prices for multiple tickers.
    Uses the 1st trading day of each month.
    
    Args:
        tickers: List of ticker symbols
        months: Number of months of history (default 24 = 2 years)
    
    Returns:
        Dict with monthly prices for each ticker and dates
    """
    if not tickers:
        return {"dates": [], "prices": {}}
    
    # Calculate start date
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months * 31)  # Approximate
    
    result = {
        "dates": [],
        "prices": {},
        "errors": []
    }
    
    # Fetch data for each ticker
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(start=start_date, end=end_date, interval="1mo")
            
            if len(hist) > 0:
                # Store monthly closing prices
                ticker_prices = []
                dates = []
                
                for date, row in hist.iterrows():
                    # Convert to string date for JSON serialization
                    date_str = date.strftime("%Y-%m-%d")
                    dates.append(date_str)
                    ticker_prices.append(round(row['Close'], 2))
                
                result["prices"][ticker] = ticker_prices
                
                # Use first ticker's dates as reference (they should align)
                if not result["dates"]:
                    result["dates"] = dates
            else:
                result["prices"][ticker] = []
                result["errors"].append(f"No historical data for {ticker}")
                
        except Exception as e:
            result["prices"][ticker] = []
            result["errors"].append(f"{ticker}: {str(e)}")
    
    return result


def calculate_portfolio_max_drawdown(
    holdings: List[Dict],  # List of {ticker, shares, isCash}
    months: int = 24
) -> Dict:
    """
    Calculate max drawdown for a portfolio using monthly historical data.
    
    Args:
        holdings: List of dicts with ticker, shares, isCash
        months: Months of history to analyze
    
    Returns:
        Dict with max_drawdown, peak_date, trough_date, recovery info
    """
    if not holdings:
        return {
            "max_drawdown": 0,
            "peak_value": 0,
            "trough_value": 0,
            "peak_date": None,
            "trough_date": None,
            "monthly_values": []
        }
    
    # Get tickers (exclude cash)
    tickers = [h["ticker"] for h in holdings if not h.get("isCash", False)]
    
    # Get historical prices
    historical = get_monthly_historical_prices(tickers, months)
    
    if not historical["dates"]:
        return {
            "max_drawdown": 0,
            "peak_value": 0,
            "trough_value": 0,
            "peak_date": None,
            "trough_date": None,
            "monthly_values": [],
            "error": "No historical data available"
        }
    
    # Calculate portfolio value for each month
    monthly_values = []
    
    for i, date in enumerate(historical["dates"]):
        portfolio_value = 0
        
        for holding in holdings:
            ticker = holding["ticker"]
            shares = holding["shares"]
            is_cash = holding.get("isCash", False)
            
            if is_cash:
                # Cash value stays constant
                portfolio_value += shares
            elif ticker in historical["prices"] and i < len(historical["prices"][ticker]):
                price = historical["prices"][ticker][i]
                portfolio_value += shares * price
        
        monthly_values.append({
            "date": date,
            "value": round(portfolio_value, 2)
        })
    
    # Calculate max drawdown
    if not monthly_values:
        return {
            "max_drawdown": 0,
            "peak_value": 0,
            "trough_value": 0,
            "peak_date": None,
            "trough_date": None,
            "monthly_values": []
        }
    
    max_drawdown = 0
    peak_value = monthly_values[0]["value"]
    peak_date = monthly_values[0]["date"]
    trough_value = peak_value
    trough_date = peak_date
    
    current_peak = peak_value
    current_peak_date = peak_date
    
    for mv in monthly_values:
        value = mv["value"]
        date = mv["date"]
        
        if value > current_peak:
            current_peak = value
            current_peak_date = date
        
        if current_peak > 0:
            drawdown = (current_peak - value) / current_peak
            
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                peak_value = current_peak
                peak_date = current_peak_date
                trough_value = value
                trough_date = date
    
    return {
        "max_drawdown": round(max_drawdown, 4),
        "peak_value": round(peak_value, 2),
        "trough_value": round(trough_value, 2),
        "peak_date": peak_date,
        "trough_date": trough_date,
        "monthly_values": monthly_values
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

