'use client';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LinkFavicon } from '../../components/link-favicon';
import type { useRegistrationPreview } from '../use-registration-preview';

export function RegistrationUrlFields({
  state,
}: {
  state: ReturnType<typeof useRegistrationPreview>;
}) {
  const {
    url,
    parsed,
    normalized,
    previewUrl,
    preview,
    metadata,
    displayedTitle,
    urlError,
    urlInput,
    changeUrl,
    blurUrl,
    changeTitle,
  } = state;
  return (
    <>
      <div className="space-y-2">
        <label htmlFor="link-url" className="block text-list font-medium">
          URL
        </label>
        <Input
          ref={urlInput}
          id="link-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://example.com"
          value={url}
          onChange={(event) => changeUrl(event.target.value)}
          onBlur={blurUrl}
          required
          maxLength={2048}
          aria-invalid={urlError}
          aria-describedby={urlError ? 'url-error' : undefined}
        />
        {urlError && (
          <p id="url-error" role="alert" className="text-meta text-destructive">
            올바른 URL을 입력해 주세요.
          </p>
        )}
      </div>
      {parsed && (
        <section
          aria-label="링크 미리보기"
          className="surface-card space-y-5 p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <LinkFavicon
              key={metadata?.faviconUrl ?? normalized}
              src={metadata?.faviconUrl ?? null}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">링크 미리보기</p>
              <p className="truncate text-meta text-muted-foreground">
                {parsed.hostname}
              </p>
            </div>
            {previewUrl === normalized && preview.isFetching && (
              <span role="status" aria-label="제목 정보 불러오는 중">
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin text-muted-foreground"
                />
              </span>
            )}
          </div>
          <div className="space-y-2">
            <label
              htmlFor="custom-title"
              className="block text-list font-medium"
            >
              제목
            </label>
            <Input
              id="custom-title"
              value={displayedTitle}
              placeholder="링크 제목 (선택)"
              maxLength={200}
              onChange={(event) => changeTitle(event.target.value)}
            />
            {previewUrl === normalized &&
              (preview.isError || metadata?.status === 'failed') && (
                <p role="status" className="text-meta text-muted-foreground">
                  제목 정보를 가져오지 못했어요.
                </p>
              )}
          </div>
        </section>
      )}
    </>
  );
}
