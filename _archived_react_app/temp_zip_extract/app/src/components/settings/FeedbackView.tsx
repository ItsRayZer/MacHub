import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Send, Star, MessageSquare } from 'lucide-react';

export default function FeedbackView() {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const showToast = useStore((s: { showToast: (m: string, t?: 'success' | 'error' | 'info') => void }) => s.showToast);

  const handleSubmit = () => {
    if (rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }
    if (!feedback.trim()) {
      showToast('Please enter your feedback', 'error');
      return;
    }
    showToast('Feedback submitted. Thank you!', 'success');
    setRating(0);
    setFeedback('');
  };

  return (
    <div className="p-4 pb-8 space-y-5">
      <p className="text-[11px] text-[#8D99AE] px-1">
        Your feedback helps us improve MacHub. Rate your experience and share your thoughts.
      </p>

      <div className="liquid-glass rounded-2xl p-5 text-center">
        <h4 className="text-sm font-bold font-display text-white mb-3">Rate Your Experience</h4>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="transition-transform active:scale-90"
            >
              <Star
                className="w-8 h-8 transition-colors"
                style={{
                  color: star <= rating ? '#FFB703' : 'rgba(255, 255, 255, 0.2)',
                  fill: star <= rating ? '#FFB703' : 'none',
                }}
              />
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#8D99AE] mt-2">
          {rating === 0 ? 'Tap a star to rate' : rating <= 2 ? "We're sorry. Tell us how to improve." : rating <= 4 ? 'Thanks! What can we do better?' : "Awesome! We're glad you love it!"}
        </p>
      </div>

      <div className="liquid-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-[#ADE8F4]" />
          <h4 className="text-sm font-bold font-display text-white">Your Feedback</h4>
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Share your thoughts, report bugs, or suggest features..."
          rows={5}
          className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-white text-xs outline-none focus:border-[#00F5D4] transition-colors resize-none placeholder:text-[#8D99AE]/50"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-3.5 rounded-xl font-bold text-xs text-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{ background: '#00F5D4' }}
      >
        <Send className="w-4 h-4" />
        Submit Feedback
      </button>
    </div>
  );
}
