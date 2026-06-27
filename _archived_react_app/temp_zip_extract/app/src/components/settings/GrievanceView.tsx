import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { grievanceSubmissions } from '@/data/mockData';
import { Send, Clock, CheckCircle2, AlertCircle, XCircle, Plus, MessageSquare } from 'lucide-react';

export default function GrievanceView() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);

  const handleSubmit = () => {
    if (!category || !subject || !description) {
      showToast('Please fill all fields', 'error');
      return;
    }
    showToast('Grievance submitted successfully', 'success');
    setIsFormOpen(false);
    setCategory('');
    setSubject('');
    setDescription('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="w-4 h-4 text-[#00F5D4]" />;
      case 'in-progress': return <Clock className="w-4 h-4 text-[#FFB703]" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertCircle className="w-4 h-4 text-[#8D99AE]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return '#00F5D4';
      case 'in-progress': return '#FFB703';
      case 'rejected': return '#ff6b6b';
      default: return '#8D99AE';
    }
  };

  return (
    <div className="p-4 pb-8 space-y-4">
      {!isFormOpen && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="w-full py-3.5 rounded-xl font-bold text-xs text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: '#00F5D4' }}
        >
          <Plus className="w-4 h-4" />
          Submit New Grievance
        </button>
      )}

      {isFormOpen && (
        <div className="liquid-glass rounded-2xl p-5 space-y-4 animate-slideInRight">
          <h4 className="text-sm font-bold font-display text-white">New Grievance</h4>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-[#8D99AE] mb-1.5 font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors appearance-none"
              >
                <option value="">Select category...</option>
                <option value="Academic">Academic</option>
                <option value="Examination">Examination</option>
                <option value="Fee">Fee Related</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#8D99AE] mb-1.5 font-medium">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief subject of your grievance..."
                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors placeholder:text-[#8D99AE]/50"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#8D99AE] mb-1.5 font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={4}
                className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors resize-none placeholder:text-[#8D99AE]/50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setIsFormOpen(false)}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-semibold text-[11px] text-white transition-all hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl font-bold text-[11px] text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: '#00F5D4' }}
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </button>
          </div>
        </div>
      )}

      <h4 className="text-[11px] font-bold text-[#8D99AE] uppercase tracking-wider px-1">
        Previous Submissions
      </h4>
      <div className="space-y-2">
        {grievanceSubmissions.map((g) => (
          <div key={g.id} className="liquid-glass rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {getStatusIcon(g.status)}
                <div>
                  <h5 className="text-xs font-bold text-white">{g.subject}</h5>
                  <span className="text-[10px] text-[#8D99AE]">{g.category}</span>
                </div>
              </div>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize"
                style={{ background: getStatusColor(g.status) + '15', color: getStatusColor(g.status) }}
              >
                {g.status.replace('-', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-[#8D99AE] leading-relaxed">{g.description}</p>
            {g.response && (
              <div
                className="p-3 rounded-lg mt-2"
                style={{ background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.1)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3 h-3 text-[#00F5D4]" />
                  <span className="text-[10px] font-semibold text-[#00F5D4]">Response</span>
                </div>
                <p className="text-[11px] text-white/80">{g.response}</p>
              </div>
            )}
            <p className="text-[10px] text-[#8D99AE] font-mono-tech pt-1">Submitted: {g.submittedDate}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
