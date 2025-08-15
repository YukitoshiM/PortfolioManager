import os
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load .env file
dotenv_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

BASE_URL = "https://finnhub.io/api/v1"
API_KEY = os.getenv("FINNHUB_API_KEY")

def get_live_price(ticker: str) -> float | None:
    """
    Fetches the latest price for a given stock ticker from Finnhub.
    If current price is zero (market closed), uses previous close price.
    """
    if not API_KEY:
        print("ERROR: FINNHUB_API_KEY not found in environment variables.")
        return None

    params = {
        "symbol": ticker,
        "token": API_KEY
    }

    try:
        response = requests.get(f"{BASE_URL}/quote", params=params)
        response.raise_for_status()
        data = response.json()

        price = data.get("c") # Current price
        previous_close = data.get("pc") # Previous close price

        if price is not None and price > 0:
            print(f"Successfully fetched live price for {ticker}: {price}")
            return float(price)
        elif previous_close is not None and previous_close > 0:
            print(f"Market closed. Using previous close price for {ticker}: {previous_close}")
            return float(previous_close)
        else:
            print(f"Warning: No valid price (current or previous close) found for ticker {ticker}. Response: {data}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from Finnhub for {ticker}: {e}")
        return None
    except (KeyError, ValueError) as e:
        print(f"Error parsing price data for {ticker}: {e}")
        return None

def search_finnhub_symbol(query: str) -> dict:
    """
    Searches for symbols using Finnhub's symbol search API.
    """
    if not API_KEY:
        print("ERROR: FINNHUB_API_KEY not found in environment variables for search.")
        return {"error": "API key missing"}

    params = {
        "q": query,
        "token": API_KEY
    }

    try:
        response = requests.get(f"{BASE_URL}/search", params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error searching Finnhub for {query}: {e}")
        return {"error": str(e)}
