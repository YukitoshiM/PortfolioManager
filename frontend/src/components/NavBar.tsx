import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavBar: React.FC = () => {
  const location = useLocation();

  return (
    <nav>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '1rem', borderBottom: '1px solid #ccc', marginBottom: '1rem' }}>
        <li><Link to="/add-stock" className={`tab-button ${location.pathname === '/add-stock' ? 'active' : ''}`}>銘柄追加</Link></li>
        <li><Link to="/asset-composition" className={`tab-button ${location.pathname === '/asset-composition' ? 'active' : ''}`}>資産構成</Link></li>
        <li><Link to="/asset-allocation" className={`tab-button ${location.pathname === '/asset-allocation' ? 'active' : ''}`}>アセットアロケーション</Link></li>
        <li><Link to="/stock-list" className={`tab-button ${location.pathname === '/stock-list' ? 'active' : ''}`}>保有銘柄一覧</Link></li>
        <li><Link to="/strategies" className={`tab-button ${location.pathname === '/strategies' ? 'active' : ''}`}>戦略管理</Link></li> {/* New link */}
      </ul>
    </nav>
  );
};

export default NavBar;