/** A small SF Symbols–style icon set (stroke icons on a 24 grid). */
type P = { size?: number; className?: string; strokeWidth?: number };

function I({ size = 24, className, strokeWidth = 2, children, fill = 'none' }: P & { children: React.ReactNode; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const Icon = {
  Sun: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </I>
  ),
  Scroll: (p: P) => (
    <I {...p}>
      <path d="M8 21h10a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-4 0V5a2 2 0 0 0-2-2h12a2 2 0 0 1 2 2v13" />
      <path d="M10 8h6M10 12h6" />
    </I>
  ),
  Person: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </I>
  ),
  Map: (p: P) => (
    <I {...p}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </I>
  ),
  People: (p: P) => (
    <I {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </I>
  ),
  Check: (p: P) => (
    <I {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </I>
  ),
  Plus: (p: P) => (
    <I {...p}>
      <path d="M12 5v14M5 12h14" />
    </I>
  ),
  Minus: (p: P) => (
    <I {...p}>
      <path d="M5 12h14" />
    </I>
  ),
  Close: (p: P) => (
    <I {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </I>
  ),
  ChevronRight: (p: P) => (
    <I {...p}>
      <path d="m9 5 7 7-7 7" />
    </I>
  ),
  ChevronLeft: (p: P) => (
    <I {...p}>
      <path d="m15 5-7 7 7 7" />
    </I>
  ),
  ChevronDown: (p: P) => (
    <I {...p}>
      <path d="m5 9 7 7 7-7" />
    </I>
  ),
  Gear: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </I>
  ),
  Flame: (p: P) => (
    <I {...p}>
      <path d="M12 22c4 0 7-2.7 7-6.8 0-3.8-2.6-6.1-4.3-8.2-.4 2-1.4 3.2-2.7 3.9.3-3.3-1.2-6.4-4-8.9.2 3.6-3 6.2-3 10.6C5 19.3 8 22 12 22z" />
    </I>
  ),
  Sparkles: (p: P) => (
    <I {...p}>
      <path d="M10 3.5 11.6 8 16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5 8.4 8z" />
      <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
    </I>
  ),
  Shield: (p: P) => (
    <I {...p}>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
    </I>
  ),
  Bag: (p: P) => (
    <I {...p}>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </I>
  ),
  Hammer: (p: P) => (
    <I {...p}>
      <path d="m14 7 3 3-9.5 9.5a2.1 2.1 0 0 1-3-3z" />
      <path d="m13 4 7 7 1.5-1.5L15.5 3.5z" />
    </I>
  ),
  Trophy: (p: P) => (
    <I {...p}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4" />
    </I>
  ),
  Book: (p: P) => (
    <I {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M8 7h7" />
    </I>
  ),
  Moon: (p: P) => (
    <I {...p}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </I>
  ),
  Bolt: (p: P) => (
    <I {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </I>
  ),
  Heart: (p: P) => (
    <I {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </I>
  ),
  Clock: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </I>
  ),
  Trash: (p: P) => (
    <I {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </I>
  ),
  Lock: (p: P) => (
    <I {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </I>
  ),
  Ellipsis: (p: P) => (
    <I {...p}>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </I>
  ),
  Coin: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3" />
    </I>
  ),
  Sword: (p: P) => (
    <I {...p}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" />
    </I>
  ),
  Download: (p: P) => (
    <I {...p}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </I>
  ),
  Share: (p: P) => (
    <I {...p}>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </I>
  ),
  Pause: (p: P) => (
    <I {...p}>
      <path d="M9 5v14M15 5v14" />
    </I>
  ),
  Copy: (p: P) => (
    <I {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </I>
  ),
  Speaker: (p: P) => (
    <I {...p}>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </I>
  ),
  Eye: (p: P) => (
    <I {...p}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </I>
  ),
  Forward: (p: P) => (
    <I {...p}>
      <path d="m5 5 7 7-7 7M13 5l7 7-7 7" />
    </I>
  ),
  Chat: (p: P) => (
    <I {...p}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </I>
  ),
  Smile: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </I>
  ),
};
