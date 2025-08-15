import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stock {
  id: number;
  ticker: string;
  name: string;
  quantity: number;
  acquisition_price: number;
  category: string;
}

interface AssetCompositionPageProps {
  stocks: Stock[];
  livePrices: { [stockId: number]: number };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#da84d8'];

const AssetCompositionPage: React.FC<AssetCompositionPageProps> = ({ stocks, livePrices }) => {
  const pieChartData = React.useMemo(() => {
    const categoryTotals = new Map<string, number>();
    stocks.forEach(stock => {
      const livePrice = livePrices[stock.id];
      const value = livePrice ? livePrice * stock.quantity : stock.quantity * stock.acquisition_price;
      categoryTotals.set(stock.category, (categoryTotals.get(stock.category) || 0) + value);
    });
    return Array.from(categoryTotals.entries()).map(([name, value]) => ({ name, value }));
  }, [stocks, livePrices]);

  return (
    <div>
      <h2>資産構成（現状）</h2>
      {pieChartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
              {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: number) => `${value.toLocaleString()}円`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : <p>銘柄を登録するとグラフが表示されます。</p>}
    </div>
  );
};

export default AssetCompositionPage;