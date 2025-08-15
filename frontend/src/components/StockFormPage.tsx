import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

interface StockFormPageProps {
  fetchStocks: () => void;
}

const StockFormPage: React.FC<StockFormPageProps> = ({ fetchStocks }) => {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !quantity || !price) {
      alert('すべての項目を入力してください。');
      return;
    }

    try {
      await axios.post(`${API_URL}/stocks/`, {
        ticker,
        name: '',
        quantity: parseInt(quantity),
        acquisition_price: parseFloat(price),
      });
      setTicker('');
      setQuantity('');
      setPrice('');
      fetchStocks();
    } catch (error) {
      console.error("Error adding stock:", error);
      alert('銘柄の追加に失敗しました。');
    }
  };

  return (
    <div>
      <h2>銘柄追加</h2>
      <form onSubmit={handleStockSubmit}>
        <div><label>銘柄コード:</label><input type="text" value={ticker} onChange={e => setTicker(e.target.value)} /></div>
        <div><label>株数:</label><input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
        <div><label>取得単価:</label><input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} /></div>

        <button type="submit">追加</button>
      </form>
    </div>
  );
};

export default StockFormPage;