'use client';
import { useEffect, useRef, useState } from 'react';
import { useLinkPreview } from '../query/queries';
import { createLinkUrl } from '../create-url';

export function useRegistrationPreview() {
  const [url, setUrl] = useState('');
  const parsed = createLinkUrl(url);
  const normalized = parsed?.href ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const preview = useLinkPreview(previewUrl);
  const [title, setTitle] = useState<{
    url: string | null;
    value: string;
    edited: boolean;
  }>({ url: null, value: '', edited: false });
  // A title belongs to its URL. Old responses and old user titles never migrate to another URL.
  const metadata = normalized === previewUrl ? preview.data : undefined;
  const displayedTitle =
    title.url === normalized && title.edited
      ? title.value
      : (metadata?.title?.slice(0, 200) ?? '');
  const [urlError, setUrlError] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewUrl(normalized), 400);
    return () => window.clearTimeout(timer);
  }, [normalized]);
  return {
    url,
    parsed,
    normalized,
    previewUrl,
    preview,
    metadata,
    displayedTitle,
    urlError,
    urlInput,
    changeUrl(value: string) {
      setUrl(value);
      setUrlError(false);
    },
    blurUrl() {
      setUrl(url.trim());
      setUrlError(!!url.trim() && !parsed);
    },
    changeTitle(value: string) {
      setTitle({ url: normalized, value, edited: true });
    },
    reportInvalid() {
      setUrlError(true);
      urlInput.current?.focus();
    },
  };
}
