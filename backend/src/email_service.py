import os
import json
import smtplib
import matplotlib
# Set backend to Agg to prevent GUI window errors
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from datetime import datetime
from dotenv import load_dotenv
from .user_service import (
    get_users_by_content_type, get_user_by_id, get_user_holdings,
    get_cached_portfolio_news, save_cached_portfolio_news, should_refresh_portfolio_news
)
from .watchlist_service import get_watchlist_for_email, get_ticker_data

# Load env vars if not already loaded
load_dotenv()

# Content type identifier for this email type
CONTENT_TYPE_ID = "quantitative_analysis"

GLOSSARY = {
    "VIX": "The CBOE Volatility Index, often called the 'fear gauge'. It measures expected market volatility over the next 30 days based on S&P 500 options.",
    "Z-Score": "A statistical measurement that describes a value's relationship to the mean of a group of values. Z-score is measured in terms of standard deviations from the mean.",
    "Relative Volume": "A ratio comparing current volume to the average volume for the same time of day. Value > 1 indicates higher than normal activity.",
    "P/E": "Price-to-Earnings Ratio. A valuation ratio of a company's current share price compared to its per-share earnings.",
    "Yield Curve": "A line that plots yields (interest rates) of bonds having equal credit quality but differing maturity dates. An inverted yield curve (short-term rates > long-term rates) is often seen as a recession predictor.",
    "TNX": "The CBOE 10-Year Treasury Note Yield Index. It tracks the yield on 10-year US Treasury notes.",
    "Basis Points": "A unit of measure used in finance to describe the percentage change in the value or rate of a financial instrument. One basis point is equivalent to 0.01% (1/100th of a percent).",
    "RSI": "Relative Strength Index. A momentum indicator used in technical analysis that measures the magnitude of recent price changes to evaluate overbought or oversold conditions.",
    "SMA": "Simple Moving Average. An arithmetic moving average calculated by adding recent prices and then dividing that figure by the number of time periods in the calculation.",
    "Mean Reversion": "A financial theory suggesting that asset prices and historical returns eventually return to the long-run mean or average level of the entire dataset.",
    "Volatility": "A statistical measure of the dispersion of returns for a given security or market index. High volatility means the price can change dramatically over a short time period.",
    "Forward Return": "The percentage return of an asset over a future period (e.g., '1M Forward Return' is the return over the next month).",
    "Win Rate": "The percentage of trades or signals that resulted in a positive return.",
    "Baseline": "The average performance of the market (S&P 500) over the same time periods, used as a benchmark to compare against the specific signal."
}

def format_percentage(val):
    if val is None: return "N/A"
    if isinstance(val, str): return val
    return f"{val * 100:.2f}%"

def generate_chart_image(results_data, control_data):
    """
    Generates a bar chart comparing Signal vs Baseline for available periods.
    Returns the image as a bytes object.
    """
    try:
        # Extract periods that exist in both (or just results)
        periods = [k for k in results_data.keys() if k != 'count' and k in results_data and isinstance(results_data[k], dict)]
        
        # Sort periods logically if possible
        order = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y']
        periods = sorted(periods, key=lambda x: order.index(x) if x in order else 999)
        
        if not periods:
            return None

        # Prepare data
        labels = periods
        signal_means = [results_data[p]['mean'] * 100 for p in periods]
        
        baseline_means = []
        if control_data:
            for p in periods:
                if p in control_data and isinstance(control_data[p], dict):
                    baseline_means.append(control_data[p]['mean'] * 100)
                else:
                    baseline_means.append(0)
        else:
            baseline_means = [0] * len(periods)

        # Plotting
        x = range(len(labels))
        width = 0.35
        
        fig, ax = plt.subplots(figsize=(6, 3.5))
        
        # Set dark style colors manually since 'dark_background' might look too harsh on white email
        # Let's use a clean light style for email compatibility
        fig.patch.set_facecolor('#f3f4f6')
        ax.set_facecolor('#f3f4f6')
        
        rects1 = ax.bar([i - width/2 for i in x], signal_means, width, label='Signal', color='#3b82f6')
        rects2 = ax.bar([i + width/2 for i in x], baseline_means, width, label='Baseline', color='#9ca3af')

        # Add some text for labels, title and custom x-axis tick labels, etc.
        ax.set_ylabel('Average Return (%)')
        ax.set_xticks(x)
        ax.set_xticklabels(labels)
        ax.legend()
        
        # Add horizontal grid
        ax.yaxis.grid(True, linestyle='--', alpha=0.3, color='gray')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#4b5563')
        ax.spines['bottom'].set_color('#4b5563')

        plt.tight_layout()
        
        # Save to buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        plt.close(fig)
        return buf.getvalue()
        
    except Exception as e:
        print(f"Error generating chart: {e}")
        return None


def generate_watchlist_html(user: dict) -> str:
    """
    Generate HTML section for a user's watchlist.
    Returns empty string if user has no watchlist or watchlist_news preference.
    """
    # Check if user has watchlist_news preference
    if 'watchlist_news' not in user.get('preferences', []):
        return ""
    
    # Get user's watchlist
    watchlist = user.get('watchlist', [])
    if not watchlist:
        return ""
    
    # Fetch watchlist data (max 5 tickers)
    try:
        watchlist_data = get_watchlist_for_email(watchlist, max_tickers=5)
    except Exception as e:
        print(f"Error fetching watchlist data for {user.get('email')}: {e}")
        return ""
    
    if not watchlist_data.get('has_data'):
        return ""
    
    tickers = watchlist_data.get('tickers', [])
    
    html_parts = []
    html_parts.append("""
        <div style="margin: 24px 0; border-top: 2px solid #e5e7eb; padding-top: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">
                📋 Your Watchlist
            </h3>
    """)
    
    # Show count info if some tickers were excluded
    if watchlist_data.get('excluded_count', 0) > 0:
        html_parts.append(f"""
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">
                Showing top {watchlist_data['showing']} of {watchlist_data['total_in_watchlist']} stocks (sorted by news activity)
            </p>
        """)
    
    for t in tickers:
        # Determine color based on performance
        change_pct = t.get('change_percent')
        if change_pct is not None:
            if change_pct > 0:
                perf_color = "#059669"  # Green
                perf_bg = "#d1fae5"
                arrow = "▲"
            elif change_pct < 0:
                perf_color = "#dc2626"  # Red
                perf_bg = "#fee2e2"
                arrow = "▼"
            else:
                perf_color = "#6b7280"  # Gray
                perf_bg = "#f3f4f6"
                arrow = "–"
            perf_text = f"{arrow} {'+' if change_pct > 0 else ''}{change_pct:.2f}%"
        else:
            perf_color = "#6b7280"
            perf_bg = "#f3f4f6"
            perf_text = "N/A"
        
        price = t.get('price')
        price_text = f"${price:.2f}" if price else "N/A"
        
        headlines = t.get('headlines', [])
        
        html_parts.append(f"""
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
                <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                    <div>
                        <span style="font-weight: 700; color: #111827; font-size: 16px;">{t['ticker']}</span>
                        <span style="color: #6b7280; font-size: 13px; margin-left: 8px;">{t['name']}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 600; color: #374151; font-size: 15px;">{price_text}</span>
                        <span style="margin-left: 8px; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; background-color: {perf_bg}; color: {perf_color};">
                            {perf_text}
                        </span>
                    </div>
                </div>
                <div style="padding: 12px 16px;">
        """)
        
        if headlines:
            html_parts.append("""
                    <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Recent Headlines</div>
                    <ul style="margin: 0; padding-left: 16px; color: #374151; font-size: 13px;">
            """)
            for h in headlines[:3]:
                # Truncate long headlines
                headline = h[:100] + "..." if len(h) > 100 else h
                html_parts.append(f'<li style="margin-bottom: 4px;">{headline}</li>')
            html_parts.append("</ul>")
            
            if t.get('news_count', 0) > 3:
                html_parts.append(f"""
                    <p style="font-size: 12px; color: #9ca3af; margin: 8px 0 0 0;">
                        +{t['news_count'] - 3} more articles
                    </p>
                """)
        else:
            html_parts.append("""
                    <p style="color: #9ca3af; font-size: 13px; font-style: italic; margin: 0;">
                        No significant news today. The stock is trading normally without major catalysts.
                    </p>
            """)
        
        html_parts.append("""
                </div>
            </div>
        """)
    
    html_parts.append("</div>")

    return "".join(html_parts)


def get_portfolio_news_for_email(user_id: str, max_stocks: int = 3) -> list:
    """
    Get portfolio news for a user, using cache if available or generating if needed.
    Returns the top N most interesting stocks (by news count + price movement).

    Args:
        user_id: The user's ID
        max_stocks: Maximum number of stocks to include (default 3)

    Returns:
        List of stock dicts with news and analysis, sorted by interestingness
    """
    import concurrent.futures

    # Check if user has holdings
    holdings_result = get_user_holdings(user_id)
    if 'error' in holdings_result:
        return []

    holdings = holdings_result.get('holdings', [])
    if not holdings:
        return []

    # Get unique tickers (exclude cash)
    tickers = list(set([
        h['ticker'] for h in holdings
        if h['ticker'].upper() not in ['CASH', '$CASH']
    ]))

    if not tickers:
        return []

    # Check cache first
    refresh_check = should_refresh_portfolio_news(user_id)

    if not refresh_check.get('should_refresh') and refresh_check.get('cached_news'):
        cached = refresh_check['cached_news']
        stocks = cached['news'].get('stocks', [])
        # Return top N most interesting from cache
        return get_top_interesting_stocks(stocks, max_stocks)

    # Need to generate - fetch data for all tickers
    try:
        from .llm_service import LLMService
        llm_service = LLMService()
    except Exception as e:
        print(f"Email Service: Could not initialize LLM service: {e}")
        return []

    stock_data = []

    # Fetch data in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_ticker = {
            executor.submit(get_ticker_data, ticker): ticker
            for ticker in tickers
        }

        for future in concurrent.futures.as_completed(future_to_ticker):
            try:
                data = future.result()
                stock_data.append(data)
            except Exception as e:
                ticker = future_to_ticker[future]
                stock_data.append({
                    "ticker": ticker,
                    "name": ticker,
                    "error": str(e)
                })

    # Analyze news for each stock with AI
    analyzed_stocks = []

    for stock in stock_data:
        ticker = stock.get('ticker', '')
        company_name = stock.get('name', ticker)
        news = stock.get('news', [])
        perf = stock.get('performance', {})

        # Get top 3 headlines
        headlines = [n.get('title', '') for n in news[:3] if n.get('title')]

        # Get price data
        price_data = {
            'price': perf.get('current_price'),
            'change': perf.get('change'),
            'change_percent': perf.get('change_percent')
        }

        # Analyze with AI
        try:
            analysis = llm_service.analyze_stock_news(
                ticker=ticker,
                company_name=company_name,
                headlines=headlines,
                price_data=price_data
            )
        except Exception as e:
            print(f"Email Service: Error analyzing {ticker}: {e}")
            analysis = {'summary': '', 'sentiment': 'neutral', 'key_themes': []}

        analyzed_stocks.append({
            "ticker": ticker,
            "company_name": company_name,
            "sector": stock.get('sector', 'Unknown'),
            "price": price_data.get('price'),
            "change": price_data.get('change'),
            "change_percent": price_data.get('change_percent'),
            "headlines": headlines,
            "news_count": len(news),
            "analysis": {
                "summary": analysis.get('summary', ''),
                "sentiment": analysis.get('sentiment', 'neutral'),
                "key_themes": analysis.get('key_themes', []),
                "price_context": analysis.get('price_context', ''),
                "notable_headline": analysis.get('notable_headline', '')
            },
            "error": stock.get('error') or analysis.get('error')
        })

    # Save to cache
    news_data = {
        "stocks": analyzed_stocks,
        "count": len(analyzed_stocks)
    }
    save_cached_portfolio_news(user_id, news_data)

    # Return top N most interesting
    return get_top_interesting_stocks(analyzed_stocks, max_stocks)


def get_top_interesting_stocks(stocks: list, max_stocks: int = 3) -> list:
    """
    Sort stocks by "interestingness" and return the top N.

    Interestingness is determined by:
    1. News count (more news = more interesting)
    2. Absolute price change (bigger moves = more interesting)
    3. Sentiment extremes (very positive or very negative)
    """
    def interestingness_score(stock):
        score = 0

        # News count (0-10 points)
        news_count = stock.get('news_count', 0)
        score += min(news_count * 2, 10)

        # Absolute price change (0-10 points)
        change_pct = abs(stock.get('change_percent', 0) or 0)
        score += min(change_pct * 2, 10)

        # Sentiment extremes (0-5 points)
        sentiment = stock.get('analysis', {}).get('sentiment', 'neutral')
        if sentiment in ['very_positive', 'very_negative']:
            score += 5
        elif sentiment in ['positive', 'negative']:
            score += 3

        # Has AI summary (2 points)
        if stock.get('analysis', {}).get('summary'):
            score += 2

        return score

    # Sort by interestingness score descending
    sorted_stocks = sorted(stocks, key=interestingness_score, reverse=True)

    return sorted_stocks[:max_stocks]


def generate_portfolio_news_html(user_id: str, preferences: list) -> str:
    """
    Generate HTML section for portfolio news in email.
    Returns empty string if user doesn't have portfolio_news preference or no portfolio.
    """
    # Check if user has portfolio_news preference
    if 'portfolio_news' not in preferences:
        return ""

    # Get top 3 interesting stocks
    stocks = get_portfolio_news_for_email(user_id, max_stocks=3)

    if not stocks:
        return ""

    html_parts = []
    html_parts.append("""
        <div style="margin: 24px 0; border-top: 2px solid #e5e7eb; padding-top: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">
                📈 Portfolio Highlights
            </h3>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">
                Top movers and news from your portfolio
            </p>
    """)

    for stock in stocks:
        ticker = stock.get('ticker', '')
        company_name = stock.get('company_name', ticker)
        price = stock.get('price')
        change_pct = stock.get('change_percent')
        headlines = stock.get('headlines', [])
        analysis = stock.get('analysis', {})

        # Determine color based on performance
        if change_pct is not None:
            if change_pct > 0:
                perf_color = "#059669"  # Green
                perf_bg = "#d1fae5"
                arrow = "▲"
            elif change_pct < 0:
                perf_color = "#dc2626"  # Red
                perf_bg = "#fee2e2"
                arrow = "▼"
            else:
                perf_color = "#6b7280"  # Gray
                perf_bg = "#f3f4f6"
                arrow = "–"
            perf_text = f"{arrow} {'+' if change_pct > 0 else ''}{change_pct:.2f}%"
        else:
            perf_color = "#6b7280"
            perf_bg = "#f3f4f6"
            perf_text = "N/A"

        price_text = f"${price:.2f}" if price else "N/A"

        # Sentiment badge
        sentiment = analysis.get('sentiment', 'neutral')
        sentiment_colors = {
            'very_positive': ('#065f46', '#d1fae5', '🚀'),
            'positive': ('#059669', '#d1fae5', '📈'),
            'neutral': ('#6b7280', '#f3f4f6', '➡️'),
            'negative': ('#dc2626', '#fee2e2', '📉'),
            'very_negative': ('#991b1b', '#fee2e2', '⚠️')
        }
        sent_color, sent_bg, sent_emoji = sentiment_colors.get(sentiment, sentiment_colors['neutral'])

        html_parts.append(f"""
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; overflow: hidden;">
                <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                    <div>
                        <span style="font-weight: 700; color: #111827; font-size: 16px;">{ticker}</span>
                        <span style="color: #6b7280; font-size: 13px; margin-left: 8px;">{company_name}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 600; color: #374151; font-size: 15px;">{price_text}</span>
                        <span style="margin-left: 8px; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; background-color: {perf_bg}; color: {perf_color};">
                            {perf_text}
                        </span>
                    </div>
                </div>
                <div style="padding: 12px 16px;">
        """)

        # AI Summary
        summary = analysis.get('summary', '')
        if summary:
            html_parts.append(f"""
                    <div style="margin-bottom: 12px; padding: 10px; background-color: #f9fafb; border-radius: 6px; border-left: 3px solid {sent_color};">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">{sent_emoji} AI Analysis</div>
                        <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">{summary}</p>
                    </div>
            """)

        # Headlines
        if headlines:
            html_parts.append("""
                    <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Recent Headlines</div>
                    <ul style="margin: 0; padding-left: 16px; color: #374151; font-size: 13px;">
            """)
            for h in headlines[:2]:  # Show max 2 headlines in email
                headline = h[:80] + "..." if len(h) > 80 else h
                html_parts.append(f'<li style="margin-bottom: 4px;">{headline}</li>')
            html_parts.append("</ul>")

        html_parts.append("""
                </div>
            </div>
        """)

    html_parts.append("</div>")

    return "".join(html_parts)


def filter_email_data_by_preferences(data: dict, preferences: list) -> dict:
    """
    Filter daily analysis data based on user preferences for email content.

    Preferences:
    - quantitative_analysis: Include AI-generated questions with backtested results
    - headlines: Include top news headlines
    - market_overview: Include summary

    Returns a filtered copy of the data.
    """
    if not preferences:
        # No filtering - return full data
        return data

    filtered = {}

    # Always include date and intrigue_score for context
    if 'date' in data:
        filtered['date'] = data['date']
    if 'intrigue_score' in data:
        filtered['intrigue_score'] = data['intrigue_score']

    # market_overview includes summary
    if 'market_overview' in preferences:
        if 'summary' in data:
            filtered['summary'] = data['summary']

    # headlines includes top_news
    if 'headlines' in preferences:
        if 'top_news' in data:
            filtered['top_news'] = data['top_news']

    # quantitative_analysis includes questions with backtested results
    if 'quantitative_analysis' in preferences:
        if 'questions' in data:
            filtered['questions'] = data['questions']

    return filtered


def send_daily_email_task():
    print("Email Service: Starting daily email task...")

    # 1. Load Daily Analysis (full data - filtering happens per-user)
    cache_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'daily_analysis.json')
    if not os.path.exists(cache_file):
        print("Email Service: No daily analysis file found. Aborting.")
        return

    try:
        with open(cache_file, 'r') as f:
            full_data = json.load(f)
    except Exception as e:
        print(f"Email Service: Failed to read analysis file: {e}")
        return

    # 2. Check Config
    sender_email = os.environ.get("EMAIL_USER")
    sender_password = os.environ.get("EMAIL_PASSWORD")
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))

    if not sender_email or not sender_password:
        print("Email Service: Missing credentials (EMAIL_USER or EMAIL_PASSWORD).")
        return

    # Get recipients from user preferences
    subscribed_users = get_users_by_content_type(CONTENT_TYPE_ID)

    # Fallback: Also check legacy EMAIL_RECIPIENT env var for backwards compatibility
    legacy_recipients = os.environ.get("EMAIL_RECIPIENT", "")
    legacy_emails = [r.strip() for r in legacy_recipients.split(',') if r.strip()]

    # Combine user service emails with legacy emails (dedup)
    all_emails = set(u['email'] for u in subscribed_users)
    all_emails.update(legacy_emails)
    recipients = list(all_emails)

    if not recipients:
        print("Email Service: No valid recipients found. Add users via the API or set EMAIL_RECIPIENT env var.")
        return

    print(f"Email Service: Found {len(recipients)} recipients for content type '{CONTENT_TYPE_ID}'")

    # 3. Common email data
    date_str = datetime.now().strftime("%B %d, %Y")
    score = full_data.get('intrigue_score', 0)

    # Pre-generate chart images for all questions (will only be included if user has quantitative_analysis pref)
    questions = full_data.get('questions', [])
    images_to_attach = []

    for i, q in enumerate(questions):
        if 'results' in q and isinstance(q['results'], dict):
            stats_data = q['results'].get('results', {})
            control_data = q['results'].get('control', {})
            chart_img_data = generate_chart_image(stats_data, control_data)
            if chart_img_data:
                images_to_attach.append((f"chart_{i}", chart_img_data))

    # 4. Send personalized emails to each user
    try:
        print("Email Service: Connecting to SMTP server...")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)

            emails_sent = 0

            # Create a map of emails to user data for personalization
            user_map = {u['email']: u for u in subscribed_users}

            for recipient_email in recipients:
                # Get user data if available
                user_data = user_map.get(recipient_email)
                user_preferences = user_data.get('preferences', []) if user_data else []

                # Filter data based on user preferences
                # If no preferences, show everything (backwards compatibility for legacy recipients)
                filtered_data = filter_email_data_by_preferences(full_data, user_preferences) if user_preferences else full_data

                # Build personalized HTML for this user
                full_html, user_images = build_email_html_for_user(
                    filtered_data,
                    date_str,
                    score,
                    user_data,
                    images_to_attach,
                    user_preferences
                )

                # Build Message
                msg = MIMEMultipart('related')
                msg['Subject'] = f"Daily Market Insights: {date_str} (Score: {score})"
                msg['From'] = sender_email
                msg['To'] = recipient_email

                # Attach HTML
                msg_alternative = MIMEMultipart('alternative')
                msg.attach(msg_alternative)
                msg_alternative.attach(MIMEText(full_html, 'html'))

                # Attach Images with Content-IDs (only those used in this user's email)
                for cid, img_data in user_images:
                    img = MIMEImage(img_data)
                    img.add_header('Content-ID', f'<{cid}>')
                    img.add_header('Content-Disposition', 'inline', filename=f'{cid}.png')
                    msg.attach(img)

                # Send to this recipient
                server.send_message(msg)
                emails_sent += 1

                prefs_str = ', '.join(user_preferences) if user_preferences else 'all (default)'
                print(f"Email Service: Sent personalized email to {recipient_email} (prefs: {prefs_str})")

            print(f"Email Service: Successfully sent {emails_sent} emails.")
            return {"status": "success", "message": f"Sent {emails_sent} emails"}

    except Exception as e:
        print(f"Email Service: Failed to send email: {e}")
        return {"error": str(e)}


def build_email_html_for_user(data: dict, date_str: str, score: int, user_data: dict, all_images: list, preferences: list) -> tuple:
    """
    Build personalized HTML email content based on user preferences.

    Returns: (html_string, list_of_images_to_attach)
    """
    html_parts = []
    used_images = []

    # Header Color Logic
    header_bg = "#1e40af"  # Blue default
    score_text = "Today's market conditions show interesting patterns worth monitoring."
    if score >= 80:
        header_bg = "#065f46"  # Green
        score_text = "Market conditions today are statistically highly significant, suggesting strong potential for future price action."
    elif score < 50:
        header_bg = "#4b5563"  # Gray
        score_text = "Today's market activity was largely noise with few statistically significant historical parallels."
    elif score >= 60:
        score_text = "Today shows some moderate historical patterns that may offer actionable insights."

    # Start HTML
    html_parts.append(f"""
    <html>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background-color: {header_bg}; color: white; padding: 24px; text-align: center;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Daily Market Analysis</div>
                <h1 style="margin: 8px 0; font-size: 28px; font-weight: 700;">{date_str}</h1>
                <div style="margin-top: 16px; display: inline-block; background-color: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 20px; font-weight: 600;">
                    Intrigue Score: {score}/100
                </div>
                <div style="margin-top: 8px; font-size: 13px; opacity: 0.9; font-style: italic;">
                    {score_text}
                </div>
            </div>
    """)

    # Summary section (market_overview preference)
    if data.get('summary'):
        html_parts.append(f"""
            <!-- Summary -->
            <div style="padding: 24px;">
                <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">{data.get('summary')}</p>
            </div>
        """)

    # Headlines section (headlines preference)
    if data.get('top_news'):
        html_parts.append(f"""
            <!-- Headlines -->
            <div style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 16px 0; color: #4b5563; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Top Headlines</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151;">
                    {''.join(f'<li style="margin-bottom: 8px;">{h}</li>' for h in data.get('top_news', []))}
                </ul>
            </div>
        """)

    # Questions & Analysis section (quantitative_analysis preference)
    questions = data.get('questions', [])
    if questions:
        html_parts.append("""
            <!-- Questions & Analysis -->
            <div style="padding: 24px;">
                <h3 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Key Insights</h3>
        """)

        for i, q in enumerate(questions):
            q_text = q.get('question', 'Unknown Question')
            insight = q.get('insight_explanation', '')
            result_explanation = q.get('result_explanation', '')

            stats_data = {}
            control_data = {}
            has_results = False

            if 'results' in q and isinstance(q['results'], dict):
                stats_data = q['results'].get('results', {})
                control_data = q['results'].get('control', {})
                has_results = True

            count = stats_data.get('count', 0)

            # Check if we have a chart image for this question
            chart_cid = f"chart_{i}"
            chart_img_data = None
            for cid, img_data in all_images:
                if cid == chart_cid:
                    chart_img_data = img_data
                    used_images.append((cid, img_data))
                    break

            # HTML for this Question Card
            html_parts.append(f"""
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px; overflow: hidden;">
                <div style="background-color: #f8fafc; padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <h4 style="margin: 0; color: #1e40af; font-size: 16px;">{q_text}</h4>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Based on {count} historical occurrences</div>
                </div>

                <div style="padding: 16px;">
                    <!-- Insight -->
                    <div style="margin-bottom: 16px; font-size: 14px; color: #4b5563; font-style: italic; border-left: 3px solid #3b82f6; padding-left: 12px;">
                        "{insight}"
                    </div>

                    <!-- Result Interpretation -->
                    <div style="margin-bottom: 16px; font-size: 14px; color: #1f2937;">
                        <strong>Verdict:</strong> {result_explanation}
                    </div>
            """)

            # Add Chart if available
            if chart_img_data:
                html_parts.append(f"""
                    <div style="text-align: center; margin: 20px 0;">
                        <img src="cid:{chart_cid}" style="max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #e5e7eb;" alt="Performance Chart">
                    </div>
                """)

            # Stats Table
            if has_results:
                periods = [k for k in stats_data.keys() if k != 'count' and k in stats_data and isinstance(stats_data[k], dict)]
                order = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y']
                periods = sorted(periods, key=lambda x: order.index(x) if x in order else 999)

                html_parts.append("""
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px;">
                        <tr style="background-color: #f3f4f6; color: #4b5563;">
                            <th style="padding: 8px; text-align: left;">Period</th>
                            <th style="padding: 8px; text-align: right;">Signal Mean</th>
                            <th style="padding: 8px; text-align: right;">Baseline</th>
                            <th style="padding: 8px; text-align: right;">Win Rate</th>
                        </tr>
                """)

                for p in periods:
                    s_mean = stats_data[p]['mean']
                    b_mean = control_data[p]['mean'] if p in control_data and isinstance(control_data[p], dict) else 0
                    win_rate = stats_data[p]['win_rate']
                    color = "#059669" if s_mean > 0 else "#dc2626"

                    html_parts.append(f"""
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                            <td style="padding: 8px; font-weight: 600; color: #374151;">{p}</td>
                            <td style="padding: 8px; text-align: right; font-weight: 700; color: {color};">{format_percentage(s_mean)}</td>
                            <td style="padding: 8px; text-align: right; color: #6b7280;">{format_percentage(b_mean)}</td>
                            <td style="padding: 8px; text-align: right; color: #374151;">{format_percentage(win_rate)}</td>
                        </tr>
                    """)

                html_parts.append("</table>")

            html_parts.append("""
                </div>
            </div>
            """)

        html_parts.append("</div>")  # Close Questions & Analysis section

    # Watchlist section (watchlist_news preference)
    if user_data:
        try:
            watchlist_html = generate_watchlist_html(user_data)
            if watchlist_html:
                html_parts.append(watchlist_html)
        except Exception as e:
            print(f"Email Service: Error generating watchlist: {e}")

    # Portfolio news section (portfolio_news preference)
    if user_data and user_data.get('id'):
        try:
            portfolio_news_html = generate_portfolio_news_html(user_data['id'], preferences)
            if portfolio_news_html:
                html_parts.append(portfolio_news_html)
        except Exception as e:
            print(f"Email Service: Error generating portfolio news: {e}")

    # Glossary Section - gather terms used in the filtered content
    all_text = (
        data.get('summary', '') + " " +
        " ".join(data.get('top_news', [])) + " " +
        " ".join([q.get('question', '') + " " + q.get('insight_explanation', '') + " " + q.get('result_explanation', '') for q in questions])
    ).lower()

    used_terms = []
    for term, definition in GLOSSARY.items():
        if term.lower() in all_text:
            used_terms.append((term, definition))

    if used_terms:
        html_parts.append("""
            <div style="padding: 24px; border-top: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 16px 0; color: #4b5563; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Glossary of Terms</h3>
                <div style="font-size: 13px; color: #4b5563;">
        """)

        for term, definition in used_terms:
            html_parts.append(f"""
                <div style="margin-bottom: 12px;">
                    <strong style="color: #1f2937;">{term}:</strong> {definition}
                </div>
            """)

        html_parts.append("""
                </div>
            </div>
        """)

    # Footer HTML
    html_parts.append("""
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
                Automated Daily Market Analysis System
            </div>
        </div>
    </body>
    </html>
    """)

    return "".join(html_parts), used_images

if __name__ == "__main__":
    # Quick test if run directly
    send_daily_email_task()

