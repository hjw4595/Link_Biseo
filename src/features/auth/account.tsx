'use client';
import { accountConnection } from './account-connection';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { UserRound } from 'lucide-react';
import { RequestError } from '@/components/common/request-error';
import { createClient } from '@/lib/supabase/client';
import { getAuthMe } from '@/lib/api/auth';
import { useAuth } from './auth-provider';

function profileText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
function avatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function Account() {
  const { user } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.auth(user.id),
    queryFn: ({ signal }) => getAuthMe(createClient(), user.id, signal),
  });
  const avatar = avatarUrl(user.user_metadata.avatar_url);
  const name =
    profileText(user.user_metadata.full_name) ||
    profileText(user.user_metadata.name) ||
    '내 계정';
  const connection = accountConnection(user);
  return (
    <section aria-label="계정" className="space-y-6">
      <h2 className="font-semibold">계정</h2>
      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-surface p-4 sm:gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-muted-foreground">
          {avatar && !avatarFailed ? (
            // Arbitrary OAuth avatar hosts are not proxied through Next Image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <UserRound aria-hidden="true" className="size-6" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium [overflow-wrap:anywhere]">{name}</p>
          {user.email && (
            <p
              title={user.email}
              className="truncate text-sm text-muted-foreground"
            >
              {user.email}
            </p>
          )}
        </div>
        {connection && (
          <span
            aria-label="계정 연결 수단"
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
          >
            {connection}
          </span>
        )}
      </div>
      {query.isPending && !retrying && (
        <p role="status" className="sr-only">
          계정 정보를 확인하고 있어요.
        </p>
      )}
      {(query.error || retrying) && (
        <RequestError
          text="계정 정보를 확인하지 못했어요."
          retrying={retrying || query.isFetching}
          retry={() => {
            if (retrying || query.isFetching) return;
            setRetrying(true);
            // Keep the error/retry affordance mounted while TanStack resets error state.
            void query.refetch().then(
              () => setRetrying(false),
              () => setRetrying(false),
            );
          }}
        />
      )}
    </section>
  );
}
