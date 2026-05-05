import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Home, Folder, Globe, FileText, Search, X } from 'lucide-react';
import api from '../utils/api';

const TreeNode = ({ node, level = 0, onSelect, selectedId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div 
        className={`flex items-center py-1.5 px-2 cursor-pointer hover:bg-gray-100 rounded-md transition-colors ${
          isSelected ? 'bg-vnpost-blue/10 text-vnpost-blue font-bold' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        <span 
          className="mr-1.5 p-1 hover:bg-gray-200 rounded-md cursor-pointer text-gray-400"
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
        
        <span className="mr-2">
            {(node.type === 'UNIT' || node.type === 'BRANCH' || node.type === 'ROOT') && <Home size={14} className="text-vnpost-blue" />}
            {node.type === 'CLUSTER' && <Folder size={14} className="text-vnpost-orange" />}
            {(node.type === 'BDPX' || node.type === 'WARD') && <Globe size={14} className="text-emerald-500" />}
            {node.type === 'POINT' && <FileText size={14} className="text-blue-400" />}
        </span>
        
        <span className="text-sm truncate">{node.title}</span>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="ml-1 border-l border-gray-100">
          {node.children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              level={level + 1} 
              onSelect={onSelect} 
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function TreeSelect({ value, onChange, placeholder = "Chọn đơn vị...", valueType = "id" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen && treeData.length === 0) {
      setLoading(true);
      api.get('/api/nodes/tree')
        .then(res => {
          setTreeData(res.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  // Find label for current value
  useEffect(() => {
    if (!value) {
        setSelectedLabel('');
        return;
    }
    // Simple flatten to find label
    const findLabel = (nodes) => {
        for (const n of nodes) {
            const nodeVal = valueType === 'id' ? n.id : n.key;
            if (nodeVal === value) return n.title;
            if (n.children) {
                const found = findLabel(n.children);
                if (found) return found;
            }
        }
        return null;
    };
    
    // If tree data is not loaded yet, we might need a separate call or just wait
    if (treeData.length > 0) {
        const label = findLabel(treeData);
        if (label) setSelectedLabel(label);
    }
  }, [value, treeData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (node) => {
    const val = valueType === 'id' ? node.id : node.key;
    onChange(val);
    setSelectedLabel(node.title);
    setIsOpen(false);
  };

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
    <div className="relative" ref={dropdownRef}>
      <div 
        className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white cursor-pointer flex justify-between items-center hover:border-vnpost-blue transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedLabel ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1">
            {value && (
                <X 
                    size={14} 
                    className="text-gray-400 hover:text-red-500 cursor-pointer" 
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(null);
                        setSelectedLabel('');
                    }}
                />
            )}
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-2xl animate-fade-in max-h-[300px] flex flex-col overflow-hidden">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                placeholder="Tìm đơn vị..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-vnpost-blue"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 min-h-[100px]">
            {loading ? (
              <div className="text-center py-4 text-gray-400 text-xs italic">Đang tải...</div>
            ) : visibleTree.length > 0 ? (
              visibleTree.map(node => (
                <TreeNode 
                  key={node.id} 
                  node={node} 
                  onSelect={handleSelect} 
                  selectedId={value}
                />
              ))
            ) : (
              <div className="text-center py-4 text-gray-400 text-xs">Không tìm thấy kết quả</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
