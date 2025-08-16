import os
import requests
from dotenv import load_dotenv
from pathlib import Path
import datetime

# Load .env file
dotenv_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

BASE_URL = "https://finnhub.io/api/v1"
API_KEY = os.getenv("FINNHUB_API_KEY")

def get_quote_data(ticker: str) -> dict | None:
    """
    Fetches quote data for a given stock ticker from Finnhub.
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

        # Finnhub returns c=0, h=0 etc. if the market is closed or ticker is invalid
        if data.get("c") is not None and data.get("c") > 0:
            print(f"Successfully fetched quote data for {ticker}")
            return data
        else:
            print(f"Warning: No valid quote data found for ticker {ticker}. Response: {data}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from Finnhub for {ticker}: {e}")
        return None
    except (KeyError, ValueError) as e:
        print(f"Error parsing quote data for {ticker}: {e}")
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

def get_company_profile(ticker: str) -> dict | None:
    """
    Fetches company profile data (e.g., market capitalization, 52-week high/low) from Finnhub.
    """
    if not API_KEY:
        print("ERROR: FINNHUB_API_KEY not found for company profile.")
        return None

    params = {
        "symbol": ticker,
        "token": API_KEY
    }

    try:
        response = requests.get(f"{BASE_URL}/stock/profile2", params=params)
        response.raise_for_status()
        data = response.json()
        if data:
            print(f"Successfully fetched company profile for {ticker}")
            return data
        else:
            print(f"Warning: No company profile data found for ticker {ticker}.")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching company profile from Finnhub for {ticker}: {e}")
        return None
    except (KeyError, ValueError) as e:
        print(f"Error parsing company profile data for {ticker}: {e}")
        return None

def get_financial_metrics(ticker: str) -> dict | None:
    """
    Fetches key financial metrics (e.g., PER, PBR, dividend yield) from Finnhub.
    """
    if not API_KEY:
        print("ERROR: FINNHUB_API_KEY not found for financial metrics.")
        return None

    params = {
        "symbol": ticker,
        "metricType": "all", # Request all metrics
        "token": API_KEY
    }

    try:
        response = requests.get(f"{BASE_URL}/stock/metric", params=params)
        response.raise_for_status()
        data = response.json()
        if data and "metric" in data:
            print(f"Successfully fetched financial metrics for {ticker}")
            return data["metric"]
        else:
            print(f"Warning: No financial metrics data found for ticker {ticker}. Response: {data}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching financial metrics from Finnhub for {ticker}: {e}")
        return None
    except (KeyError, ValueError) as e:
        print(f"Error parsing financial metrics data for {ticker}: {e}")
        return None

def get_company_news(ticker: str, _from: str, to: str) -> list | None:
    """
    Fetches company news for a given ticker and date range from Finnhub.
    _from and to should be in 'YYYY-MM-DD' format.
    """
    if not API_KEY:
        print("ERROR: FINNHUB_API_KEY not found for company news.")
        return None

    try:
        # Ensure dates are in YYYY-MM-DD format
        from_date_formatted = datetime.datetime.strptime(_from, "%Y-%m-%d").strftime("%Y-%m-%d")
        to_date_formatted = datetime.datetime.strptime(to, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        print(f"Error: Invalid date format for news request. Expected YYYY-MM-DD. Got _from={_from}, to={to}")
        return None

    params = {
        "symbol": ticker,
        "from": from_date_formatted,
        "to": to_date_formatted,
        "token": API_KEY
    }

    try:
        response = requests.get(f"{BASE_URL}/company-news", params=params)
        response.raise_for_status()
        data = response.json()
        if data:
            print(f"Successfully fetched company news for {ticker}")
            return data
        else:
            print(f"Warning: No company news found for ticker {ticker}.")
            return []
    except requests.exceptions.RequestException as e:
        print(f"Error fetching company news from Finnhub for {ticker}: {e}")
        return None
    except (KeyError, ValueError) as e:
        print(f"Error parsing company news data for {ticker}: {e}")
        return None