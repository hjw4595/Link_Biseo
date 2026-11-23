'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CategoryResponse } from '@/contracts/categories';
import {
  folderGroups,
  uncategorized,
  type MappingConfig,
  type MappingPlan,
} from '../folder-mapping';
import type { ImportItem } from '../types';

export function FolderMapping({
  items,
  selected,
  config,
  plan,
  categories,
  disabled,
  onChange,
  onSelectGroup,
}: {
  items: ImportItem[];
  selected: Set<string>;
  config: MappingConfig;
  plan: MappingPlan;
  categories: CategoryResponse[];
  disabled: boolean;
  onChange: (config: MappingConfig) => void;
  onSelectGroup: (ids: string[], checked: boolean) => void;
}) {
  const [page, setPage] = useState(0);
  const groups = folderGroups(items, selected);
  const pages = Math.max(1, Math.ceil(groups.length / 25));
  const currentPage = Math.min(page, pages - 1);
  return (
    <section className="min-w-0 space-y-3" aria-label="폴더별 카테고리 매핑">
      <h2 className="font-semibold">카테고리 매핑</h2>
      <label className="block space-y-1">
        분류 방식
        <select
          aria-label="분류 방식"
          className="field-control w-full"
          value={config.mode}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...config,
              mode: event.target.value === 'single' ? 'single' : 'folders',
            })
          }
        >
          <option value="folders">폴더별 매핑</option>
          <option value="single">모든 링크에 동일 카테고리</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        분류 방식별 설정은 이 화면에만 유지돼요. 아래 최종 확인에 표시된 설정만
        실행해요.
      </p>
      {config.mode === 'single' ? (
        <label className="block space-y-1">
          카테고리 선택
          <select
            aria-label="카테고리 선택"
            className="field-control w-full"
            value={config.singleId}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...config, singleId: event.target.value })
            }
          >
            <option value="">미분류</option>
            {config.singleId &&
              !categories.some(
                (category) => category.id === config.singleId,
              ) && (
                <option value={config.singleId}>
                  삭제된 카테고리 — 다시 선택하세요
                </option>
              )}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...config,
              targets: Object.fromEntries(
                groups.map((group) => [group.key, uncategorized]),
              ),
            })
          }
        >
          모든 폴더 미분류
        </Button>
      )}
      <p role="status" className="text-sm">
        등록 후보 {groups.reduce((sum, group) => sum + group.items.length, 0)}개
        중 선택 {selected.size}개 · 미선택{' '}
        {groups.reduce((sum, group) => sum + group.items.length, 0) -
          selected.size}
        개. 폴더 전체 선택도 최대 50개까지만 적용해요.
      </p>
      <ul className="space-y-3" aria-label="원본 폴더 그룹">
        {groups
          .slice(currentPage * 25, (currentPage + 1) * 25)
          .map((group, offset) => {
            const ordinal = currentPage * 25 + offset + 1;
            const target = config.targets[group.key] ?? uncategorized;
            const row = plan.rows.find((row) => row.key === group.key);
            const setTarget = (value: typeof target) =>
              onChange({
                ...config,
                targets: { ...config.targets, [group.key]: value },
              });
            const inputId = `folder-category-name-${ordinal}`;
            return (
              <li
                key={group.key}
                className="min-w-0 space-y-2 rounded-lg border p-3"
              >
                <h3 className="break-all font-medium">
                  {ordinal}. {group.label}
                </h3>
                {group.repeatedPath && (
                  <p className="text-sm">
                    같은 경로의 별도 폴더예요. 폴더 {ordinal}로 따로 매핑해요.
                  </p>
                )}
                <p className="text-sm">
                  선택 {group.selected}개 / 등록 후보 {group.items.length}개 ·
                  미선택 {group.items.length - group.selected}개
                </p>
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`폴더 ${ordinal} 전체 선택`}
                    disabled={disabled}
                    checked={group.selected === group.items.length}
                    ref={(node) => {
                      if (node)
                        node.indeterminate =
                          group.selected > 0 &&
                          group.selected < group.items.length;
                    }}
                    onChange={(event) =>
                      onSelectGroup(
                        group.items.map((item) => item.localId),
                        event.target.checked,
                      )
                    }
                  />
                  폴더 전체 선택
                </label>
                {config.mode === 'folders' && (
                  <>
                    <label className="block space-y-1">
                      폴더 {ordinal} 대상 카테고리
                      <select
                        aria-label={`폴더 ${ordinal} 대상 카테고리`}
                        className="field-control w-full"
                        disabled={disabled || !group.selected}
                        value={
                          target.kind === 'existing' ? target.id : target.kind
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          setTarget(
                            value === 'create'
                              ? {
                                  kind: 'create',
                                  name: group.path.at(-1) ?? '',
                                }
                              : value === 'uncategorized'
                                ? uncategorized
                                : { kind: 'existing', id: value },
                          );
                        }}
                      >
                        <option value="uncategorized">미분류</option>
                        <option value="create">새 카테고리 생성 예약</option>
                        {target.kind === 'existing' &&
                          !categories.some(
                            (category) => category.id === target.id,
                          ) && (
                            <option value={target.id}>
                              삭제된 카테고리 — 다시 선택하세요
                            </option>
                          )}
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {target.kind === 'create' && (
                      <>
                        <label htmlFor={inputId}>
                          폴더 {ordinal} 새 카테고리 이름
                        </label>
                        <Input
                          id={inputId}
                          value={target.name}
                          disabled={disabled || !group.selected}
                          aria-invalid={!!row?.error}
                          onChange={(event) =>
                            setTarget({
                              kind: 'create',
                              name: event.target.value,
                            })
                          }
                        />
                        <p className="text-sm">
                          아직 생성하지 않았어요. 이름을 확인한 뒤 최종
                          가져오기를 실행하세요.
                        </p>
                        {target.reviewRequired && (
                          <Button
                            variant="secondary"
                            disabled={disabled}
                            onClick={() =>
                              setTarget({ kind: 'create', name: target.name })
                            }
                          >
                            생성 예약 다시 확인
                          </Button>
                        )}
                      </>
                    )}
                    <p
                      className="break-all text-sm"
                      role={row?.error ? 'alert' : undefined}
                    >
                      {group.selected
                        ? (row?.error ?? `매핑 준비됨: ${row?.description}`)
                        : '선택된 링크가 없어 카테고리를 생성하지 않아요.'}
                    </p>
                  </>
                )}
              </li>
            );
          })}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            이전 폴더
          </Button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <Button
            variant="secondary"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            다음 폴더
          </Button>
        </div>
      )}
      {config.mode === 'single' && plan.rows[0]?.error && (
        <p role="alert">{plan.rows[0].error}</p>
      )}
    </section>
  );
}
