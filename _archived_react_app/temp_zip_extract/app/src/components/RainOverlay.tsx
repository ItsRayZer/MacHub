import { useEffect, useRef } from 'react';

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
  trails: { x: number; y: number; opacity: number }[];
}

export default function RainOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<RainDrop[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const createDrop = (x?: number, y?: number): RainDrop => ({
      x: x !== undefined ? x : Math.random() * canvas.width,
      y: y !== undefined ? y : -Math.random() * 100,
      length: 15 + Math.random() * 35,
      speed: 3 + Math.random() * 7,
      opacity: 0.1 + Math.random() * 0.35,
      width: 0.5 + Math.random() * 1.5,
      trails: [],
    });

    // Initialize with some drops
    for (let i = 0; i < 40; i++) {
      const drop = createDrop();
      drop.y = Math.random() * canvas.height;
      dropsRef.current.push(drop);
    }

    const handleClick = (e: MouseEvent) => {
      for (let i = 0; i < 25; i++) {
        const drop = createDrop(
          e.clientX + (Math.random() - 0.5) * 60,
          e.clientY + (Math.random() - 0.5) * 40
        );
        dropsRef.current.push(drop);
      }
    };
    window.addEventListener('click', handleClick);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new drops occasionally
      if (Math.random() < 0.08) {
        dropsRef.current.push(createDrop());
      }

      dropsRef.current = dropsRef.current.filter((drop) => {
        // Save trail
        if (Math.random() < 0.15) {
          drop.trails.push({ x: drop.x, y: drop.y, opacity: drop.opacity * 0.5 });
        }

        drop.y += drop.speed;

        // Draw trail droplets
        drop.trails = drop.trails.filter((t) => {
          t.opacity *= 0.97;
          if (t.opacity < 0.01) return false;
          ctx.beginPath();
          ctx.arc(t.x, t.y, drop.width * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${t.opacity * 0.4})`;
          ctx.fill();
          return true;
        });

        // Draw main drop
        const gradient = ctx.createLinearGradient(drop.x, drop.y, drop.x, drop.y + drop.length);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${drop.opacity * 0.8})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = drop.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Drop head (brighter tip)
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.width, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity * 0.6})`;
        ctx.fill();

        return drop.y < canvas.height + drop.length + 20;
      });
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
}
