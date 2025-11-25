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

# Load env vars if not already loaded
load_dotenv()

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

def send_daily_email_task():
    print("Email Service: Starting daily email task...")
    
    # 1. Load Daily Analysis
    cache_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'daily_analysis.json')
    if not os.path.exists(cache_file):
        print("Email Service: No daily analysis file found. Aborting.")
        return

    try:
        with open(cache_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Email Service: Failed to read analysis file: {e}")
        return

    # 2. Check Config
    sender_email = os.environ.get("EMAIL_USER")
    sender_password = os.environ.get("EMAIL_PASSWORD")
    recipient_email = os.environ.get("EMAIL_RECIPIENT")
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))

    if not sender_email or not sender_password or not recipient_email:
        print("Email Service: Missing credentials (EMAIL_USER, EMAIL_PASSWORD, or EMAIL_RECIPIENT).")
        return

    # 3. Prepare Email Content
    date_str = datetime.now().strftime("%B %d, %Y")
    score = data.get('intrigue_score', 0)
    
    # Header Color Logic
    header_bg = "#1e40af" # Blue default
    if score >= 80: header_bg = "#065f46" # Green
    if score < 50: header_bg = "#4b5563" # Gray

    # Start HTML
    html_parts = []
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
            </div>
            
            <!-- Summary -->
            <div style="padding: 24px;">
                <p style="font-size: 16px; line-height: 1.6; margin-top: 0;">{data.get('summary', 'No summary available.')}</p>
            </div>
            
            <!-- Headlines -->
            <div style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 16px 0; color: #4b5563; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Top Headlines</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151;">
                    {''.join(f'<li style="margin-bottom: 8px;">{h}</li>' for h in data.get('top_news', []))}
                </ul>
            </div>
            
            <!-- Questions & Analysis -->
            <div style="padding: 24px;">
                <h3 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Key Insights</h3>
    """)

    # Prepare images mapping
    # We need to generate images and attach them
    # cid_map stores { 'question_index': 'cid_string' }
    cid_map = {}
    images_to_attach = []

    questions = data.get('questions', [])
    for i, q in enumerate(questions):
        q_text = q.get('question', 'Unknown Question')
        insight = q.get('insight_explanation', '')
        result_explanation = q.get('result_explanation', '')
        
        # Results Data
        # Backend saves it as q['results'] -> { 'results': ..., 'control': ... }
        # Wait, services.py saves: q_obj['results'] = test_result
        # test_result has keys: results, control, signals
        # So we access q['results']['results'] and q['results']['control']
        
        stats_data = {}
        control_data = {}
        has_results = False
        
        if 'results' in q and isinstance(q['results'], dict):
             stats_data = q['results'].get('results', {})
             control_data = q['results'].get('control', {})
             has_results = True
        
        count = stats_data.get('count', 0)
        
        # Generate Chart
        chart_cid = f"chart_{i}"
        chart_img_data = None
        if has_results:
            chart_img_data = generate_chart_image(stats_data, control_data)
            
        if chart_img_data:
            cid_map[i] = chart_cid
            images_to_attach.append((chart_cid, chart_img_data))
        
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
            # Extract periods
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
                
                # Color code signal
                color = "#059669" if s_mean > 0 else "#dc2626" # Green/Red
                
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

    html_parts.append("""
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">
                Automated Daily Market Analysis System
            </div>
        </div>
    </body>
    </html>
    """)

    full_html = "".join(html_parts)

    # 4. Build Message
    msg = MIMEMultipart('related')
    msg['Subject'] = f"Daily Market Insights: {date_str} (Score: {score})"
    msg['From'] = sender_email
    msg['To'] = recipient_email

    # Attach HTML
    msg_alternative = MIMEMultipart('alternative')
    msg.attach(msg_alternative)
    msg_alternative.attach(MIMEText(full_html, 'html'))

    # Attach Images with Content-IDs
    for cid, img_data in images_to_attach:
        img = MIMEImage(img_data)
        img.add_header('Content-ID', f'<{cid}>')
        img.add_header('Content-Disposition', 'inline', filename=f'{cid}.png')
        msg.attach(img)

    # 5. Send
    try:
        print("Email Service: Connecting to SMTP server...")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        print("Email Service: Email sent successfully.")
        return {"status": "success", "message": "Email sent"}
    except Exception as e:
        print(f"Email Service: Failed to send email: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    # Quick test if run directly
    send_daily_email_task()

