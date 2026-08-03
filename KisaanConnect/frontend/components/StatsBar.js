'use client';
import { useEffect, useRef, useState } from 'react';

const STATS = [
  { label: 'Farmers onboard', value: '2,400+' },
  { label: 'Districts covered', value: '38' },
  { label: 'Orders delivered', value: '18,600+' },
  { label: 'Avg. price gain for farmers', value: '22%' },
];

function parse(raw) {
  const match = raw.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!match) return { prefix: '', target: 0, suffix: raw };
  return {
    prefix: match[1],
    target: parseInt(match[2].replace(/,/g, ''), 10),
    suffix: match[3],
  };
}

function CountUp({ raw, active }) {
  const { prefix, target, suffix } = parse(raw);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!active) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(target);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    let frame;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return (
    <span>
      {prefix}
      {n.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="bg-[var(--kc-ink-deep)]">
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <div className="text-2xl md:text-3xl font-semibold text-[var(--kc-sprout)] tabular-nums">
              <CountUp raw={s.value} active={active} />
            </div>
            <div className="text-xs md:text-sm text-[var(--kc-line)]/70 mt-1.5 leading-snug">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}