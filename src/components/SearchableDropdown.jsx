import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, User, X } from 'lucide-react';

export default function SearchableDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Chọn nhân viên...",
  disabled = false,
  groupBy = null, // e.g., 'department' or 'ma_bc'
  className = "",
  renderOption = null,
  isLoading = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smart positioning (flip upward if near bottom)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Dropdown max height is around 300px (max-h-64 + padding)
      if (spaceBelow < 300 && spaceAbove > spaceBelow) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
      
      // Auto focus search
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter options
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(opt => 
      (opt.label || '').toLowerCase().includes(lowerSearch) || 
      (opt.subLabel || '').toLowerCase().includes(lowerSearch) ||
      (opt.searchKey || '').toLowerCase().includes(lowerSearch)
    );
  }, [options, searchTerm]);

  // Grouping
  const displayItems = useMemo(() => {
    if (!groupBy) return filteredOptions;
    
    const groups = {};
    filteredOptions.forEach(opt => {
      const g = opt[groupBy] || 'Khác';
      if (!groups[g]) groups[g] = [];
      groups[g].push(opt);
    });
    
    const result = [];
    Object.keys(groups).forEach(g => {
      result.push({ isGroup: true, label: g, id: `group-${g}` });
      groups[g].forEach(opt => result.push(opt));
    });
    return result;
  }, [filteredOptions, groupBy]);

  // Only selectable items for keyboard nav
  const selectableItems = displayItems.filter(item => !item.isGroup);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < selectableItems.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < selectableItems.length) {
          onChange(selectableItems[focusedIndex].value);
          setIsOpen(false);
          setSearchTerm('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      default:
        break;
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-selectable="true"]');
      if (items[focusedIndex]) {
        items[focusedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-bold bg-white outline-none
          ${disabled ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' : 
            isOpen ? 'border-vnpost-blue ring-4 ring-blue-50' : 'border-gray-100 hover:border-gray-200 focus:border-vnpost-blue'}`}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-400 font-medium' : 'text-gray-800'}`}>
          {selectedOption ? (selectedOption.label || selectedOption.value) : placeholder}
        </span>
        <div className="flex items-center">
          {selectedOption && !disabled && (
             <X 
               size={16} 
               className="text-gray-400 hover:text-red-500 mr-1 transition-colors" 
               onClick={(e) => {
                 e.stopPropagation();
                 onChange("");
               }}
             />
          )}
          <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute left-0 right-0 z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col
            ${dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
          `}
          style={{ maxHeight: '320px' }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-vnpost-blue focus:ring-2 focus:ring-blue-100 bg-white"
                placeholder="Tìm kiếm nhanh..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Options List */}
          <div 
            className="overflow-y-auto flex-1 p-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
            ref={listRef}
          >
            {isLoading ? (
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse"></div>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <User size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-500 font-medium">Không tìm thấy kết quả</p>
                <p className="text-xs text-gray-400 mt-1">Thử đổi từ khóa khác</p>
              </div>
            ) : (
              displayItems.map((item, index) => {
                if (item.isGroup) {
                  return (
                    <div key={item.id} className="px-3 py-1.5 mt-2 mb-1 first:mt-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{item.label}</p>
                    </div>
                  );
                }

                const selIdx = selectableItems.indexOf(item);
                const isSelected = item.value === value;
                const isFocused = selIdx === focusedIndex;

                return (
                  <div
                    key={item.value}
                    data-selectable="true"
                    onClick={() => {
                      onChange(item.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    onMouseEnter={() => setFocusedIndex(selIdx)}
                    className={`
                      px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors text-sm
                      ${isSelected ? 'bg-blue-50 text-vnpost-blue font-bold' : ''}
                      ${isFocused && !isSelected ? 'bg-gray-100 text-gray-800' : ''}
                      ${!isSelected && !isFocused ? 'text-gray-700 hover:bg-gray-50' : ''}
                    `}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      {renderOption ? renderOption(item) : (
                        <>
                          <p className="truncate">{item.label}</p>
                          {item.subLabel && (
                            <p className="text-xs text-gray-400 truncate mt-0.5 font-normal">{item.subLabel}</p>
                          )}
                        </>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
