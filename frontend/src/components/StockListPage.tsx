import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom'; // Import Link

const API_URL = 'http://127.0.0.1:8000';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  acquisition_price: number;
  category: string;
  strategies: Strategy[]; // Add strategies to Stock interface
}

interface Strategy {
  id: number;
  name: string;
  description: string | null; // Add description and parent_id
  parent_id: number | null;
}

interface StockListPageProps {
  stocks: Stock[];
  livePrices: { [stockId: number]: number };
  isLoadingPrices: boolean;
  handleRefreshPrices: () => void;
  fetchStocks: () => void;
  availableCategories: string[]; // Pass availableCategories from App.tsx
}

const StockListPage: React.FC<StockListPageProps> = ({ stocks, livePrices, isLoadingPrices, handleRefreshPrices, fetchStocks, availableCategories }) => {
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Stock>>({});
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]); // State to hold all available strategies
  const [selectedFilterStrategyId, setSelectedFilterStrategyId] = useState<number | null>(null); // New state for filter

  // New state for editing form
  const [editingSelectedParentStrategyIds, setEditingSelectedParentStrategyIds] = useState<number[]>([]);
  const [editingSelectedChildStrategyIds, setEditingSelectedChildStrategyIds] = useState<number[]>([]);

  // Fetch all strategies when component mounts
  useEffect(() => {
    const fetchAllStrategies = async () => {
      try {
        const response = await axios.get<Strategy[]>(`${API_URL}/strategies/?limit=1000`);
        setAllStrategies(response.data);
      } catch (error) {
        console.error("Error fetching all strategies:", error);
      }
    };
    fetchAllStrategies();
  }, []);

  const handleStockDelete = async (stockId: number) => {
    if (window.confirm('この銘柄を削除してもよろしいですか？')) {
      try {
        await axios.delete(`${API_URL}/stocks/${stockId}`);
        fetchStocks();
      } catch (error) {
        console.error("Error deleting stock:", error);
        alert('銘柄の削除に失敗しました。');
      }
    }
  };

  const handleEditClick = (stock: Stock) => {
    setEditingStockId(stock.id);
    // Populate editFormData with current stock data
    setEditFormData({ ...stock });

    // Separate existing strategies into parent and child for editing form
    const currentParentStrategyIds = stock.strategies.filter(s => s.parent_id === null).map(s => s.id);
    const currentChildStrategyIds = stock.strategies.filter(s => s.parent_id !== null).map(s => s.id);
    setEditingSelectedParentStrategyIds(currentParentStrategyIds);
    setEditingSelectedChildStrategyIds(currentChildStrategyIds);
  };

  const handleCancelClick = () => {
    setEditingStockId(null);
    setEditFormData({});
    setEditingSelectedParentStrategyIds([]); // Reset
    setEditingSelectedChildStrategyIds([]); // Reset
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditingParentStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions);
    const ids = options.map(option => parseInt(option.value));
    setEditingSelectedParentStrategyIds(ids);
    // Clear child selections if their parent is no longer selected
    setEditingSelectedChildStrategyIds(prev => prev.filter(childId => {
      const childStrategy = allStrategies.find(s => s.id === childId);
      return childStrategy && ids.includes(childStrategy.parent_id!); // Ensure parent_id is not null
    }));
  };

  const handleEditingChildStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions);
    const ids = options.map(option => parseInt(option.value));
    setEditingSelectedChildStrategyIds(ids);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockId) return;

    // Frontend validation: Ensure selected child strategies have their parents selected
    for (const childId of editingSelectedChildStrategyIds) {
      const childStrategy = allStrategies.find(s => s.id === childId);
      if (childStrategy && childStrategy.parent_id !== null && !editingSelectedParentStrategyIds.includes(childStrategy.parent_id)) {
        alert('選択された子戦略の親戦略が選択されていません。');
        return;
      }
    }

    try {
      const allSelectedStrategyIds = [...new Set([...editingSelectedParentStrategyIds, ...editingSelectedChildStrategyIds])];

      const updatedStock = {
        ...editFormData,
        quantity: parseInt(String(editFormData.quantity), 10),
        acquisition_price: parseFloat(String(editFormData.acquisition_price)),
        strategy_ids: allSelectedStrategyIds, // Use combined IDs
      };
      await axios.put(`${API_URL}/stocks/${editingStockId}`, updatedStock);
      setEditingStockId(null);
      setEditFormData({});
      setEditingSelectedParentStrategyIds([]); // Reset
      setEditingSelectedChildStrategyIds([]); // Reset
      fetchStocks();
    } catch (error) {
      console.error("Error updating stock:", error);
      alert('銘柄の更新に失敗しました。');
    }
  };

  // Filter stocks based on selectedFilterStrategyId
  const filteredStocks = selectedFilterStrategyId
    ? stocks.filter(stock => stock.strategies.some(s => s.id === selectedFilterStrategyId))
    : stocks;

  // Calculate total profit/loss for filtered stocks
  const totalProfitLoss = useMemo(() => {
    return filteredStocks.reduce((sum, stock) => {
      const livePrice = livePrices[stock.id];
      const marketValue = livePrice !== undefined ? livePrice * stock.quantity : null;
      const profitLoss = marketValue !== null ? marketValue - (stock.acquisition_price * stock.quantity) : null;
      return sum + (profitLoss || 0);
    }, 0);
  }, [filteredStocks, livePrices]);

  const totalProfitLossStyle = totalProfitLoss > 0 ? { color: 'green', fontWeight: 'bold' } : totalProfitLoss < 0 ? { color: 'red', fontWeight: 'bold' } : { fontWeight: 'bold' };


  return (
    <div>
      <h2>保有銘柄一覧</h2>
      <div style={{marginBottom: '1rem'}}>
        <button onClick={() => handleRefreshPrices()} disabled={isLoadingPrices}>
          {isLoadingPrices ? '価格を取得中...' : '手動で価格を更新'}
        </button>
        <span style={{marginLeft: '1rem', fontStyle: 'italic'}}>（60秒ごとに自動更新されます）</span>
      </div>

      {/* Strategy Filter */}
      <div style={{marginBottom: '1rem'}}>
        <label>戦略でフィルタリング:</label>
        <select onChange={e => setSelectedFilterStrategyId(e.target.value ? parseInt(e.target.value) : null)}>
          <option value="">すべての戦略</option>
          {allStrategies.map(strategy => (
            <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
          ))}
        </select>
      </div>

      {/* Total Profit/Loss Display */}
      <div style={{marginBottom: '1rem', fontSize: '1.2em'}}>
        合計評価損益: <span style={totalProfitLossStyle}>{totalProfitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}円</span>
      </div>

      <form onSubmit={handleUpdateSubmit}>
        <table>
          <thead>
            <tr>
              <th>銘柄コード</th>
              <th>銘柄名</th>
              <th>カテゴリー</th>
              <th>戦略</th> {/* New column for strategies */}
              <th>株数</th>
              <th>取得単価</th>
              <th>現在値</th>
              <th>評価額</th>
              <th>評価損益</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.map((stock) => {
              const livePrice = livePrices[stock.id];
              const marketValue = livePrice !== undefined ? livePrice * stock.quantity : null;
              const profitLoss = marketValue !== null ? marketValue - (stock.acquisition_price * stock.quantity) : null;
              const profitLossStyle = profitLoss !== null ? (profitLoss > 0 ? { color: 'green' } : profitLoss < 0 ? { color: 'red' } : {}) : {};

              return (
                <React.Fragment key={stock.id}>
                  {editingStockId === stock.id ? (
                    // Editing Row
                    <tr>
                      <td><input type="text" name="ticker" value={editFormData.ticker} onChange={handleEditFormChange} required /></td>
                      <td><input type="text" name="name" value={editFormData.name} onChange={handleEditFormChange} required /></td>
                      <td>
                        <select name="category" value={editFormData.category} onChange={handleEditFormChange}>
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {/* Parent Strategies Select */}
                        <div>
                          <label>親戦略:</label>
                          <select multiple value={editingSelectedParentStrategyIds.map(String)} onChange={handleEditingParentStrategyChange}>
                            {allStrategies.filter(s => s.parent_id === null).map(strategy => (
                              <option key={strategy.id} value={strategy.id}>
                                {strategy.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Child Strategies Select */}
                        <div>
                          <label>子戦略:</label>
                          {editingSelectedParentStrategyIds.length === 0 ? (
                            <p>親戦略を選択すると、関連する子戦略が表示されます。</p>
                          ) : (
                            <select multiple value={editingSelectedChildStrategyIds.map(String)} onChange={handleEditingChildStrategyChange}>
                              {allStrategies.filter(s => s.parent_id !== null && editingSelectedParentStrategyIds.includes(s.parent_id!)).length === 0 ? (
                                <option disabled>選択された親戦略に子戦略はありません。</option>
                              ) : (
                                allStrategies.filter(s => s.parent_id !== null && editingSelectedParentStrategyIds.includes(s.parent_id!)).map(strategy => (
                                  <option key={strategy.id} value={strategy.id}>
                                    {strategy.name} ({allStrategies.find(s => s.id === strategy.parent_id)?.name})
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                      </td>
                      <td><input type="number" name="quantity" value={editFormData.quantity} onChange={handleEditFormChange} required /></td>
                      <td><input type="number" step="any" name="acquisition_price" value={editFormData.acquisition_price} onChange={handleEditFormChange} required /></td>
                      <td colSpan={3}>編集中</td>
                      <td>
                        <button type="submit">保存</button>
                        <button type="button" onClick={handleCancelClick}>キャンセル</button>
                      </td>
                    </tr>
                  ) : (
                    // Normal Row
                    <tr>
                      <td><Link to={`/stocks/${stock.ticker}`}>{stock.ticker}</Link></td>
                      <td>{stock.name}</td>
                      <td>{stock.category}</td>
                      <td>{stock.strategies.map(s => s.name).join(', ')}</td> {/* Display strategy names */}
                      <td>{stock.quantity.toLocaleString()}</td>
                      <td>{stock.acquisition_price.toLocaleString()}</td>
                      <td>{livePrice !== undefined ? livePrice.toLocaleString() : '-'}</td>
                      <td>{marketValue !== null ? marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>
                      <td style={profitLossStyle}>{profitLoss !== null ? profitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>
                      <td>
                        <button type="button" onClick={() => handleEditClick(stock)}>編集</button>
                        <button type="button" onClick={() => handleStockDelete(stock.id)}>削除</button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </form>
    </div>
  );
};

export default StockListPage;