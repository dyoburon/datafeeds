import os
from dotenv import load_dotenv

# Try loading from where app.py loads it
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
print(f"Loading from: {dotenv_path}")
loaded = load_dotenv(dotenv_path)
print(f"Load_dotenv returned: {loaded}")

keys = ["EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_RECIPIENT"]
for key in keys:
    val = os.environ.get(key)
    print(f"{key}: {'Present' if val else 'Missing'}")

