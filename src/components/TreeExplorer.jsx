import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Search, Filter, Home, Globe } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const TreeNode = ({ node, level = 0, onSelect, selectedKey }) => {
  const [isExpanded, setIsExpanded] = useState(level < 1); // Expand first level by default
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedKey === node.key;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-1.5 px-2 rounded-lg transition-colors ${
          isSelected ? 'bg-vnpost-orange/10 text-vnpost-orange font-bold' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <span 
          className="mr-1.5 p-1 hover:bg-gray-200 rounded-md cursor-pointer text-gray-400 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsExpanded(!isExpanded);
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
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
        <div className="ml-1 border-l border-gray-200">
          {node.children.map(child => (
            <TreeNode 
              key={child.key} 
              node={child} 
              level={level + 1} 
              onSelect={onSelect} 
              selectedKey={selectedKey}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function TreeExplorer({ onSelect, selectedNode }) {
  const { user } = useAuth();
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filterTree = (nodes, term) => {
    if (!term) return nodes;
    return nodes.map(node => {
      const children = filterTree(node.children || [], term);
      const matches = node.title.toLowerCase().includes(term.toLowerCase());
      if (matches || children.length > 0) {
        return { ...node, children };
      }
      return null;
    }).filter(Boolean);
  };

  const visibleTree = filterTree(treeData, searchTerm);

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
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vnpost-blue/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-gray-400 text-sm italic">
            Đang tải cây đơn vị...
          </div>
        ) : visibleTree.length > 0 ? (
          <>
            <div 
              className={`flex items-center py-2 px-3 rounded-xl cursor-pointer transition-all mb-1 ${
                !selectedNode ? 'bg-vnpost-blue text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'
              }`}
              onClick={() => onSelect(null)}
            >
              <span className="mr-3">
                <Globe size={18} className={!selectedNode ? 'text-white' : 'text-vnpost-blue'} />
              </span>
              <span className="text-sm font-black uppercase tracking-tight truncate">
                {user?.scope || "Bưu điện thành phố Huế"}
              </span>
            </div>
            <div className="h-px bg-gray-100 my-2 mx-2" />
            {visibleTree.map(node => (
              <TreeNode 
                key={node.key} 
                node={node} 
                onSelect={onSelect} 
                selectedKey={selectedNode?.key}
              />
            ))}
          </>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            Không tìm thấy kết quả
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="p-3 bg-vnpost-blue text-white text-[10px] items-center flex justify-between">
            <span className="font-bold truncate">Đang xem: {selectedNode.title}</span>
            <button 
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded"
              onClick={() => onSelect(null)}
            >
              Xóa lọc
            </button>
        </div>
      )}
    </div>
  );
}
