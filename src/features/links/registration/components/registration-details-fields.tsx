'use client';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { useLinkRegistration } from '../use-link-registration';

export function RegistrationDetailsFields({
  state,
}: {
  state: ReturnType<typeof useLinkRegistration>['details'];
}) {
  const {
    favorite,
    note,
    descriptionOpen,
    descriptionInput,
    toggleFavorite,
    changeNote,
    toggleDescription,
  } = state;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-list font-medium">즐겨찾기</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="즐겨찾기"
          aria-pressed={favorite}
          onClick={toggleFavorite}
          className={
            favorite
              ? 'text-favorite hover:text-favorite'
              : 'text-muted-foreground'
          }
        >
          <Star
            aria-hidden="true"
            className="size-6"
            fill={favorite ? 'currentColor' : 'none'}
          />
        </Button>
      </div>
      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-3"
          aria-expanded={descriptionOpen}
          aria-controls="description-panel"
          onClick={toggleDescription}
        >
          {descriptionOpen
            ? '설명 접기'
            : note.trim()
              ? '설명 작성됨 · 수정'
              : '+ 설명 추가'}
        </Button>
        <div
          id="description-panel"
          hidden={!descriptionOpen}
          className="space-y-2"
        >
          <label htmlFor="note" className="block text-list font-medium">
            설명
          </label>
          <Textarea
            ref={descriptionInput}
            id="note"
            value={note}
            onChange={(event) => changeNote(event.target.value)}
            placeholder="링크에 대한 설명 (선택)"
            maxLength={2000}
          />
        </div>
      </div>
    </>
  );
}
