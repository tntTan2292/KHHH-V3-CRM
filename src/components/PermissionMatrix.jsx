import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Check, X, Lock, Unlock, Eye, FileDown, FileUp, Settings } from 'lucide-react';

const API_URL = 'http://localhost:8000/api';

const MODULE_ICONS = {
  DASHBOARD: <Eye size={16} />,
  CUSTOMERS: <Eye size={16} />,
  POTENTIAL: <Eye size={16} />,
  ANALYTICS: <Eye size={16} />,
  ADMIN: <Settings size={16} />,
  ACTION: <FileDown size={16} />
};

export default function PermissionMatrix({ 
  permissions = [], 
  selectedIds = [], 
  deniedIds = [], 
  onChange, 
  isReadOnly = false,
  mode = 'role', // 'role' or 'user'
  rolePermissions = [] // Added to show defaults in user mode
}) {
  const groupedPermissions = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  const handleToggle = (permissionId) => {
    if (isReadOnly) return;
    
    if (mode === 'role') {
      const next = selectedIds.includes(permissionId)
        ? selectedIds.filter(id => id !== permissionId)
        : [...selectedIds, permissionId];
      onChange(next);
    } else {
      // User mode: Cycle through Granted -> Denied -> Default (Neutral)
      if (selectedIds.includes(permissionId)) {
        // Switch to Denied
        onChange(selectedIds.filter(id => id !== permissionId), [...deniedIds, permissionId]);
      } else if (deniedIds.includes(permissionId)) {
        // Switch to Neutral (Role Default)
        onChange(selectedIds, deniedIds.filter(id => id !== permissionId));
      } else {
        // Switch to Granted
        onChange([...selectedIds, permissionId], deniedIds);
      }
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedPermissions).map(([module, perms]) => (
        <div key={module} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
            <span className="text-vnpost-blue opacity-60">{MODULE_ICONS[module] || <Shield size={16} />}</span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{module}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {perms.map(p => {
              const isGranted = selectedIds.includes(p.id);
              const isDenied = deniedIds.includes(p.id);
              
              return (
                <div 
                  key={p.id} 
                  className={`flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors cursor-pointer ${isReadOnly && 'cursor-default'}`}
                  onClick={() => handleToggle(p.id)}
                >
                  <div className="flex-1 flex items-center gap-3">
                    {mode === 'user' && (
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        (isGranted || (!isDenied && rolePermissions.includes(p.id))) 
                        ? 'bg-emerald-50 text-emerald-600' 
                        : 'bg-rose-50 text-rose-500'
                      }`}>
                        {(isGranted || (!isDenied && rolePermissions.includes(p.id))) ? <Check size={14} /> : <X size={14} />}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-700">{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium italic">{p.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {mode === 'role' ? (
                      <div className={`w-10 h-6 rounded-full transition-all relative ${isGranted ? 'bg-vnpost-blue' : 'bg-gray-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isGranted ? 'left-5' : 'left-1'}`}></div>
                      </div>
                    ) : (
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        <button 
                          className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${isGranted ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-400'}`}
                        >
                          Cấp
                        </button>
                        <button 
                          className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${!isGranted && !isDenied ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-400'}`}
                        >
                          Mặc định ({rolePermissions.includes(p.id) ? 'Được phép' : 'Bị chặn'})
                        </button>
                        <button 
                          className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${isDenied ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-400'}`}
                        >
                          Chặn
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
