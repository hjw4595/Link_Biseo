'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePresetMutation } from '@/lib/query/quick-launch';
import { presetErrorMessage } from '@/lib/api/quick-launch';
import {
  PRESET_LINK_LIMIT,
  validPresetMembers,
  validPresetName,
  type PresetDetail,
} from '@/contracts/quick-launch';
import type { LinkResponse } from '@/contracts/links';
import { PresetLinkPicker } from './preset-link-picker';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ReorderControls } from '@/components/common/reorder-controls';
import { AppSheetContent, AppSheetFooter } from '@/components/common/app-sheet';

export function PresetEditor({
  preset,
  onClose,
  closeRequestRef,
}: {
  preset?: PresetDetail;
  onClose: (message?: string) => void;
  closeRequestRef: RefObject<(() => void) | null>;
}) {
  const [initial] = useState(
    () =>
      preset?.links
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => row.link) ?? [],
  );
  const [name, setName] = useState(preset?.name ?? '');
  const [selected, setSelected] = useState<LinkResponse[]>(initial);
  const [step, setStep] = useState<'edit' | 'select'>('edit');
  const [confirmation, setConfirmation] = useState<'discard' | 'delete' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const mutation = usePresetMutation();
  const pending = useRef(false);
  const leaving = useRef(false);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const editorRegion = useRef<HTMLDivElement>(null);
  const lastEditorFocus = useRef<HTMLElement | null>(null);
  const dirty =
    name !== (preset?.name ?? '') ||
    selected.map((l) => l.id).join() !== initial.map((l) => l.id).join();
  const legacy = initial.length > PRESET_LINK_LIMIT;
  const count =
    selected.length > PRESET_LINK_LIMIT
      ? `현재 ${selected.length}개 · 신규 최대 8개`
      : `${selected.length}/8`;
  useEffect(() => {
    closeRequestRef.current = () => {
      if (pending.current) return;
      if (dirty) {
        const active = document.activeElement;
        dialogTrigger.current =
          active instanceof HTMLElement && active.closest('[data-app-sheet]')
            ? active
            : lastEditorFocus.current;
        setConfirmation('discard');
      } else onClose();
    };
    return () => {
      closeRequestRef.current = null;
    };
  }, [closeRequestRef, dirty, onClose]);
  function move(index: number, offset: number) {
    setSelected((old) => {
      const next = [...old],
        current = next[index],
        other = next[index + offset];
      if (!current || !other) return old;
      next[index] = other;
      next[index + offset] = current;
      return next;
    });
  }
  async function save() {
    if (
      pending.current ||
      !validPresetName(name) ||
      !validPresetMembers(
        selected.map((l) => l.id),
        initial.map((l) => l.id),
      )
    )
      return;
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({
        type: 'save',
        id: preset?.id,
        input: { name: name.trim(), linkIds: selected.map((l) => l.id) },
      });
      onClose();
    } catch (reason) {
      setError(presetErrorMessage(reason));
    } finally {
      pending.current = false;
    }
  }
  async function remove() {
    if (!preset || pending.current) return false;
    pending.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ type: 'delete', id: preset.id });
      leaving.current = true;
      onClose('빠른 실행이 삭제됐어요.');
      return true;
    } catch (reason) {
      setError(presetErrorMessage(reason));
      return false;
    } finally {
      pending.current = false;
    }
  }
  return (
    <div
      ref={editorRegion}
      className="flex min-h-0 flex-1 flex-col"
      onFocusCapture={(event) => {
        // React portals bubble through this tree too; retain only DOM-local editor focus.
        if (
          event.target instanceof HTMLElement &&
          event.currentTarget.contains(event.target)
        )
          lastEditorFocus.current = event.target;
      }}
    >
      {step === 'select' ? (
        <PresetLinkPicker
          selected={selected}
          legacy={legacy}
          add={(link) =>
            setSelected((old) =>
              old.some((l) => l.id === link.id) || old.length >= 8 || legacy
                ? old
                : [...old, link],
            )
          }
          back={() => setStep('edit')}
        />
      ) : (
        <>
          <AppSheetContent>
            <fieldset
              disabled={mutation.isPending}
              className="min-w-0 space-y-4"
            >
              <label className="block space-y-2">
                이름
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <p className="text-meta text-muted-foreground">
                이름은 앞뒤 공백을 제외하고 1~100자예요. 같은 이름도 사용할 수
                있어요.
              </p>
              {name.length > 0 && !validPresetName(name) && (
                <p role="alert">
                  이름을 1~100자로 입력하고 올바르지 않은 문자를 제거해 주세요.
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {preset ? '포함된 링크' : '포함할 링크'}
                </h3>
                <p
                  aria-live="polite"
                  className="text-meta text-muted-foreground"
                >
                  {count}
                </p>
              </div>
              {legacy && (
                <p className="text-meta text-muted-foreground">
                  기존 링크는 유지돼요. 새 링크를 추가하려면 8개 이하로 줄여
                  먼저 저장해 주세요.
                </p>
              )}
              <ol className="divide-y" aria-label="선택한 링크 순서">
                {selected.map((link, index) => (
                  <li key={link.id} className="min-w-0 py-3">
                    <p className="line-clamp-2 [overflow-wrap:anywhere]">
                      {link.title}
                    </p>
                    <p className="truncate text-meta text-muted-foreground">
                      {link.domain}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <ReorderControls
                        itemLabel={link.title}
                        canMoveUp={index > 0}
                        canMoveDown={index < selected.length - 1}
                        disabled={mutation.isPending}
                        onMoveUp={() => move(index, -1)}
                        onMoveDown={() => move(index, 1)}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${link.title} 포함된 링크에서 제거`}
                        onClick={() =>
                          setSelected((old) =>
                            old.filter((l) => l.id !== link.id),
                          )
                        }
                      >
                        제거
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setStep('select')}
              >
                + 링크 추가
              </Button>
              <p className="text-meta text-muted-foreground">
                링크 없이도 저장할 수 있어요. 여기서 제거해도 원본 링크는
                유지돼요.
              </p>
              {preset && (
                <Button
                  variant="ghost"
                  onClick={(event) => {
                    dialogTrigger.current = event.currentTarget;
                    setError(null);
                    setConfirmation('delete');
                  }}
                >
                  빠른 실행 삭제
                </Button>
              )}
              {error && (
                <p role="alert">
                  {error} 입력은 유지됩니다. 저장 여부가 불확실하면 닫은 후
                  목록을 다시 확인해 주세요.
                </p>
              )}
            </fieldset>
          </AppSheetContent>
          <AppSheetFooter>
            <Button
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => closeRequestRef.current?.()}
            >
              취소
            </Button>
            <Button
              disabled={!validPresetName(name)}
              loading={mutation.isPending}
              onClick={() => void save()}
            >
              {preset ? '변경 저장' : '추가'}
            </Button>
          </AppSheetFooter>
        </>
      )}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={
          confirmation === 'delete'
            ? `'${preset?.name ?? name}'을 삭제할까요?`
            : '저장하지 않은 변경사항을 버릴까요?'
        }
        description={
          confirmation === 'delete' ? (
            <>
              이 빠른 실행이 삭제됩니다.
              <br />내 링크에 저장된 링크는 그대로 유지돼요.
            </>
          ) : (
            '저장하지 않은 변경사항이 사라집니다.'
          )
        }
        variant="destructive"
        confirmLabel={
          confirmation === 'delete' ? '빠른 실행 삭제' : '변경사항 버리기'
        }
        cancelLabel={confirmation === 'delete' ? '취소' : '계속 편집'}
        pending={mutation.isPending}
        error={confirmation === 'delete' ? error : undefined}
        onConfirm={() => {
          if (confirmation === 'delete') return remove();
          leaving.current = true;
          onClose();
          return true;
        }}
        onCloseAutoFocus={(event) => {
          if (leaving.current) event.preventDefault();
          else if (
            dialogTrigger.current?.isConnected &&
            dialogTrigger.current.closest('[data-app-sheet]')
          ) {
            event.preventDefault();
            dialogTrigger.current.focus();
          } else {
            const fallback = editorRegion.current?.querySelector<HTMLElement>(
              'input:not(:disabled),button:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
            );
            if (fallback) {
              event.preventDefault();
              fallback.focus();
            }
          }
        }}
      />
    </div>
  );
}
