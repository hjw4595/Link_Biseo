'use client';
import { useState, type ReactNode } from 'react';
import { safeExternalUrl } from '@/lib/url';
import {
  useIncognito,
  isIncognitoActive,
} from '@/features/link-launch/provider';

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
  const { controller, incognito } = useIncognito();
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
  // No href in secret mode: native modifier/middle/context-menu opening must
  // not create a regular tab alongside the extension. Preview links stay native.
  if (incognito && onActivate)
    return (
      <button
        type="button"
        data-external-link=""
        className={`${className ?? ''} text-left`}
        aria-label={accessibleLabel}
        aria-busy={busy || undefined}
        onClick={(event) => {
          if (event.defaultPrevented || event.altKey) return;
          event.preventDefault();
          onActivate(link, 'current');
        }}
        onMouseDown={(event) => {
          // Buttons can enter platform autoscroll without emitting auxclick.
          if (event.button === 1) event.preventDefault();
        }}
        onMouseUp={(event) => {
          if (event.defaultPrevented || event.button !== 1 || event.altKey)
            return;
          event.preventDefault();
          onActivate(link, 'current');
        }}
        onAuxClick={(event) => event.preventDefault()}
      >
        {children}
      </button>
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
          const secret = isIncognitoActive(controller);
          if (!native || secret) event.preventDefault();
          onActivate(link, native && !secret ? 'native' : 'current');
        }
      }}
      onAuxClick={(event) => {
        if (!event.defaultPrevented && event.button === 1 && !event.altKey) {
          if (onActivate && isIncognitoActive(controller))
            event.preventDefault();
          onActivate?.(link, 'native');
        }
      }}
    >
      {children}
    </a>
  );
}
