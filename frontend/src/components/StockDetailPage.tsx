import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

interface CompanyProfile {
  ticker: string;
  name: string;
  marketCapitalization: number;
}

interface FinancialMetrics {
  peRatio: number;
  pbRatio: number;
  dividendYield: number;
  '10DayAverageTradingVolume': number;
  '52WeekHigh': number;
  '52WeekLow': number;
}

interface NewsArticle {
  headline: string;
  url: string;
  datetime: number; // Unix timestamp
  source: string;
}

interface QuoteData {
    c: number; // Current price
    d: number | null; // Change
    dp: number | null; // Percent change
    h: number; // High price of the day
    l: number; // Low price of the day
    o: number; // Open price of the day
    pc: number; // Previous close price
}

const StockDetailPage: React.FC = () => {
  const { stockId } = useParams<{ stockId: string }>();
  const ticker = stockId;

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<string | null>(null);
  const [newsCurrentPage, setNewsCurrentPage] = useState(1);
  const newsPerPage = 10;

  useEffect(() => {
    const fetchStockDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const [quoteRes, profileRes, metricsRes, newsRes] = await Promise.all([
          axios.get<QuoteData>(`${API_URL}/stocks/live-prices/${ticker}`),
          axios.get<CompanyProfile>(`${API_URL}/stocks/${ticker}/profile`),
          axios.get<FinancialMetrics>(`${API_URL}/stocks/${ticker}/metrics`),
          axios.get<NewsArticle[]>(`${API_URL}/stocks/${ticker}/news?_from=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`)
        ]);

        setQuoteData(quoteRes.data);
        setProfile(profileRes.data);
        setMetrics(metricsRes.data);
        setNews(newsRes.data);

      } catch (err: any) {
        setError(`Failed to fetch stock details: ${err.message}`);
        console.error("Error fetching stock details:", err);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchStockDetails();
    }
  }, [ticker]);

  const renderExplanationDialog = () => {
    if (!showExplanation) return null;

    let title = '';
    let content = '';

    switch (showExplanation) {
      case 'PER':
        title = 'PER (Price-to-Earnings Ratio)';
        content = '株価収益率。株価が1株当たり純利益の何倍まで買われているかを示す指標で、企業の収益力に対して株価が割安か割高かを判断する目安となります。';
        break;
      case 'PBR':
        title = 'PBR (Price-to-Book Ratio)';
        content = '株価純資産倍率。株価が1株当たり純資産の何倍まで買われているかを示す指標で、企業の資産に対して株価が割安か割高かを判断する目安となります。';
        break;
      case 'DividendYield':
        title = '配当利回り (Dividend Yield)';
        content = '1株当たり年間配当金を現在の株価で割ったもので、投資額に対してどれだけの配当が得られるかを示す指標です。';
        break;
      case 'MarketCap':
        title = '時価総額 (Market Capitalization)';
        content = '発行済み株式数に現在の株価を掛け合わせたもので、企業の規模を示す指標です。';
        break;
      case '52WeekHigh':
        title = '52週高値 (52-Week High)';
        content = '過去52週間（約1年間）で記録した最も高い株価です。';
        break;
      case '52WeekLow':
        title = '52週安値 (52-Week Low)';
        content = '過去52週間（約1年間）で記録した最も低い株価です。';
        break;
      case 'Volume':
        title = '出来高 (Volume)';
        content = '売買が成立した株数のことで、通常は1日単位で集計されます。これは市場の関心度や取引の活発さを示す指標です。ここでは10日間の平均出来高を表示しています。';
        break;
      default:
        break;
    }

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-auto">
          <h3 className="text-lg font-bold mb-4">{title}</h3>
          <p className="text-gray-700 mb-4">{content}</p>
          <button
            onClick={() => setShowExplanation(null)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-center py-4">Loading stock details...</div>;
  if (error) return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  if (!profile) return <div className="text-center py-4">No stock details found for {ticker}.</div>;

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1_000_000_000_000) {
      return `$${(marketCap / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (marketCap >= 1_000_000_000) {
      return `$${(marketCap / 1_000_000_000).toFixed(2)}B`;
    }
    if (marketCap >= 1_000_000) {
      return `$${(marketCap / 1_000_000).toFixed(2)}M`;
    }
    return `$${marketCap.toFixed(2)}`;
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">{profile.name} ({profile.ticker})</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-3">主要指標</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead>
                <tr>
                  <th className="py-2 px-4 border text-left text-gray-600 font-semibold">指標</th>
                  <th className="py-2 px-4 border text-left text-gray-600 font-semibold">値</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 px-4 border">株価</td>
                  <td className="py-2 px-4 border">{quoteData ? `$${quoteData.c.toFixed(2)}` : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border">前日比</td>
                  <td className="py-2 px-4 border">
                    {quoteData && quoteData.d !== null && quoteData.dp !== null ? (
                      <span className={quoteData.d >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {quoteData.d.toFixed(2)} ({quoteData.dp.toFixed(2)}%)
                      </span>
                    ) : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('PER')}>PER</td>
                  <td className="py-2 px-4 border">{metrics?.peTTM ? metrics.peTTM.toFixed(2) : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('PBR')}>PBR</td>
                  <td className="py-2 px-4 border">{metrics?.pb ? metrics.pb.toFixed(2) : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('DividendYield')}>配当利回り</td>
                  <td className="py-2 px-4 border">{metrics?.currentDividendYieldTTM ? `${(metrics.currentDividendYieldTTM).toFixed(2)}%` : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('MarketCap')}>時価総額</td>
                  <td className="py-2 px-4 border">{profile.marketCapitalization ? formatMarketCap(profile.marketCapitalization) : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('Volume')}>出来高 (10日平均)</td>
                  <td className="py-2 px-4 border">{metrics?.['10DayAverageTradingVolume'] ? `${metrics['10DayAverageTradingVolume'].toLocaleString()} shares` : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('52WeekHigh')}>52週高値</td>
                  <td className="py-2 px-4 border">{metrics?.['52WeekHigh'] ? `$${metrics['52WeekHigh'].toFixed(2)}` : 'N/A'}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 border cursor-pointer hover:text-blue-600" onClick={() => setShowExplanation('52WeekLow')}>52週安値</td>
                  <td className="py-2 px-4 border">{metrics?.['52WeekLow'] ? `${metrics['52WeekLow'].toFixed(2)}` : 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-3">関連ニュース</h3>
          {news.length > 0 ? (
            <div>
              <ul>
                {news.slice((newsCurrentPage - 1) * newsPerPage, newsCurrentPage * newsPerPage).map((article, index) => (
                  <li key={index} className="mb-2">
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {new Date(article.datetime * 1000).toLocaleDateString()}: {article.headline} ({article.source})
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setNewsCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={newsCurrentPage === 1}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  前へ
                </button>
                <span>
                  ページ {newsCurrentPage} / {Math.ceil(news.length / newsPerPage)}
                </span>
                <button
                  onClick={() => setNewsCurrentPage(prev => Math.min(prev + 1, Math.ceil(news.length / newsPerPage)))}
                  disabled={newsCurrentPage === Math.ceil(news.length / newsPerPage)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
            </div>
          ) : (
            <p>関連ニュースはありません。</p>
          )}
        </div>
      </div>

      {renderExplanationDialog()}
    </div>
  );
};

export default StockDetailPage;
