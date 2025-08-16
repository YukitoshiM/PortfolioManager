from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List

# --- Strategy Schemas ---
class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None # New field for parent strategy

class StrategyCreate(StrategyBase):
    pass

class Strategy(StrategyBase):
    id: int
    # parent_id: Optional[int] # Already inherited from StrategyBase
    # children: List[Strategy] = [] # Not including children to avoid recursion in response

    model_config = ConfigDict(from_attributes=True)

# --- Stock Schemas ---
class StockBase(BaseModel):
    ticker: str
    name: Optional[str] = None
    quantity: int
    acquisition_price: float
    category: Optional[str] = "未分類"
    strategy_ids: Optional[List[int]] = [] # New field for associating strategies

class StockCreate(StockBase):
    pass

class StockUpdate(StockBase):
    pass

class Stock(StockBase):
    id: int
    strategies: List[Strategy] = [] # Include list of strategies in response model

    model_config = ConfigDict(from_attributes=True)

# --- TargetAllocation Schemas ---
class TargetAllocationBase(BaseModel):
    category: str
    percentage: float = Field(..., gt=0, le=100, description="目標比率（0より大きく100以下）")

class TargetAllocationCreate(TargetAllocationBase):
    pass

class TargetAllocation(TargetAllocationBase):
    model_config = ConfigDict(from_attributes=True)

# --- Market Data Schemas ---
class QuoteData(BaseModel):
    c: float # Current price
    d: Optional[float] = None # Change
    dp: Optional[float] = None # Percent change
    h: float # High price of the day
    l: float # Low price of the day
    o: float # Open price of the day
    pc: float # Previous close price
