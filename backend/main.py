from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio

from backend import crud, models, schemas, market_data
from .market_data import search_finnhub_symbol
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS Middleware Configuration
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173", # Default for Vite
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def validate_strategy_hierarchy(db: Session, strategy_ids: List[int]):
    if not strategy_ids:
        return

    selected_strategies = db.query(models.Strategy).filter(models.Strategy.id.in_(strategy_ids)).all()
    selected_strategy_ids_set = set(strategy_ids)

    for strategy in selected_strategies:
        if strategy.parent_id is not None:
            if strategy.parent_id not in selected_strategy_ids_set:
                raise HTTPException(
                    status_code=400,
                    detail=f"Child strategy '{strategy.name}' (ID: {strategy.id}) requires its parent (ID: {strategy.parent_id}) to also be selected."
                )

# --- Stocks API ---

@app.post("/stocks/", response_model=schemas.Stock, tags=["Stocks"])
async def create_stock(stock: schemas.StockCreate, db: Session = Depends(get_db)):
    validate_strategy_hierarchy(db, stock.strategy_ids)
    # Check if stock with this ticker already exists
    db_stock = crud.get_stock_by_ticker(db, ticker=stock.ticker)

    if db_stock:
        # Stock exists, update quantity and weighted average acquisition price
        existing_quantity = db_stock.quantity
        existing_acquisition_price = db_stock.acquisition_price
        
        new_quantity = stock.quantity
        new_acquisition_price = stock.acquisition_price

        new_total_quantity = existing_quantity + new_quantity
        
        # Avoid division by zero if new_total_quantity is 0 (shouldn't happen with positive quantities)
        if new_total_quantity == 0:
            raise HTTPException(status_code=400, detail="Total quantity cannot be zero after addition.")

        new_weighted_average_price = (
            (existing_quantity * existing_acquisition_price) +
            (new_quantity * new_acquisition_price)
        ) / new_total_quantity

        # Update the existing stock
        # We need to pass a dictionary to crud.update_stock that matches schemas.StockUpdate
        # The current crud.update_stock expects schemas.StockUpdate, which has optional fields.
        # So we can create a dict with only the fields we want to update.
        update_data = {
            "ticker": db_stock.ticker,
            "name": db_stock.name, # Include existing name
            "quantity": new_total_quantity,
            "acquisition_price": new_weighted_average_price,
            "category": db_stock.category, # Include existing category
            "strategy_ids": [s.id for s in db_stock.strategies] # Include existing strategies
        }
        # Note: crud.update_stock expects stock_id, not ticker.
        # So we need to call crud.update_stock with db_stock.id
        return crud.update_stock(db=db, stock_id=db_stock.id, stock=schemas.StockUpdate(**update_data))
    else:
        # Stock does not exist, create a new one
        stock_data = stock.dict()

        # Auto-populate name
        try:
            name_data = await get_stock_name(stock.ticker)
            stock_data["name"] = name_data["name"]
        except HTTPException:
            stock_data["name"] = "不明な銘柄" # Default name if not found

        # Auto-populate category if not provided or is default "未分類"
        if not stock_data.get("category") or stock_data["category"] == "未分類":
            if stock.ticker.isdigit():
                stock_data["category"] = "日本株"
            else:
                stock_data["category"] = "米国株" # Simple heuristic for now

        # Pass the prepared dictionary to crud.create_stock
        return crud.create_stock(db=db, stock_data=stock_data)

@app.get("/stocks/", response_model=List[schemas.Stock], tags=["Stocks"])
def read_stocks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stocks = crud.get_stocks(db, skip=skip, limit=limit)
    return stocks

@app.put("/stocks/{stock_id}", response_model=schemas.Stock, tags=["Stocks"])
def update_stock(stock_id: int, stock: schemas.StockUpdate, db: Session = Depends(get_db)):
    validate_strategy_hierarchy(db, stock.strategy_ids)
    db_stock = crud.get_stock(db, stock_id=stock_id)
    if db_stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    existing_stock_with_ticker = crud.get_stock_by_ticker(db, ticker=stock.ticker)
    if existing_stock_with_ticker and existing_stock_with_ticker.id != stock_id:
        raise HTTPException(status_code=400, detail="This ticker is already registered to another stock")
    return crud.update_stock(db=db, stock_id=stock_id, stock=stock)

@app.delete("/stocks/{stock_id}", response_model=schemas.Stock, tags=["Stocks"])
def delete_stock(stock_id: int, db: Session = Depends(get_db)):
    db_stock = crud.delete_stock(db, stock_id=stock_id)
    if db_stock is None:
        raise HTTPException(status_code=404, detail="Stock not found")
    return db_stock

@app.get("/stocks/live-prices", response_model=dict[int, float], tags=["Stocks"])
async def get_all_live_prices(db: Session = Depends(get_db)):
    """
    Fetches the live price for all stocks in the database.
    Returns a dictionary mapping stock ID to its live price.
    """
    stocks = crud.get_stocks(db, limit=1000)
    async def fetch_price(stock):
        quote_data = await asyncio.to_thread(market_data.get_quote_data, stock.ticker)
        price = quote_data.get("c") if quote_data else None
        return stock.id, price
    price_tasks = [fetch_price(stock) for stock in stocks]
    price_results = await asyncio.gather(*price_tasks)
    live_prices = {stock_id: price for stock_id, price in price_results if price is not None}
    return live_prices

@app.get("/stocks/live-prices/{ticker}", response_model=schemas.QuoteData, tags=["Stocks"])
async def get_single_live_price(ticker: str):
    """
    Fetches the live quote data for a single stock ticker.
    """
    quote = await asyncio.to_thread(market_data.get_quote_data, ticker)
    if quote is not None:
        return quote
    raise HTTPException(status_code=404, detail=f"Quote data not found for ticker {ticker}.")

@app.get("/stocks/name/{ticker}", tags=["Stocks"])
async def get_stock_name(ticker: str):
    """
    Fetches the company name for a given ticker using Finnhub search.
    """
    search_results = await asyncio.to_thread(search_finnhub_symbol, ticker)
    if "result" in search_results and search_results["result"]:
        for item in search_results["result"]:
            if item.get("symbol") == ticker or item.get("displaySymbol") == ticker:
                return {"name": item.get("description", "Unknown")}
            if ticker.isdigit() and item.get("displaySymbol") == ticker and item.get("type") == "Common Stock":
                return {"name": item.get("description", "Unknown")}
        for item in search_results["result"]:
            if item.get("type") == "Common Stock":
                return {"name": item.get("description", "Unknown")}
        return {"name": search_results["result"][0].get("description", "Unknown")}
    raise HTTPException(status_code=404, detail="Stock name not found for this ticker.")

@app.get("/stocks/{ticker}/profile", tags=["Stocks"])
async def get_stock_profile(ticker: str):
    """
    Fetches the company profile for a given ticker.
    """
    profile = await asyncio.to_thread(market_data.get_company_profile, ticker)
    if profile:
        return profile
    raise HTTPException(status_code=404, detail="Company profile not found for this ticker.")

@app.get("/stocks/{ticker}/metrics", tags=["Stocks"])
async def get_stock_metrics(ticker: str):
    """
    Fetches key financial metrics for a given ticker.
    """
    metrics = await asyncio.to_thread(market_data.get_financial_metrics, ticker)
    if metrics:
        return metrics
    raise HTTPException(status_code=404, detail="Financial metrics not found for this ticker.")

@app.get("/stocks/{ticker}/news", tags=["Stocks"])
async def get_stock_news(ticker: str, _from: str, to: str):
    """
    Fetches company news for a given ticker and date range.
    Date format: YYYY-MM-DD
    """
    news = await asyncio.to_thread(market_data.get_company_news, ticker, _from, to)
    if news is not None: # news can be an empty list if no news found
        return news
    raise HTTPException(status_code=404, detail="Company news not found for this ticker or date range.")

# --- Strategies API ---

@app.post("/strategies/", response_model=schemas.Strategy, tags=["Strategies"])
def create_strategy(strategy: schemas.StrategyCreate, db: Session = Depends(get_db)):
    db_strategy = crud.get_strategy_by_name(db, name=strategy.name)
    if db_strategy:
        raise HTTPException(status_code=400, detail="Strategy with this name already registered")
    return crud.create_strategy(db=db, strategy=strategy)

@app.get("/strategies/", response_model=List[schemas.Strategy], tags=["Strategies"])
def read_strategies(skip: int = 0, limit: int = 100, parent_id: Optional[int] = None, db: Session = Depends(get_db)):
    strategies = crud.get_strategies(db, skip=skip, limit=limit, parent_id=parent_id)
    return strategies

@app.get("/strategies/{strategy_id}", response_model=schemas.Strategy, tags=["Strategies"])
def read_strategy(strategy_id: int, db: Session = Depends(get_db)):
    db_strategy = crud.get_strategy(db, strategy_id=strategy_id)
    if db_strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return db_strategy

@app.put("/strategies/{strategy_id}", response_model=schemas.Strategy, tags=["Strategies"])
def update_strategy(strategy_id: int, strategy: schemas.StrategyCreate, db: Session = Depends(get_db)):
    db_strategy = crud.update_strategy(db, strategy_id=strategy_id, strategy=strategy)
    if db_strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return db_strategy

@app.delete("/strategies/{strategy_id}", response_model=schemas.Strategy, tags=["Strategies"])
def delete_strategy(strategy_id: int, db: Session = Depends(get_db)):
    db_strategy = crud.delete_strategy(db, strategy_id=strategy_id)
    if db_strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return db_strategy

# --- Allocations API ---

@app.post("/allocations/", response_model=schemas.TargetAllocation, tags=["Allocations"])
def create_or_update_allocation(allocation: schemas.TargetAllocationCreate, db: Session = Depends(get_db)):
    return crud.create_or_update_allocation(db=db, allocation=allocation)

@app.get("/allocations/", response_model=List[schemas.TargetAllocation], tags=["Allocations"])
def read_allocations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    allocations = crud.get_allocations(db, skip=skip, limit=limit)
    return allocations

@app.delete("/allocations/{category}", response_model=schemas.TargetAllocation, tags=["Allocations"])
def delete_allocation(category: str, db: Session = Depends(get_db)):
    db_allocation = crud.delete_allocation(db, category=category)
    if db_allocation is None:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return db_allocation

# --- Finnhub Specific API ---
@app.get("/finnhub/search/{query}", tags=["Finnhub"])
async def finnhub_symbol_search(query: str):
    """
    Searches for stock symbols using Finnhub's API.
    """
    result = await asyncio.to_thread(search_finnhub_symbol, query)
    return result
