import React, { useState, useCallback, useMemo } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  acquisition_price: number;
  category: string;
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

interface AssetAllocationPageProps {
  stocks: Stock[];
  allocations: TargetAllocation[];
  livePrices: { [stockId: number]: number };
  fetchAllocations: () => void;
}

const DEFAULT_CATEGORIES = ['日本株', '米国株', '投資信託', '債券', '不動産', 'その他', '未分類'];

const AssetAllocationPage: React.FC<AssetAllocationPageProps> = ({ stocks, allocations, livePrices, fetchAllocations }) => {
  const [newAllocCategory, setNewAllocCategory] = useState('');
  const [newAllocPercentage, setNewAllocPercentage] = useState('');

  const handleAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllocCategory || !newAllocPercentage) {
      alert('すべての項目を入力してください。');
      return;
    }
    try {
      await axios.post(`${API_URL}/allocations/`, { category: newAllocCategory, percentage: parseFloat(newAllocPercentage) });
      setNewAllocCategory(''); setNewAllocPercentage('');
      fetchAllocations();
    } catch (error) {
      console.error("Error adding allocation:", error);
      alert('目標の追加に失敗しました。');
    }
  };
  
  const handleAllocationDelete = async (category: string) => {
    if (window.confirm(`カテゴリー「${category}」の目標設定を削除しますか？`)) {
      try {
        await axios.delete(`${API_URL}/allocations/${category}`);
        fetchAllocations();
      } catch (error) {
        console.error("Error deleting allocation:", error);
        alert('目標の削除に失敗しました。');
      }
    }
  };

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

  return (
    <div>
      <h2>アセットアロケーション</h2>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3>目標設定</h3>
          <form onSubmit={handleAllocationSubmit}>
            <div><label>カテゴリー:</label><input type="text" value={newAllocCategory} onChange={e => setNewAllocCategory(e.target.value)} /></div>
            <div><label>目標比率(%):</label><input type="number" step="any" value={newAllocPercentage} onChange={e => setNewAllocPercentage(e.target.value)} /></div>
            <button type="submit">設定</button>
          </form>
          <table>
            <thead><tr><th>カテゴリー</th><th>目標比率</th><th></th></tr></thead>
            <tbody>
              {allocations.map(alloc => (
                <tr key={alloc.category}>
                  <td>{alloc.category}</td>
                  <td>{alloc.percentage}%</td>
                  <td><button type="button" onClick={() => handleAllocationDelete(alloc.category)}>削除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, minWidth: '400px' }}>
          <h3>比較（現状 vs 目標）</h3>
          <table>
            <thead><tr><th>カテゴリー</th><th>現状 (%)</th><th>目標 (%)</th><th>乖離 (%)</th></tr></thead>
            <tbody>
              {combinedAllocationData.map(data => {
                const difference = data.currentPercentage - data.targetPercentage;
                const diffStyle = difference > 0 ? { color: 'blue' } : difference < 0 ? { color: 'red' } : {};
                return (
                  <tr key={data.category}>
                    <td>{data.category}</td>
                    <td>{data.currentPercentage.toFixed(2)}</td>
                    <td>{data.targetPercentage.toFixed(2)}</td>
                    <td style={diffStyle}>{difference.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AssetAllocationPage;