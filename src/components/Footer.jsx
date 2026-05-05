import { ShieldCheck, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto py-8 px-10 border-t border-gray-200 bg-gray-50/80 backdrop-blur-md no-pdf">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col md:flex-row gap-8 md:gap-24">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-vnpost-orange uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
              <ShieldCheck size={14} /> Chỉ đạo & Định hướng chiến lược
            </span>
            <span className="text-sm font-black text-vnpost-blue tracking-tight">Võ Hoài Trung – PGĐ BĐTP Huế</span>
          </div>
          
          <div className="flex flex-col gap-1 border-l-0 md:border-l border-gray-200 md:pl-24">
            <span className="text-[10px] font-black text-vnpost-orange uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
              <Cpu size={14} /> Thiết kế & Phát triển hệ thống
            </span>
            <span className="text-sm font-black text-vnpost-blue tracking-tight">Trần Nhật Tân – CV Trung tâm Vận Hành</span>
          </div>
        </div>
        
        <div className="text-right border-t md:border-t-0 border-gray-100 pt-6 md:pt-0 w-full md:w-auto">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">CRM 3.0 • Elite</p>
          <p className="text-[9px] text-gray-400 font-bold mt-2 italic">© 2026 Bưu điện thành phố Huế. Protected by Antigravity AI.</p>
        </div>
      </div>
    </footer>
  );
}
