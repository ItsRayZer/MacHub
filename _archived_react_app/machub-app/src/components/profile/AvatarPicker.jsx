import { useState } from 'react';
import { X, Check } from 'lucide-react';

// ─── Avatar catalogue ─────────────────────────────────────────────────────────
// Each entry: id, src (public path), label, category, bgColor (ring accent)
export const AVATARS = [
  // ── Female ────────────────────────────────────────────────────────────────
  { id: 'f1', src: '/avatars/av_f1.png', label: 'Luna',    category: 'female', accent: '#C084FC' },
  { id: 'f2', src: '/avatars/av_f2.png', label: 'Maya',    category: 'female', accent: '#A78BFA' },
  { id: 'f3', src: '/avatars/av_f3.png', label: 'Aria',    category: 'female', accent: '#F472B6' },
  { id: 'f4', src: '/avatars/av_f4.png', label: 'Jade',    category: 'female', accent: '#34D399' },
  { id: 'f5', src: '/avatars/av_f5.png', label: 'Zara',    category: 'female', accent: '#60A5FA' },

  // ── Male ──────────────────────────────────────────────────────────────────
  { id: 'm1', src: '/avatars/av_m1.png', label: 'Kai',     category: 'male',   accent: '#38BDF8' },
  { id: 'm2', src: '/avatars/av_m2.png', label: 'Rajan',   category: 'male',   accent: '#FBBF24' },
  { id: 'm3', src: '/avatars/av_m3.png', label: 'Neo',     category: 'male',   accent: '#818CF8' },
  { id: 'm4', src: '/avatars/av_m4.png', label: 'Jax',     category: 'male',   accent: '#FB7185' },

  // ── Tech (SVG emoji placeholders — images drop in when generated) ─────────
  {
    id: 'tech1', src: null, emoji: '👨‍💻', label: 'Dev',      category: 'tech', accent: '#00F5D4',
    bg: 'linear-gradient(135deg,#0a0a0a 0%,#001a1a 100%)',
  },
  {
    id: 'tech2', src: null, emoji: '👩‍🔬', label: 'AI Girl', category: 'tech', accent: '#818CF8',
    bg: 'linear-gradient(135deg,#0a0010 0%,#1a0040 100%)',
  },
  {
    id: 'tech3', src: null, emoji: '🤖',  label: 'Bot',     category: 'tech', accent: '#00F5D4',
    bg: 'linear-gradient(135deg,#001a10 0%,#002020 100%)',
  },

  // ── Kerala anime ─────────────────────────────────────────────────────────
  {
    id: 'kl1', src: null, emoji: '🌾', label: 'Arjun',   category: 'kerala', accent: '#F59E0B',
    bg: 'linear-gradient(135deg,#1a1000 0%,#2a1800 100%)',
  },
  {
    id: 'kl2', src: null, emoji: '🌸', label: 'Devika',  category: 'kerala', accent: '#F472B6',
    bg: 'linear-gradient(135deg,#1a001a 0%,#2a0828 100%)',
  },
  {
    id: 'kl3', src: null, emoji: '🌴', label: 'Amal',    category: 'kerala', accent: '#34D399',
    bg: 'linear-gradient(135deg,#001a08 0%,#001808 100%)',
  },

  // ── Football ──────────────────────────────────────────────────────────────
  {
    id: 'fb1', src: null, emoji: '⚽', label: 'Messi',   category: 'football', accent: '#60A5FA',
    bg: 'linear-gradient(135deg,#00001a 0%,#001030 100%)',
  },
  {
    id: 'fb2', src: null, emoji: '🥅', label: 'Ronaldo', category: 'football', accent: '#EF4444',
    bg: 'linear-gradient(135deg,#1a0000 0%,#300000 100%)',
  },
  {
    id: 'fb3', src: null, emoji: '🏆', label: 'Neymar',  category: 'football', accent: '#FBBF24',
    bg: 'linear-gradient(135deg,#1a1000 0%,#2a1800 100%)',
  },
];

const CATEGORIES = [
  { key: 'all',     label: '✦ All'     },
  { key: 'female',  label: '♀ Female'  },
  { key: 'male',    label: '♂ Male'    },
  { key: 'tech',    label: '💻 Tech'   },
  { key: 'kerala',  label: '🌴 Kerala' },
  { key: 'football',label: '⚽ Football'},
];

export default function AvatarPicker({ currentSrc, onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [hovered, setHovered] = useState(null);

  const filtered = activeCategory === 'all'
    ? AVATARS
    : AVATARS.filter(a => a.category === activeCategory);

  return (
    /* ── Backdrop ── */
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      {/* blurred glass backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      />

      {/* ── Sheet ── */}
      <div
        className="relative w-full max-w-lg rounded-t-3xl overflow-hidden animate-slideUp"
        style={{
          background: 'rgba(9,9,11,0.96)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.07), 0 -8px 40px rgba(0,0,0,0.6)',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* drag pill */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* header */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h3 className="text-sm font-bold text-white font-display">Choose Avatar</h3>
            <p className="text-[10px] text-[#8D99AE] mt-0.5">
              {AVATARS.length} avatars · tap to select
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* category pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-200"
              style={{
                background: activeCategory === cat.key
                  ? '#00F5D4'
                  : 'rgba(255,255,255,0.06)',
                color: activeCategory === cat.key ? '#000' : '#8D99AE',
                border: activeCategory === cat.key
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* avatar grid */}
        <div className="overflow-y-auto no-scrollbar p-4">
          <div className="grid grid-cols-4 gap-3 pb-6">
            {filtered.map(av => {
              const isSelected = currentSrc === av.src || currentSrc === av.emoji;
              const isHovered = hovered === av.id;

              return (
                <button
                  key={av.id}
                  onClick={() => onSelect(av.src || av.emoji, av)}
                  onMouseEnter={() => setHovered(av.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  {/* avatar ring */}
                  <div
                    className="relative w-16 h-16 rounded-full transition-all duration-200"
                    style={{
                      padding: '2.5px',
                      background: isSelected || isHovered
                        ? `linear-gradient(135deg, ${av.accent}, #ffffff30)`
                        : 'rgba(255,255,255,0.08)',
                      boxShadow: isSelected
                        ? `0 0 16px ${av.accent}60`
                        : isHovered
                        ? `0 0 8px ${av.accent}30`
                        : 'none',
                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <div
                      className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                      style={{ background: av.bg || '#111' }}
                    >
                      {av.src ? (
                        <img
                          src={av.src}
                          alt={av.label}
                          className="w-full h-full object-cover"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-2xl leading-none select-none">{av.emoji}</span>
                      )}
                    </div>

                    {/* selected checkmark */}
                    {isSelected && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center animate-springIn"
                        style={{ background: av.accent, border: '2px solid #000' }}
                      >
                        <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  {/* label */}
                  <span
                    className="text-[9px] font-medium transition-colors duration-200"
                    style={{ color: isSelected ? av.accent : '#8D99AE' }}
                  >
                    {av.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
