import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Search, Filter, Home, Globe } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const TreeNode = React.memo(({ node, level = 0, onSelect, selectedKey, expandAll }) => {
  const [isExpanded, setIsExpanded] = useState(level < 1 || expandAll);
  
  useEffect(() => {
    if (expandAll) setIsExpanded(true);
  }, [expandAll]);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedKey === node.key;

  return (
    <div className="select-none relative">
      {/* Visual branch line */}
      {level > 0 && (
        <div 
          className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-200"
          style={{ left: `${(level - 1) * 16 + 15}px` }}
        />
      )}
      
      <div 
        className={`flex items-center py-1.5 px-2 rounded-lg transition-colors relative z-10 ${
          isSelected ? 'bg-vnpost-orange/10 text-vnpost-orange font-bold shadow-sm' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Horizontal branch line connector */}
        {level > 0 && (
          <div 
            className="absolute h-px bg-gray-200"
            style={{ 
              left: `${(level - 1) * 16 + 15}px`, 
              width: '12px',
              top: '50%'
            }}
          />
        )}

        <span 
          className="mr-1.5 p-1 hover:bg-gray-200 rounded-md cursor-pointer text-gray-400 transition-all z-20 bg-white"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsExpanded(!isExpanded);
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} />
          ) : (
            <div className="w-[14px]" />
          )}
        </span>
        
        <div 
          className="flex-1 flex items-center cursor-pointer"
          onClick={() => onSelect(node)}
        >
          <span className="mr-2">
            {(node.type === 'UNIT' || node.type === 'BRANCH' || node.type === 'ROOT') && <Home size={16} className="text-vnpost-blue" />}
            {node.type === 'CLUSTER' && <Folder size={16} className="text-vnpost-orange" />}
            {(node.type === 'BDPX' || node.type === 'WARD') && <Globe size={16} className="text-emerald-500" />}
            {node.type === 'POINT' && <FileText size={16} className="text-blue-400" />}
          </span>
          
          <span className="text-sm truncate">{node.title}</span>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="relative">
          {node.children.map(child => (
            <TreeNode 
              key={child.key} 
              node={child} 
              level={level + 1} 
              onSelect={onSelect} 
              selectedKey={selectedKey}
              expandAll={expandAll}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function TreeExplorer({ onSelect, selectedNode }) {
  const { user } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    setLoading(true);
    api.get('/api/nodes/tree')
      .then(res => {
        setTreeData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching tree:", err);
        setLoading(false);
      });
  }, [user]);

  const filterTree = useCallback((nodes, term) => {
    if (!term) return nodes;
    return nodes.map(node => {
      const children = filterTree(node.children || [], term);
      const matches = node.title.toLowerCase().includes(term.toLowerCase());
      if (matches || children.length > 0) {
        return { ...node, children };
      }
      return null;
    }).filter(Boolean);
  }, []);

  const visibleTree = useMemo(() => filterTree(treeData, searchTerm), [treeData, searchTerm, filterTree]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-vnpost-blue" />
          <h3 className="font-bold text-vnpost-blue text-sm uppercase tracking-wider">Phạm vi Dữ liệu</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Tìm đơn vị/cụm/đầu mối..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vnpost-blue/20 transition-all"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
        {loading ? (
          <div className="p-3 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center space-x-3" style={{ marginLeft: `${(i % 3) * 16}px` }}>
                <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              </div>
            ))}
          </div>
        ) : visibleTree.length > 0 ? (
          <>
            <div 
              className={`flex items-center py-2 px-3 rounded-xl cursor-pointer transition-all mb-2 ${
                !selectedNode ? 'bg-vnpost-blue text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'
              }`}
              onClick={() => onSelect(null)}
            >
              <span className="mr-3">
                <Globe size={18} className={!selectedNode ? 'text-white' : 'text-vnpost-blue'} />
              </span>
              <span className="text-sm font-black uppercase tracking-tight truncate">
                {user?.scope || "Toàn tỉnh"}
              </span>
            </div>
            {visibleTree.map(node => (
              <TreeNode 
                key={node.key} 
                node={node} 
                onSelect={onSelect} 
                selectedKey={selectedNode?.key}
                expandAll={!!searchTerm}
              />
            ))}
          </>
        ) : (
          <div className="text-center py-12 flex flex-col items-center justify-center text-gray-400">
            <Folder size={32} className="mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Không tìm thấy đơn vị</p>
            <p className="text-xs mt-1">Thử lại với từ khóa khác</p>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="p-3 bg-vnpost-blue text-white text-[10px] items-center flex justify-between shadow-inner">
            <span className="font-bold truncate pr-2">Đang xem: {selectedNode.title}</span>
            <button 
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded font-bold uppercase tracking-wider transition-colors shrink-0"
              onClick={() => onSelect(null)}
            >
              Xóa lọc
            </button>
        </div>
      )}
    </div>
  );
}
