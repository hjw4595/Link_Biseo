'use client';
import Image from 'next/image';
import { Globe2 } from 'lucide-react';
import { useState } from 'react';
import { safeExternalUrl } from '../utils';

export function LinkFavicon({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  const source =
    src && (/^\/favicons\/[a-zA-Z0-9._-]+$/.test(src) || safeExternalUrl(src))
      ? src
      : null;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-accent-subtle text-accent">
      {source && !failed ? (
        <Image
          src={source}
          referrerPolicy="no-referrer"
          alt=""
          width={32}
          height={32}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe2 className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}
