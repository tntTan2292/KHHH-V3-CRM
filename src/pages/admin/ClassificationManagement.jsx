import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const ClassificationManagement = () => {
    const { token, user } = useAuth();
    const [unknowns, setUnknowns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(null);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    // Dữ liệu danh mục
    const TARGET_CATEGORIES = ['TMĐT', 'HCC', 'Truyền thống', 'Quốc tế'];
    const [selections, setSelections] = useState({});

    const fetchUnknowns = async () => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:8000/api/admin/unknown-classifications', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnknowns(res.data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Lỗi khi lấy dữ liệu phân loại.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchUnknowns();
        }
    }, [token]);

    const handleSelectChange = (code, value) => {
        setSelections(prev => ({ ...prev, [code]: value }));
    };

    const handleAssign = async (code) => {
        const targetCategory = selections[code];
        if (!targetCategory) {
            alert('Vui lòng chọn một nhóm dịch vụ đích!');
            return;
        }

        try {
            setAssigning(code);
            setMessage(null);
            setError(null);
            
            const res = await axios.post(
                'http://localhost:8000/api/admin/assign-classification',
                {
                    dich_vu_chinh: code,
                    loai_dich_vu: targetCategory
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            setMessage(res.data.message);
            // Loại bỏ dòng đã gán khỏi danh sách
            setUnknowns(prev => prev.filter(item => item.code !== code));
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Lỗi khi gán dịch vụ.');
        } finally {
            setAssigning(null);
        }
    };

    if (!user || (user.role_name !== 'ADMIN' && user.role_name !== 'SUPERADMIN')) {
        return (
            <div className="p-6 text-center text-red-500 font-medium">
                Bạn không có quyền truy cập trang quản trị này.
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Quản lý Phân loại Dịch vụ</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Bản đồ ánh xạ (Classification Map) - Nơi xử lý các mã dịch vụ mới xuất hiện nhưng chưa có trong Từ điển.
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                    <p className="font-medium">Lỗi</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {message && (
                <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
                    <p className="font-medium">Thành công</p>
                    <p className="text-sm">{message}</p>
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-medium text-gray-800">Danh sách Dịch vụ Chưa Phân Loại</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <svg className="animate-spin h-8 w-8 mx-auto text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang quét dữ liệu...
                    </div>
                ) : unknowns.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-500 mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-1">Tuyệt vời!</h3>
                        <p className="text-gray-500">Tất cả mã dịch vụ đều đã được định tuyến chuẩn xác.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã Dịch Vụ Mới</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số Giao Dịch</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Doanh thu Ảnh hưởng</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Lần cuối xuất hiện</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {unknowns.map((item) => (
                                    <tr key={item.code} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                                                {item.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                                            {item.transaction_count.toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                                            {item.total_revenue.toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                            {item.latest_date ? new Date(item.latest_date).toLocaleDateString('vi-VN') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <select
                                                    className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                                    value={selections[item.code] || ''}
                                                    onChange={(e) => handleSelectChange(item.code, e.target.value)}
                                                    disabled={assigning === item.code}
                                                >
                                                    <option value="" disabled>-- Chọn nhóm --</option>
                                                    {TARGET_CATEGORIES.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                                
                                                <button
                                                    onClick={() => handleAssign(item.code)}
                                                    disabled={!selections[item.code] || assigning === item.code}
                                                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                                        assigning === item.code 
                                                            ? 'bg-blue-400 cursor-wait' 
                                                            : !selections[item.code]
                                                                ? 'bg-gray-300 cursor-not-allowed'
                                                                : 'bg-blue-600 hover:bg-blue-700'
                                                    }`}
                                                >
                                                    {assigning === item.code ? (
                                                        <>
                                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Đang Lưu...
                                                        </>
                                                    ) : 'Lưu Map'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassificationManagement;
