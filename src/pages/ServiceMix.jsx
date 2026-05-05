import { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { ShoppingBag, Target, TrendingUp, Search, Calendar } from 'lucide-react';

const COLORS = ['#F9A51A', '#0054A6', '#003E7E', '#10B981', '#6366F1'];

export default function ServiceAnalytics() {
  const [serviceData, setServiceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waitingForDefaultDate, setWaitingForDefaultDate] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [coverage, setCoverage] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };
      const res = await api.get('/api/analytics/revenue-by-service', { params });
      setServiceData(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchCoverage = async () => {
    try {
      const res = await api.get('/api/analytics/data-coverage');
      setCoverage(res.data);
      if (res.data.latest_month && !startDate && !endDate) {
        setStartDate(res.data.latest_month.start);
        setEndDate(res.data.latest_month.end);
        setSelectedMonth(res.data.latest_month.value);
      }
    } catch (err) { console.error(err); }
    finally {
      setWaitingForDefaultDate(false);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      await fetchCoverage();
    };
    initApp();
  }, []);

  useEffect(() => {
    if (waitingForDefaultDate) return;
    fetchData();
  }, [startDate, endDate, waitingForDefaultDate]);

  const handleQuickMonth = (monthStr) => {
    if (!monthStr) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth(monthStr);
    const [year, month] = monthStr.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setStartDate(start);
    setEndDate(end);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cơ Cấu Dịch Vụ & Cơ Hội</h2>
          <div className="flex items-center gap-2 mt-1">
             <p className="text-gray-500">Phân tích tỉ trọng sản phẩm.</p>
             {(startDate || endDate) && (
                <span className="bg-vnpost-blue/10 text-vnpost-blue px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                  BÁO CÁO: {startDate || '...'} → {endDate || '...'}
                  {coverage.max_date && (
                    <span className="ml-1 text-green-700">
                      (Đã nạp đến: {new Date(coverage.max_date).toLocaleDateString('vi-VN')})
                    </span>
                  )}
                </span>
             )}
          </div>
        </div>
      </div>

      {/* Global Period Filter */}
      <div className="card flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="space-y-1.5 flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
            <Calendar size={12} className="text-vnpost-blue" /> Từ ngày
          </label>
          <input 
            type="date" 
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-vnpost-blue outline-none transition-all text-sm"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setSelectedMonth(""); }}
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-[150px]">
          <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
            <Calendar size={12} className="text-vnpost-blue" /> Đến ngày
          </label>
          <input 
            type="date" 
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-vnpost-blue outline-none transition-all text-sm"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setSelectedMonth(""); }}
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
            <TrendingUp size={12} className="text-vnpost-orange" /> Tháng nhanh
          </label>
          <select 
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-vnpost-orange outline-none transition-all text-sm font-semibold text-vnpost-blue"
            onChange={(e) => handleQuickMonth(e.target.value)}
            value={selectedMonth}
          >
            <option value="">-- Chọn tháng --</option>
            {coverage.months?.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 h-full pt-6">
           <button onClick={fetchData} className="btn-primary h-10 px-6">
              Lọc dữ liệu
           </button>
           <button 
            onClick={() => { setStartDate(""); setEndDate(""); setSelectedMonth(""); fetchData(); }}
            className="text-gray-400 hover:text-red-500 text-xs font-bold transition-colors uppercase whitespace-nowrap"
           >
             Xóa lọc
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-vnpost-blue" />
            Tỉ trọng Doanh thu theo Dịch vụ
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({percent}) => `${(percent * 100).toFixed(1)}%`}
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Target size={20} className="text-vnpost-orange" />
            Cơ hội Upsell / Cross-sell (Theo dõi đặc thù)
          </h3>
          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 italic text-orange-800 text-sm">
              Gợi ý từ hệ thống: 75% khách hàng đang gửi Bưu phẩm BĐ chưa sử dụng dịch vụ EMS. Đây là nhóm tiềm năng để chuyển đổi cước phí cao hơn.
            </div>
            
            <div className="border border-gray-100 rounded-xl overflow-hidden">
               <div className="bg-gray-50 p-3 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                  <span>Dịch vụ mục tiêu</span>
                  <span>Nhóm Tiềm năng</span>
               </div>
               <div className="divide-y divide-gray-100">
                  <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">E</div>
                        <div>
                           <p className="font-bold text-sm">EMS - Chuyển phát nhanh</p>
                           <p className="text-xs text-gray-500">Dành cho KH đang gửi bưu kiện truyền thống</p>
                        </div>
                     </div>
                     <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold">120 KH chưa dùng</span>
                  </div>
                  <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">L</div>
                        <div>
                           <p className="font-bold text-sm">Quốc tế (Logistics)</p>
                           <p className="text-xs text-gray-500">Dành cho các shop E-commerce lớn</p>
                        </div>
                     </div>
                     <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">45 KH tiềm năng</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ShoppingBag size={20} className="text-gray-700" />
            Danh sách Dịch vụ chi tiết
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="p-4 font-bold">Mã DV</th>
                <th className="p-4 font-bold">Tên Dịch Vụ</th>
                <th className="p-4 font-bold text-right">Doanh Thu Thống Kê</th>
                <th className="p-4 font-bold text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {serviceData.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono text-sm align-middle">
                     <span className="bg-gray-100 px-2 py-1 rounded text-gray-600 font-bold">{item.name.split(' - ')[0]}</span>
                  </td>
                  <td className="p-4 font-medium text-gray-800">{item.name}</td>
                  <td className="p-4 text-right font-bold text-vnpost-blue">{formatCurrency(item.value)}</td>
                  <td className="p-4 text-center">
                     <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold">Đang hoạt động</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
