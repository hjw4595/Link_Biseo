'use client';
import {
  AppSheet,
  AppSheetHeader,
  AppSheetContent,
  AppSheetFooter,
} from '@/components/common/app-sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ActionButtons } from '@/components/common/action-buttons';
import { useLinkRegistration } from '../registration/use-link-registration';
import type { LinkRegistrationOptions } from '../registration/types';
import { RegistrationUrlFields } from '../registration/components/registration-url-fields';
import { RegistrationCategoryFields } from '../registration/components/registration-category-fields';
import { RegistrationDetailsFields } from '../registration/components/registration-details-fields';

export function AddLinkForm(props: LinkRegistrationOptions) {
  const {
    category,
    preview,
    details,
    exit,
    saving,
    apiError,
    handleSubmit,
    submitDisabled,
  } = useLinkRegistration(props);
  return (
    <>
      <AppSheet
        open
        busy={saving}
        onOpenChange={(open) => {
          if (!open) exit.requestClose();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          preview.urlInput.current?.focus();
        }}
        onCloseAutoFocus={exit.restoreTriggerFocus}
      >
        <AppSheetHeader title="링크 등록" />
        <AppSheetContent>
          <form
            id="add-link-form"
            noValidate
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="flex flex-col gap-8 py-4"
            aria-busy={saving}
            aria-describedby={apiError ? 'link-registration-error' : undefined}
          >
            <fieldset disabled={saving} className="min-w-0 space-y-6">
              <RegistrationUrlFields state={preview} />
              <RegistrationCategoryFields state={category} />
              <RegistrationDetailsFields state={details} />
            </fieldset>
          </form>
        </AppSheetContent>
        <AppSheetFooter className="grid-flow-row grid-cols-2">
          {apiError && (
            <p
              id="link-registration-error"
              role="alert"
              className="col-span-2 text-sm text-destructive"
            >
              {apiError}
            </p>
          )}
          <ActionButtons
            cancel={{
              ref: exit.backButton,
              disabled: saving,
              onClick: exit.requestClose,
              children: '취소',
            }}
            primary={{
              type: 'submit',
              form: 'add-link-form',
              loading: saving,
              disabled: submitDisabled,
              children: saving ? '등록 중…' : '링크 등록',
            }}
          />
        </AppSheetFooter>
      </AppSheet>
      <ConfirmDialog
        open={exit.discardOpen}
        onOpenChange={exit.setDiscardOpen}
        title="작성 중인 링크를 버릴까요?"
        description="저장하지 않은 입력은 사라져요."
        confirmLabel="버리고 나가기"
        onConfirm={exit.confirmDiscard}
        onCloseAutoFocus={exit.restoreDiscardFocus}
      />
    </>
  );
}
