from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from . import models, schemas

# --- Stock CRUD ---

def get_stock(db: Session, stock_id: int):
    return db.query(models.Stock).options(joinedload(models.Stock.strategies)).filter(models.Stock.id == stock_id).first()

def get_stock_by_ticker(db: Session, ticker: str):
    return db.query(models.Stock).filter(models.Stock.ticker == ticker).first()

def get_stocks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Stock).options(joinedload(models.Stock.strategies)).offset(skip).limit(limit).all()

def create_stock(db: Session, stock_data: dict):
    # Extract strategy_ids if present
    strategy_ids = stock_data.pop("strategy_ids", [])
    
    db_stock = models.Stock(**stock_data)
    
    # Associate strategies
    for strategy_id in strategy_ids:
        strategy = db.query(models.Strategy).get(strategy_id)
        if strategy:
            db_stock.strategies.append(strategy)

    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

def update_stock(db: Session, stock_id: int, stock: schemas.StockUpdate):
    db_stock = get_stock(db, stock_id=stock_id)
    if db_stock:
        # Handle strategy_ids separately as it's a relationship
        strategy_ids = stock.strategy_ids
        stock_data = stock.dict(exclude_unset=True, exclude={"strategy_ids"}) # Exclude strategy_ids from dict
        
        for key, value in stock_data.items():
            setattr(db_stock, key, value)
        
        # Update strategies
        if strategy_ids is not None: # Only update if strategy_ids is explicitly provided
            db_stock.strategies.clear() # Clear existing associations
            for strategy_id in strategy_ids:
                strategy = db.query(models.Strategy).get(strategy_id)
                if strategy:
                    db_stock.strategies.append(strategy)

        db.commit()
        db.refresh(db_stock)
    return db_stock

def delete_stock(db: Session, stock_id: int):
    db_stock = get_stock(db, stock_id=stock_id)
    if db_stock:
        db.delete(db_stock)
        db.commit()
    return db_stock


# --- Strategy CRUD ---

def get_strategy(db: Session, strategy_id: int):
    return db.query(models.Strategy).filter(models.Strategy.id == strategy_id).first()

def get_strategy_by_name(db: Session, name: str):
    return db.query(models.Strategy).filter(models.Strategy.name == name).first()

def get_strategies(db: Session, skip: int = 0, limit: int = 100, parent_id: int | None = None):
    query = db.query(models.Strategy)
    if parent_id is not None:
        query = query.filter(models.Strategy.parent_id == parent_id)
    return query.offset(skip).limit(limit).all()

def create_strategy(db: Session, strategy: schemas.StrategyCreate):
    if strategy.parent_id is not None:
        parent_strategy = db.query(models.Strategy).filter(models.Strategy.id == strategy.parent_id).first()
        if parent_strategy and parent_strategy.parent_id is not None:
            raise HTTPException(status_code=400, detail="Child strategies can only be one generation deep. The parent strategy itself is already a child.")

    db_strategy = models.Strategy(
        name=strategy.name,
        description=strategy.description,
        parent_id=strategy.parent_id
    )
    db.add(db_strategy)
    db.commit()
    db.refresh(db_strategy)
    return db_strategy

def update_strategy(db: Session, strategy_id: int, strategy: schemas.StrategyCreate):
    db_strategy = get_strategy(db, strategy_id=strategy_id)
    if db_strategy:
        db_strategy.name = strategy.name
        db_strategy.description = strategy.description
        db_strategy.parent_id = strategy.parent_id # Update parent_id
        db.commit()
        db.refresh(db_strategy)
    return db_strategy

def delete_strategy(db: Session, strategy_id: int):
    db_strategy = get_strategy(db, strategy_id=strategy_id)
    if db_strategy:
        db.delete(db_strategy)
        db.commit()
    return db_strategy


# --- TargetAllocation CRUD ---

def get_allocation(db: Session, category: str):
    return db.query(models.TargetAllocation).filter(models.TargetAllocation.category == category).first()

def get_allocations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TargetAllocation).offset(skip).limit(limit).all()

def create_or_update_allocation(db: Session, allocation: schemas.TargetAllocationCreate):
    db_allocation = get_allocation(db, category=allocation.category)
    if db_allocation:
        db_allocation.percentage = allocation.percentage
    else:
        db_allocation = models.TargetAllocation(**allocation.dict())
        db.add(db_allocation)
    db.commit()
    db.refresh(db_allocation)
    return db_allocation

def delete_allocation(db: Session, category: str):
    db_allocation = get_allocation(db, category=category)
    if db_allocation:
        db.delete(db_allocation)
        db.commit()
    return db_allocation