'use client';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequestError } from '@/components/common/request-error';
import { CategorySelect } from '@/features/categories/components/category-select';
import { categoryErrorMessage } from '@/features/categories/errors';
import {
  draftPrefix,
  type useRegistrationCategory,
} from '../use-registration-category';

export function RegistrationCategoryFields({
  state,
}: {
  state: ReturnType<typeof useRegistrationCategory>;
}) {
  const {
    query,
    categories,
    categoryId,
    drafts,
    categoryOpen,
    newCategory,
    categoryError,
    categoryEdited,
    entryCategory,
    invalidInitialCategory,
    categoryInput,
    newCategoryInput,
    categoryTrigger,
    closeCategory,
    addCategory,
    toggleCategory,
    changeCategory,
    changeName,
  } = state;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="category" className="text-list font-medium">
          카테고리
        </label>
        <Button
          ref={categoryTrigger}
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={categoryOpen}
          aria-controls="new-category-panel"
          disabled={query.isPending || query.isError}
          onClick={toggleCategory}
        >
          {categoryOpen ? (
            '취소'
          ) : (
            <>
              <Plus aria-hidden="true" className="size-4" />새 카테고리
            </>
          )}
        </Button>
      </div>
      <CategorySelect
        ref={categoryInput}
        id="category"
        categories={categories}
        retainedOption={
          categoryId &&
          !categoryId.startsWith(draftPrefix) &&
          entryCategory === null
            ? { id: categoryId, label: '카테고리 확인 중' }
            : undefined
        }
        value={categoryId}
        onChange={(event) => changeCategory(event.target.value)}
        aria-describedby={
          invalidInitialCategory ? 'initial-category-status' : undefined
        }
      >
        {drafts.map((name) => (
          <option key={name} value={draftPrefix + name}>
            {name}
          </option>
        ))}
      </CategorySelect>
      {query.isPending && (
        <p role="status" className="text-meta text-muted-foreground">
          카테고리를 불러오고 있어요.
        </p>
      )}
      {query.error && (
        <RequestError
          text={categoryErrorMessage(query.error)}
          retry={() => {
            void query.refetch();
          }}
        />
      )}
      {invalidInitialCategory && (
        <p
          id="initial-category-status"
          role="status"
          className="text-meta break-words text-muted-foreground"
        >
          {categoryEdited
            ? '처음 선택한 카테고리를 찾을 수 없어요. 현재 선택한 카테고리로 저장해요.'
            : '선택한 카테고리를 찾을 수 없어 미분류로 변경했어요.'}
        </p>
      )}
      {categoryOpen && (
        <div
          id="new-category-panel"
          className="space-y-3 rounded-sm border p-4"
        >
          <label htmlFor="new-category" className="block text-list font-medium">
            새 카테고리 이름
          </label>
          <Input
            ref={newCategoryInput}
            id="new-category"
            maxLength={100}
            value={newCategory}
            onChange={(event) => changeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                addCategory();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeCategory();
              }
            }}
            aria-invalid={!!categoryError}
            aria-describedby={categoryError ? 'category-error' : undefined}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeCategory}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addCategory}
            >
              추가
            </Button>
          </div>
        </div>
      )}
      {categoryError && (
        <p
          id="category-error"
          role="alert"
          className="text-meta text-destructive"
        >
          {categoryError}
        </p>
      )}
    </div>
  );
}
