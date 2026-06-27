import { Code2, Shield, FileText, ExternalLink, Heart } from 'lucide-react';

export default function AboutView() {
  return (
    <div className="p-4 pb-8 space-y-5">
      {/* App Branding */}
      <div className="text-center py-6">
        <div
          className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #00F5D4 0%, #03045E 50%, #FFB703 100%)',
            boxShadow: '0 0 30px rgba(0, 245, 212, 0.2)',
          }}
        >
          <span className="text-2xl font-bold text-white font-display">M</span>
        </div>
        <h3 className="text-lg font-bold text-white font-display">MacHub</h3>
        <p className="text-[11px] text-[#8D99AE]">Mahatma Gandhi University Student Portal</p>
      </div>

      {/* Version Info */}
      <div
        className="rounded-xl divide-y overflow-hidden"
        style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="p-4 flex justify-between items-center">
          <span className="text-[12px] text-white">App Version</span>
          <span className="text-[12px] text-[#8D99AE] font-mono-tech">3.2.1</span>
        </div>
        <div className="p-4 flex justify-between items-center">
          <span className="text-[12px] text-white">Build Number</span>
          <span className="text-[12px] text-[#8D99AE] font-mono-tech">20250611.1</span>
        </div>
        <div className="p-4 flex justify-between items-center">
          <span className="text-[12px] text-white">Platform</span>
          <span className="text-[12px] text-[#8D99AE] font-mono-tech">Web (PWA)</span>
        </div>
        <div className="p-4 flex justify-between items-center">
          <span className="text-[12px] text-white">Data Source</span>
          <span className="text-[12px] text-[#8D99AE] font-mono-tech">studentportal.mgu.ac.in</span>
        </div>
      </div>

      {/* Links */}
      <div
        className="rounded-xl divide-y overflow-hidden"
        style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <button className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5">
          <div className="flex items-center gap-3">
            <Code2 className="w-4 h-4 text-[#ADE8F4]" />
            <span className="text-[12px] text-white">Open Source Licenses</span>
          </div>
          <ExternalLink className="w-4 h-4 text-[#8D99AE]" />
        </button>
        <button className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-[#ADE8F4]" />
            <span className="text-[12px] text-white">Privacy Policy</span>
          </div>
          <ExternalLink className="w-4 h-4 text-[#8D99AE]" />
        </button>
        <button className="w-full p-4 flex items-center justify-between text-left settings-row transition-colors hover:bg-white/5">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-[#ADE8F4]" />
            <span className="text-[12px] text-white">Terms of Service</span>
          </div>
          <ExternalLink className="w-4 h-4 text-[#8D99AE]" />
        </button>
      </div>

      {/* Footer */}
      <div className="text-center pt-4">
        <p className="text-[10px] text-[#8D99AE] flex items-center justify-center gap-1">
          Made with <Heart className="w-3 h-3 text-red-400" /> for MGU students
        </p>
        <p className="text-[9px] text-[#8D99AE] mt-1">
          © 2025 MacHub. Not officially affiliated with MGU.
        </p>
      </div>
    </div>
  );
}
