import { Info, BarChart3, TrendingUp, TrendingDown, Target, HeartPulse, Award, Zap, Brain, Activity, Clock, DollarSign, Filter, Store } from 'lucide-react';

export default function Guidelines() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-vnpost-blue flex items-center gap-3">
          <Info className="text-vnpost-orange" size={32} />
          THÔNG TIN & HƯỚNG DẪN HỆ THỐNG
        </h1>
        <p className="text-gray-500 font-medium italic">
          Giải thích các chỉ số nghiệp vụ, thuật ngữ và quy trình vận hành CRM V3.0
        </p>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Section 1: Health Score / RFM */}
          <div id="rfm-scoring" className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
            <div className="bg-gradient-to-br from-vnpost-blue to-indigo-900 p-8 text-white relative overflow-hidden">
               <DollarSign className="absolute -right-6 -bottom-6 opacity-10 rotate-12" size={140} />
               <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
                    <TrendingUp size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">RFM & Health Score</h2>
                    <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Hệ thống chấm điểm tiềm năng</p>
                  </div>
               </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                  Thuật ngữ RFM
                </h3>
                <div className="grid grid-cols-1 gap-4">
                   {[
                     { label: 'Recency (R)', color: 'blue', desc: 'Thời gian từ đơn cuối. Càng thấp càng tốt.' },
                     { label: 'Frequency (F)', color: 'indigo', desc: 'Tần suất gửi hàng. Phản ánh độ trung thành.' },
                     { label: 'Monetary (M)', color: 'violet', desc: 'Tổng doanh thu. Phản ánh giá trị kinh tế.' }
                   ].map((item, i) => (
                     <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                        <p className={`text-xs font-black text-${item.color}-600 uppercase mb-1`}>{item.label}</p>
                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{item.desc}</p>
                     </div>
                   ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                  Cách tính Health Score (70/30)
                </h3>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-[2rem] border border-blue-100 relative overflow-hidden">
                  <div className="relative z-10">
                    <code className="text-xs font-black text-vnpost-blue block mb-4 text-center bg-white/50 py-2 rounded-full border border-blue-200">
                      Score = (Rank_M * 0.7) + (Rank_F * 0.3)
                    </code>
                    <div className="space-y-2">
                       <p className="text-[10px] text-blue-800/70 font-medium italic">* Rank_M: Vị thế doanh thu trong tệp (0-100)</p>
                       <p className="text-[10px] text-blue-800/70 font-medium italic">* Rank_F: Vị thế số đơn trong tệp (0-100)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Lifecycle */}
          <div id="lifecycle" className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-900 p-8 text-white relative overflow-hidden">
               <Activity className="absolute -right-6 -bottom-6 opacity-10 rotate-12" size={140} />
               <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
                    <HeartPulse size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Customer Lifecycle</h2>
                    <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-widest">Quản trị vòng đời khách hàng</p>
                  </div>
               </div>
            </div>

            <div className="p-8 space-y-6">
               <div className="space-y-4">
                 <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                   Phân loại trạng thái
                 </h3>
                 
                 <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Khách hàng mới (New)', color: 'blue', desc: 'Đơn hàng đầu tiên. Duy trì trạng thái đến hết tháng thứ 03.' },
                      { label: 'Hiện hữu (Active)', color: 'emerald', desc: 'Đã qua giai đoạn Mới & có đơn trong vòng 03 tháng gần nhất.' },
                      { label: 'Tái bản (Recovered)', color: 'purple', desc: 'Khách từng "Rời bỏ" (nghỉ > 03 tháng) nay quay lại gửi hàng.' },
                      { label: 'Nguy cơ (At Risk)', color: 'orange', desc: 'Có đơn đều đến tháng trước, tháng này hiện chưa phát sinh đơn.' },
                      { label: 'Rời bỏ (Churned)', color: 'red', desc: 'Liên tiếp 03 tháng không có đơn. Tính từ tháng thứ 04.' }
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-4 p-3 bg-${item.color}-50/50 rounded-2xl border border-${item.color}-100 hover:bg-white hover:shadow-sm transition-all`}>
                        <div className={`w-2 h-2 rounded-full bg-${item.color}-500 shadow-lg shadow-${item.color}-200`}></div>
                        <div className="flex-1">
                           <span className={`text-[10px] font-black text-${item.color}-700 uppercase`}>{item.label}</span>
                           <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Section 3: AI Churn Prediction (FULL WIDTH) */}
        <div id="ai-prediction" className="bg-white rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-700">
          <div className="bg-gradient-to-r from-rose-600 via-red-700 to-rose-900 p-10 text-white relative overflow-hidden">
             <Brain className="absolute -right-8 -bottom-8 opacity-10 rotate-12" size={200} />
             <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="p-5 bg-white/10 rounded-[2rem] backdrop-blur-2xl border border-white/20 shadow-2xl">
                    <Zap size={40} className="text-yellow-300 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">AI Churn Prediction</h2>
                    <p className="text-sm text-rose-200 font-bold uppercase tracking-[0.2em] mt-1">Hệ thống dự báo rời bỏ sớm (Machine Learning)</p>
                  </div>
                </div>
                <div className="bg-black/20 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                   <p className="text-[10px] uppercase font-black tracking-widest text-rose-100">Cơ chế phát hiện</p>
                   <p className="text-lg font-black italic">Anomaly Detection</p>
                </div>
             </div>
          </div>

          <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
             <div className="lg:col-span-4 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-vnpost-blue flex items-center gap-3">
                    <div className="w-2 h-8 bg-vnpost-orange rounded-full"></div>
                    Các biến số đầu vào
                  </h3>
                  <div className="space-y-4">
                     <div className="p-5 bg-rose-50 rounded-3xl border border-rose-100 group-hover:bg-white transition-colors duration-500">
                        <div className="flex items-center gap-3 mb-2">
                           <Clock className="text-rose-600" size={20} />
                           <p className="text-sm font-black text-gray-800 uppercase">Độ trễ vắng mặt</p>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed font-medium">So sánh số ngày không gửi hàng thực tế với tần suất trung bình (Interval) của riêng khách hàng đó.</p>
                     </div>
                     <div className="p-5 bg-rose-50 rounded-3xl border border-rose-100 group-hover:bg-white transition-colors duration-500">
                        <div className="flex items-center gap-3 mb-2">
                           <TrendingDown className="text-rose-600" size={20} />
                           <p className="text-sm font-black text-gray-800 uppercase">Sụt giảm doanh thu</p>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed font-medium">Phân tích biến động doanh thu 7 ngày gần nhất so với trung bình 30 ngày để tìm điểm gãy.</p>
                     </div>
                  </div>
                </div>
                <div className="bg-rose-900 text-rose-100 p-6 rounded-[2.5rem] border-4 border-rose-800 shadow-inner">
                   <p className="text-xs font-medium italic leading-relaxed">
                     "Hệ thống AI không chỉ nhìn vào các con số tĩnh, nó học từ thói quen của khách hàng để phát hiện ngay khi thói quen đó bị phá vỡ."
                   </p>
                </div>
             </div>

             <div className="lg:col-span-8">
                <div className="bg-gray-50 rounded-[2.5rem] border border-gray-100 p-8 h-full">
                  <h4 className="text-[11px] font-black text-rose-700 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Target size={16} /> Chi tiết thuật toán & Công thức chấm điểm
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 hover:border-rose-300 transition-colors">
                      <p className="font-black text-rose-800 uppercase text-[10px] mb-4 flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> S1: Điểm Độ trễ (40%)
                      </p>
                      <div className="bg-rose-50 p-3 rounded-xl mb-4 font-mono text-xs text-center border border-rose-100 text-rose-900">
                        Min(100%, vắng / (TB x 3)) x 40%
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">Nếu vắng mặt gấp 3 lần tần suất trung bình &rarr; Rủi ro thời gian đạt mức bão hòa.</p>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-rose-100 hover:border-rose-300 transition-colors">
                      <p className="font-black text-rose-800 uppercase text-[10px] mb-4 flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> S2: Điểm Tiền (60%)
                      </p>
                      <div className="bg-rose-50 p-3 rounded-xl mb-4 font-mono text-xs text-center border border-rose-100 text-rose-900">
                        (% Doanh thu giảm) x 60%
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">Phản ánh trực tiếp mức độ sụt giảm sản lượng so với kỳ trước.</p>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-inner border border-gray-200">
                    <p className="text-xs font-black text-gray-800 uppercase mb-6 flex items-center gap-2">
                      <Award size={18} className="text-yellow-500" /> Case Study: Khách hàng B (VIP)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-[11px]">
                      <div className="space-y-4">
                        <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Dữ liệu TB</p>
                        <div className="space-y-2">
                          <div className="flex justify-between border-b pb-1"><span>Gửi:</span> <strong>2 ngày/lần</strong></div>
                          <div className="flex justify-between border-b pb-1"><span>Doanh thu:</span> <strong>100Tr/tuần</strong></div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="font-bold text-rose-400 uppercase tracking-widest text-[9px]">Biến động thực tế</p>
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-rose-100 pb-1 text-rose-700"><span>Vắng mặt:</span> <strong>06 ngày</strong></div>
                          <div className="flex justify-between border-b border-rose-100 pb-1 text-rose-700"><span>DT Tuần này:</span> <strong>40Tr (-60%)</strong></div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="font-bold text-emerald-400 uppercase tracking-widest text-[9px]">AI Scoring</p>
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-emerald-100 pb-1 text-emerald-700"><span>Điểm S1:</span> <strong>40.0%</strong></div>
                          <div className="flex justify-between border-b border-emerald-100 pb-1 text-emerald-700"><span>Điểm S2 + Bias:</span> <strong>45.0%</strong></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 flex items-center gap-6 bg-rose-600 text-white p-6 rounded-3xl shadow-2xl shadow-rose-200 overflow-hidden relative">
                       <div className="absolute top-0 right-0 w-32 h-full bg-white/5 skew-x-12 transform translate-x-10"></div>
                       <div className="text-5xl font-black italic tracking-tighter">85%</div>
                       <div className="flex-1">
                          <p className="text-sm font-black uppercase tracking-[0.2em]">Churn Risk Score</p>
                          <div className="flex items-center gap-2 mt-1">
                             <div className="px-2 py-0.5 bg-white text-rose-600 rounded text-[9px] font-black uppercase">🚨 High Alert</div>
                             <p className="text-[10px] text-rose-100 font-medium italic">Công thức tổng hợp: 40% (S1) + 45% (S2)</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Section 4: Potential Whale Ranking */}
          <div id="potentials" className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
            <div className="bg-gradient-to-br from-vnpost-orange to-orange-600 p-8 text-[#003E7E] relative overflow-hidden">
               <Award className="absolute -right-6 -bottom-6 opacity-10 rotate-12" size={140} />
               <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xl border border-white/30">
                    <BarChart3 size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Potential Rankings</h2>
                    <p className="text-[10px] text-orange-900 font-black uppercase tracking-widest">Phân hạng khách hàng vãng lai</p>
                  </div>
               </div>
            </div>

            <div className="p-8 space-y-6">
               <div className="space-y-4">
                 <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                   Tiêu chuẩn phân hạng (Lead Gen)
                 </h3>
                 
                 <div className="space-y-3">
                   {[
                     { label: 'Kim Cương', icon: '💎', color: 'blue', threshold: 'DT > 10Tr / Tháng' },
                     { label: 'Vàng', icon: '🥇', color: 'yellow', threshold: 'DT > 4Tr / Tháng' },
                     { label: 'Bạc', icon: '🥈', color: 'gray', threshold: 'DT > 1Tr / Tháng' }
                   ].map((item, i) => (
                     <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                       <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-full bg-${item.color}-600 flex items-center justify-center text-white text-sm shadow-lg`}>{item.icon}</div>
                         <div className={`text-xs font-black text-${item.color}-600 uppercase`}>{item.label}</div>
                       </div>
                       <div className="text-[10px] font-black text-gray-400 text-right uppercase tracking-widest">{item.threshold}</div>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="bg-orange-50 p-5 rounded-3xl border border-orange-100 border-dashed">
                  <p className="text-[11px] text-orange-900 leading-relaxed italic font-medium">
                    "Đây là những viên kim cương thô chưa được định danh mã CRM. Cần tiếp cận ngay để chuyển đổi thành khách hàng chính thức."
                  </p>
               </div>
            </div>
          </div>

          {/* Section 5: Movement Analysis */}
          <div id="movement-analysis" className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 text-white relative overflow-hidden">
               <Filter className="absolute -right-6 -bottom-6 opacity-10 rotate-12" size={140} />
               <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
                    <TrendingUp size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Movement Analysis</h2>
                    <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Phân tích biến động doanh thu</p>
                  </div>
               </div>
            </div>

            <div className="p-8 space-y-6">
               <div className="space-y-4">
                 <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                   Phân loại biến động (MoM)
                 </h3>
                 
                 <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'New (Mới)', color: 'emerald', desc: 'Chưa có ở kỳ trước' },
                      { label: 'Lost (Rời đi)', color: 'rose', desc: 'Không có ở kỳ này' },
                      { label: 'Growing (Tăng)', color: 'blue', desc: 'DT kỳ này > Kỳ trước' },
                      { label: 'Declining (Giảm)', color: 'orange', desc: 'DT kỳ này < Kỳ trước' }
                    ].map((item, i) => (
                      <div key={i} className={`p-3 bg-${item.color}-50 rounded-2xl border border-${item.color}-100`}>
                        <span className={`text-[10px] font-black text-${item.color}-700 uppercase`}>{item.label}</span>
                        <p className="text-[9px] text-gray-500 mt-1 leading-tight">{item.desc}</p>
                      </div>
                    ))}
                 </div>
               </div>

               <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                  <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Info size={14} /> Ví dụ so sánh (T4 vs T3)
                  </h4>
                  <div className="space-y-3 text-[11px] text-blue-900 font-medium">
                    <div className="flex items-center gap-3 bg-white/50 p-2 rounded-xl">
                       <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 text-[10px]">↑</div>
                       <p><strong>Growing:</strong> T3 (10Tr) &rarr; T4 (30Tr). <span className="text-emerald-600">Gain +20Tr</span></p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/50 p-2 rounded-xl">
                       <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 text-[10px]">X</div>
                       <p><strong>Lost:</strong> T3 (50Tr) &rarr; T4 (0Tr). <span className="text-rose-600">Loss -50Tr</span></p>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Section 6: Level 3 Post Office Production */}
          <div id="bc3-production" className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 md:col-span-2">
            <div className="bg-gradient-to-br from-vnpost-blue to-blue-900 p-8 text-white relative overflow-hidden">
               <Store className="absolute -right-6 -bottom-6 opacity-10 rotate-12" size={140} />
               <div className="relative z-10 flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/20">
                    <Activity size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Post Office Production</h2>
                    <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Theo dõi sản lượng Bưu cục cấp 3</p>
                  </div>
               </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="space-y-4">
                 <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                   Logic Phân rã
                 </h3>
                 <p className="text-xs text-gray-500 leading-relaxed">
                   Hệ thống tự động bóc tách doanh thu <strong>Khách lẻ / Chưa định danh</strong> và gắn vào từng Bưu cục (Point ID) dựa trên dữ liệu giao dịch thực tế. Điều này giúp đánh giá chính xác năng lực khai thác tại chỗ của từng điểm phục vụ.
                 </p>
               </div>

               <div className="space-y-4">
                 <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                   Cơ chế Drill-down
                 </h3>
                 <p className="text-xs text-gray-500 leading-relaxed">
                   Người dùng có thể Click vào từng hàng trong <strong>Bảng tổng hợp Đơn vị</strong> để đi sâu xuống các cấp thấp hơn (Trung tâm &rarr; Cụm &rarr; Xã &rarr; Bưu cục) mà vẫn giữ nguyên dải ngày so sánh.
                 </p>
               </div>

               <div className="space-y-4">
                 <h3 className="font-bold text-vnpost-blue flex items-center gap-2">
                   <div className="w-1.5 h-6 bg-vnpost-orange rounded-full"></div>
                   Chỉ số Hiệu quả
                 </h3>
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <ul className="space-y-2 text-[10px] font-bold text-gray-600">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Tổng doanh thu (A vs B)</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Số lượng khách Mới/Tăng</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Số lượng khách Mất/Giảm</li>
                    </ul>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>


      {/* Footer Note */}
      <div className="bg-vnpost-blue/5 rounded-3xl p-8 text-center border border-vnpost-blue/10">
        <p className="text-sm text-vnpost-blue font-bold">
          "Dữ liệu là mỏ vàng, nhưng Insight mới là chìa khóa để mở kho báu."
        </p>
        <p className="text-[10px] text-gray-400 mt-2 font-black uppercase tracking-widest">
          Hệ thống CRM V3.0 – Biệt đội Antigravity 🚀💎
        </p>
      </div>
    </div>
  );
}
