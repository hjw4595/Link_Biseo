'use client';
import { useState, type ReactNode } from 'react';
import { safeExternalUrl } from '@/lib/url';

export type OpenMode = 'current' | 'native';
export type OpenTarget = { id: string; url: string; title: string };
export type OpenActivation = (link: OpenTarget, mode: OpenMode) => void;

// Pure UI: preview consumers can omit onActivate and never acquire Auth/API hooks.
export function ExternalLink({
  link,
  onActivate,
  newTab = false,
  className,
  children,
  label,
  busy = false,
  disabled = false,
}: {
  link: OpenTarget;
  onActivate?: OpenActivation;
  newTab?: boolean;
  className?: string;
  children: ReactNode;
  label?: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [unsafe, setUnsafe] = useState(false);
  const safe = safeExternalUrl(link.url);
  const accessibleLabel =
    label ?? `${link.title} 열기${newTab ? ' (새 탭)' : ''}`;
  if (disabled)
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={accessibleLabel}
        className={className}
      >
        {children}
      </span>
    );
  if (!safe)
    return (
      <span className="min-w-0 flex-1">
        <button
          type="button"
          className={className}
          aria-label={accessibleLabel}
          onClick={() => setUnsafe(true)}
        >
          {children}
        </button>
        {unsafe && (
          <span role="alert" className="block text-meta text-destructive">
            안전하게 열 수 없는 URL이에요.
          </span>
        )}
      </span>
    );
  return (
    <a
      data-external-link=""
      href={safe.href}
      target={newTab ? '_blank' : undefined}
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={className}
      aria-label={accessibleLabel}
      aria-busy={busy || undefined}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.altKey)
          return;
        const native =
          newTab || event.ctrlKey || event.metaKey || event.shiftKey;
        if (onActivate) {
          if (!native) event.preventDefault();
          onActivate(link, native ? 'native' : 'current');
        }
      }}
      onAuxClick={(event) => {
        if (!event.defaultPrevented && event.button === 1 && !event.altKey)
          onActivate?.(link, 'native');
      }}
    >
      {children}
    </a>
  );
}
