import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

interface Strategy {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null; // Add parent_id
}

const StrategyPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [newStrategyDescription, setNewStrategyDescription] = useState('');
  const [newStrategyParentId, setNewStrategyParentId] = useState<number | null>(null); // New state for parent_id
  const [editingStrategyId, setEditingStrategyId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Strategy>>({});

  const fetchStrategies = useCallback(async () => {
    try {
      // Fetch all strategies to build the hierarchy
      const response = await axios.get<Strategy[]>(`${API_URL}/strategies/?limit=1000`); // Fetch more to ensure all are loaded
      setStrategies(response.data);
    } catch (error) {
      console.error("Error fetching strategies:", error);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  const handleCreateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStrategyName) {
      alert('戦略名を入力してください。');
      return;
    }
    try {
      await axios.post(`${API_URL}/strategies/`, { 
        name: newStrategyName, 
        description: newStrategyDescription || null,
        parent_id: newStrategyParentId // Include parent_id
      });
      setNewStrategyName('');
      setNewStrategyDescription('');
      setNewStrategyParentId(null); // Reset parent_id
      fetchStrategies();
    } catch (error) {
      console.error("Error creating strategy:", error);
      if (axios.isAxiosError(error) && error.response && error.response.data && error.response.data.detail) {
        alert(`戦略の作成に失敗しました: ${error.response.data.detail}`);
      } else {
        alert('戦略の作成に失敗しました。');
      }
    }
  };

  const handleEditClick = (strategy: Strategy) => {
    setEditingStrategyId(strategy.id);
    setEditFormData(strategy);
  };

  const handleCancelClick = () => {
    setEditingStrategyId(null);
    setEditFormData({});
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ 
      ...prev, 
      [name]: name === 'parent_id' && value === '' ? null : value === '' ? '' : value // Handle parent_id as null for empty string
    }));
  };

  const handleUpdateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStrategyId) return;
    if (!editFormData.name) {
      alert('戦略名を入力してください。');
      return;
    }
    try {
      await axios.put(`${API_URL}/strategies/${editingStrategyId}`, {
        name: editFormData.name,
        description: editFormData.description || null,
        parent_id: editFormData.parent_id === undefined ? null : editFormData.parent_id // Ensure parent_id is null if undefined
      });
      setEditingStrategyId(null);
      setEditFormData({});
      fetchStrategies();
    } catch (error) {
      console.error("Error updating strategy:", error);
      alert('戦略の更新に失敗しました。');
    }
  };

  const handleDeleteStrategy = async (strategyId: number) => {
    if (window.confirm('この戦略を削除してもよろしいですか？')) {
      try {
        await axios.delete(`${API_URL}/strategies/${strategyId}`);
        fetchStrategies();
      } catch (error) {
        console.error("Error deleting strategy:", error);
        alert('戦略の削除に失敗しました。');
      }
    }
  };

  // Function to render strategies hierarchically
  const renderStrategies = (strategyList: Strategy[], parentId: number | null = null, indent: number = 0) => {
    const children = strategyList.filter(s => s.parent_id === parentId);
    return children.map(strategy => (
      <React.Fragment key={strategy.id}>
        {editingStrategyId === strategy.id ? (
          <tr style={{ marginLeft: `${indent * 20}px` }}>
            <td>{strategy.id}</td>
            <td><input type="text" name="name" value={editFormData.name} onChange={handleEditFormChange} required /></td>
            <td><textarea name="description" value={editFormData.description || ''} onChange={handleEditFormChange} rows={2}></textarea></td>
            <td>
              <select name="parent_id" value={editFormData.parent_id || ''} onChange={handleEditFormChange}>
                <option value="">なし (トップレベル)</option>
                {strategies.filter(s => s.id !== strategy.id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </td>
            <td>
              <button type="button" onClick={handleUpdateStrategy}>保存</button>
              <button type="button" onClick={handleCancelClick}>キャンセル</button>
            </td>
          </tr>
        ) : (
          <tr style={{ marginLeft: `${indent * 20}px` }}>
            <td>{strategy.id}</td>
            <td>{'--'.repeat(indent)}{strategy.name}</td>
            <td>{strategy.description}</td>
            <td>{strategy.parent_id ? strategies.find(s => s.id === strategy.parent_id)?.name : 'なし'}</td>
            <td>
              <button type="button" onClick={() => handleEditClick(strategy)}>編集</button>
              <button type="button" onClick={() => handleDeleteStrategy(strategy.id)}>削除</button>
            </td>
          </tr>
        )}
        {renderStrategies(strategyList, strategy.id, indent + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div>
      <h2>戦略管理</h2>

      <h3>新しい戦略を作成</h3>
      <form onSubmit={handleCreateStrategy}>
        <div>
          <label>戦略名:</label>
          <input type="text" value={newStrategyName} onChange={e => setNewStrategyName(e.target.value)} required />
        </div>
        <div>
          <label>説明 (任意):</label>
          <textarea value={newStrategyDescription} onChange={e => setNewStrategyDescription(e.target.value)} rows={3}></textarea>
        </div>
        <div>
          <label>親戦略:</label>
          <select value={newStrategyParentId || ''} onChange={e => setNewStrategyParentId(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">なし (トップレベル)</option>
            {strategies.map(strategy => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
          </select>
        </div>
        <button type="submit">作成</button>
      </form>

      <h3>既存の戦略</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>戦略名</th>
            <th>説明</th>
            <th>親戦略</th> {/* New column for parent strategy */}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {renderStrategies(strategies, null, 0)}
        </tbody>
      </table>
    </div>
  );
};

export default StrategyPage;