import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Import new components
import StockFormPage from './components/StockFormPage';
import AssetCompositionPage from './components/AssetCompositionPage';
import AssetAllocationPage from './components/AssetAllocationPage';
import StockListPage from './components/StockListPage';
import NavBar from './components/NavBar';
import StrategyPage from './components/StrategyPage'; // Import StrategyPage
import StockDetailPage from './components/StockDetailPage'; // Import StockDetailPage

// --- TypeScript Interfaces ---
interface Stock {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  acquisition_price: number;
  category: string;
  strategies: Strategy[];
}

interface TargetAllocation {
  category: string;
  percentage: number;
}

interface CombinedAllocation {
  category: string;
  currentPercentage: number;
  targetPercentage: number;
}

// --- Constants ---
const API_URL = 'http://127.0.0.1:8000';
const REFRESH_INTERVAL = 60000; // 60 seconds

const DEFAULT_CATEGORIES = ['日本株', '米国株', '投資信託', '債券', '不動産', 'その他', '未分類'];

// --- Main App Component ---
function App() {
  // --- State Management ---
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [allocations, setAllocations] = useState<TargetAllocation[]>([]);
  const [livePrices, setLivePrices] = useState<{[stockId: number]: number}>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // --- Data Fetching ---
  const fetchStocks = useCallback(async () => {
    try {
      const response = await axios.get<Stock[]>(`${API_URL}/stocks/`);
      let fetchedStocks = response.data;

      // Process stocks to ensure name and category are set
      const updatedStocksPromises = fetchedStocks.map(async (stock) => {
        let needsUpdate = false;
        let updatedStock = { ...stock };

        // Check and set name
        if (!updatedStock.name || updatedStock.name === "不明な銘柄") {
          try {
            const nameResponse = await axios.get(`${API_URL}/stocks/name/${stock.ticker}`);
            updatedStock.name = nameResponse.data.name;
            needsUpdate = true;
          } catch (error) {
            console.error(`Error fetching name for ${stock.ticker}:`, error);
            updatedStock.name = "不明な銘柄"; // Keep default if fetch fails
          }
        }

        // Check and set category (simple heuristic, same as backend)
        if (!updatedStock.category || updatedStock.category === "未分類") {
          // Check if ticker consists only of digits
          const isJapaneseStock = /^\d+$/.test(stock.ticker);
          if (isJapaneseStock) {
            updatedStock.category = "日本株";
          } else {
            updatedStock.category = "米国株";
          }
          needsUpdate = true;
        }

        // If stock was updated, send update to backend
        if (needsUpdate) {
          try {
            // The backend update_stock expects schemas.StockUpdate
            // which includes ticker, name, quantity, acquisition_price, category
            await axios.put(`${API_URL}/stocks/${updatedStock.id}`, updatedStock);
          } catch (error) {
            console.error(`Error updating stock ${updatedStock.id} in backend:`, error);
          }
        }
        return updatedStock; // Return the potentially updated stock for local state
      });

      // Wait for all updates to complete and update local state
      const finalStocks = await Promise.all(updatedStocksPromises);
      setStocks(finalStocks); // Update state with potentially corrected stocks

    } catch (error) {
      console.error("Error fetching stocks:", error);
    }
  }, []);

  const fetchAllocations = useCallback(async () => {
    try {
      const response = await axios.get<TargetAllocation[]>(`${API_URL}/allocations/`);
      setAllocations(response.data);
    } catch (error) {
      console.error("Error fetching allocations:", error);
    }
  }, []);

  const handleRefreshPrices = useCallback(async () => {
    setIsLoadingPrices(true);
    try {
      const response = await axios.get<{[stockId: number]: number}>(`${API_URL}/stocks/live-prices`);
      setLivePrices(response.data);
    } catch (error) {
      console.error("Error fetching live prices:", error);
      // Don't show alert on auto-refresh to avoid being annoying
    }
    setIsLoadingPrices(false);
  }, []);

  useEffect(() => {
    fetchStocks();
    fetchAllocations();
    handleRefreshPrices(); // Initial fetch

    const intervalId = setInterval(handleRefreshPrices, REFRESH_INTERVAL);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchStocks, fetchAllocations, handleRefreshPrices]);

  // --- Memoized Calculations (still in App.tsx as they depend on central state) ---
  const pieChartData = useMemo(() => {
    const categoryTotals = new Map<string, number>();
    stocks.forEach(stock => {
      const livePrice = livePrices[stock.id];
      const value = livePrice ? livePrice * stock.quantity : stock.quantity * stock.acquisition_price;
      categoryTotals.set(stock.category, (categoryTotals.get(stock.category) || 0) + value);
    });
    return Array.from(categoryTotals.entries()).map(([name, value]) => ({ name, value }));
  }, [stocks, livePrices]);

  const currentAllocation = useMemo<Map<string, number>>(() => {
    const categoryTotals = new Map<string, number>();
    let totalPortfolioValue = 0;

    stocks.forEach(stock => {
      const livePrice = livePrices[stock.id];
      const value = livePrice ? livePrice * stock.quantity : stock.quantity * stock.acquisition_price;
      totalPortfolioValue += value;
      categoryTotals.set(stock.category, (categoryTotals.get(stock.category) || 0) + value);
    });

    if (totalPortfolioValue === 0) return new Map();

    const categoryPercentages = new Map<string, number>();
    for (const [category, total] of categoryTotals.entries()) {
      categoryPercentages.set(category, (total / totalPortfolioValue) * 100);
    }
    return categoryPercentages;
  }, [stocks, livePrices]);

  const combinedAllocationData = useMemo<CombinedAllocation[]>(() => {
    const allCategories = new Set([...currentAllocation.keys(), ...allocations.map(a => a.category)]);
    
    return Array.from(allCategories).map(category => ({
      category,
      currentPercentage: currentAllocation.get(category) || 0,
      targetPercentage: allocations.find(a => a.category === category)?.percentage || 0,
    })).sort((a, b) => b.currentPercentage - a.currentPercentage);
  }, [currentAllocation, allocations]);

  const availableCategories = useMemo(() => {
    const categories = new Set(DEFAULT_CATEGORIES);
    stocks.forEach(stock => categories.add(stock.category));
    allocations.forEach(alloc => categories.add(alloc.category));
    return Array.from(categories).sort();
  }, [stocks, allocations]);

  // --- JSX ---
  return (
    <BrowserRouter>
      <div className="App">
        <h1>ポートフォリオ管理</h1>
        <NavBar />

        <Routes>
          <Route path="/add-stock" element={<StockFormPage fetchStocks={fetchStocks} />} />
          <Route path="/asset-composition" element={<AssetCompositionPage stocks={stocks} livePrices={livePrices} />} />
          <Route path="/asset-allocation" element={<AssetAllocationPage stocks={stocks} allocations={allocations} livePrices={livePrices} fetchAllocations={fetchAllocations} />} />
          <Route path="/stock-list" element={<StockListPage stocks={stocks} livePrices={livePrices} isLoadingPrices={isLoadingPrices} handleRefreshPrices={handleRefreshPrices} fetchStocks={fetchStocks} availableCategories={availableCategories} />} />
          <Route path="/strategies" element={<StrategyPage />} /> {/* New Route for StrategyPage */}
          <Route path="/stocks/:stockId" element={<StockDetailPage />} /> {/* New Route for StockDetailPage */}
          {/* Redirect to a default page or show a home page */}
          {/* Redirect to a default page or show a home page */}
          <Route path="/" element={<StockListPage stocks={stocks} livePrices={livePrices} isLoadingPrices={isLoadingPrices} handleRefreshPrices={handleRefreshPrices} fetchStocks={fetchStocks} availableCategories={availableCategories} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;