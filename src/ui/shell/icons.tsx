import type { Level } from '../../data/types';

/** Small inline icons, drawn for this app. All inherit currentColor. */

type P = { size?: number };

export function LevelIcon({ level, size = 13 }: P & { level: Level }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true as const, class: 'icon' };
  if (level === 'metric') {
    // A number line with ticks: values on a continuous scale.
    return (
      <svg {...common} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M1.5 11h13M3 11V7M6 11V8.5M8 11V6M10 11V8.5M13 11V7" />
      </svg>
    );
  }
  if (level === 'ordinal') {
    // Steps: ordered categories.
    return (
      <svg {...common} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <path d="M1.5 13.5h4v-3.5h4.5v-3.5h4.5v7z" />
      </svg>
    );
  }
  // Three different shapes: unordered categories.
  return (
    <svg {...common} fill="currentColor">
      <circle cx="4" cy="11.5" r="2.5" />
      <rect x="9.5" y="9" width="5" height="5" rx="0.5" />
      <path d="M8 1.5l3 5H5z" />
    </svg>
  );
}

export function InfoIcon({ size = 14 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="icon">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 4.2v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      <circle cx="8" cy="11.6" r="1" fill="currentColor" />
    </svg>
  );
}

export function WarnIcon({ size = 14 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="icon">
      <path d="M8 1.8l6.6 11.7H1.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M8 6v3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="8" cy="11.6" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function LocalIcon({ size = 15 }: P) {
  // A laptop with a padlock: data stays on this computer.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="icon" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="2.5" y="3" width="11" height="7.5" rx="1" />
      <path d="M1 13h14" stroke-linecap="round" />
      <rect x="6.2" y="6.3" width="3.6" height="2.6" rx="0.4" fill="currentColor" stroke="none" />
      <path d="M6.9 6.4V5.6a1.1 1.1 0 0 1 2.2 0v.8" />
    </svg>
  );
}

export function ReportIcon({ size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
      <path d="M6 2.8h8.5L19 7.3v13.9H6z" />
      <path d="M14.3 2.8v4.6H19M9 12h7M9 15.2h7M9 18.4h4.5" stroke-linecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = 18 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="icon" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

export function ChevronIcon({ size = 12 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="icon" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </svg>
  );
}

export function CheckIcon({ size = 13 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" class="icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}
