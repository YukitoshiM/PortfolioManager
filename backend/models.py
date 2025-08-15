from sqlalchemy import Column, Integer, String, Float, Table, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

# Association table for many-to-many relationship between Stock and Strategy
stock_strategy_association = Table(
    'stock_strategy_association', Base.metadata,
    Column('stock_id', Integer, ForeignKey('stocks.id')),
    Column('strategy_id', Integer, ForeignKey('strategies.id'))
)

class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    quantity = Column(Integer)
    acquisition_price = Column(Float)
    category = Column(String, default="未分類")

    # Many-to-many relationship with Strategy
    strategies = relationship("Strategy", secondary=stock_strategy_association, back_populates="stocks")

class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey('strategies.id'), nullable=True) # New field for parent strategy

    # Self-referencing relationship for parent/child strategies
    parent = relationship("Strategy", remote_side=[id], back_populates="children")
    children = relationship("Strategy", back_populates="parent")

    # Many-to-many relationship with Stock
    stocks = relationship("Stock", secondary=stock_strategy_association, back_populates="strategies")

class TargetAllocation(Base):
    __tablename__ = "allocations"

    category = Column(String, primary_key=True, index=True)
    percentage = Column(Float)