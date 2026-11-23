'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  MAX_SELECTION,
  PREVIEW_PAGE_SIZE,
  type Eligibility,
  type ImportItem,
} from '../types';

const labels: Record<Eligibility, string> = {
  ready: '신규 후보',
  duplicate_in_file: '파일 내부 중복',
  duplicate_existing: '기존 링크 중복',
  invalid: '유효하지 않은 링크',
  comparison_unverified: '비교 미검증',
};

export function ImportPreview({
  items,
  complete,
  selected,
  onSelect,
  onSelectAll,
}: {
  items: ImportItem[];
  complete: boolean;
  selected: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const visible = items.filter(
    (item) => filter === 'all' || filter === item.eligibility,
  );
  const pages = Math.max(1, Math.ceil(visible.length / PREVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const ready = items.filter((item) => item.eligibility === 'ready').length;
  return (
    <section aria-label="북마크 미리보기" className="min-w-0 space-y-5">
      <h2 className="font-semibold">분석 결과</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm" aria-label="분석 집계">
        <div>
          <dt>발견한 링크 총수</dt>
          <dd>{items.length}개</dd>
        </div>
        {Object.entries(labels).map(([key, label]) => (
          <div key={key}>
            <dt>
              {key === 'ready' && !complete
                ? '기존 저장 여부 확인 대기'
                : label}
            </dt>
            <dd>
              {key === 'duplicate_existing' && !complete
                ? '확인 전'
                : `${items.filter((item) => item.eligibility === key).length}개`}
            </dd>
          </div>
        ))}
      </dl>
      {!items.length && <p role="status">북마크가 없어요.</p>}
      {!!items.length &&
        !items.some(
          (item) =>
            item.eligibility === 'ready' ||
            item.eligibility.startsWith('duplicate'),
        ) && (
          <p role="status">
            가져올 수 있는 링크가 없어요. 제외 사유를 확인하세요.
          </p>
        )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!complete || !ready}
          onClick={() => onSelectAll(true)}
        >
          {ready > MAX_SELECTION ? '앞에서 50개 선택' : '전체 선택'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!selected.size}
          onClick={() => onSelectAll(false)}
        >
          선택 해제
        </Button>
      </div>
      <p
        id="selection-limit"
        role="status"
        className="text-meta text-muted-foreground"
      >
        선택 {selected.size}개 / 최대 50개. 중복과 비교 미검증 항목은 선택할 수
        없어요.
      </p>
      <div className="space-y-2">
        <label htmlFor="import-filter">항목 필터</label>
        <select
          id="import-filter"
          className="field-control w-full"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
        >
          <option value="all">전체 항목</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {key === 'ready' && !complete
                ? '기존 저장 여부 확인 대기'
                : label}
            </option>
          ))}
        </select>
      </div>
      <ul aria-label="북마크 항목" className="space-y-3">
        {visible
          .slice(
            currentPage * PREVIEW_PAGE_SIZE,
            (currentPage + 1) * PREVIEW_PAGE_SIZE,
          )
          .map((item) => {
            const disabled =
              !complete ||
              item.eligibility !== 'ready' ||
              (!selected.has(item.localId) && selected.size >= MAX_SELECTION);
            return (
              <li
                key={item.localId}
                className="min-w-0 rounded-lg border border-border p-3 text-sm"
              >
                <label className="flex min-h-11 min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    checked={selected.has(item.localId)}
                    disabled={disabled}
                    aria-label={`${item.sourceIndex + 1}번 북마크 선택`}
                    aria-describedby="selection-limit"
                    onChange={(event) =>
                      onSelect(item.localId, event.target.checked)
                    }
                  />
                  <span className="line-clamp-2 min-w-0 break-all font-medium">
                    {item.originalTitle || '제목 없음'}
                  </span>
                </label>
                <p className="break-all text-muted-foreground">
                  {item.domain ?? '도메인 확인 불가'}
                </p>
                <p className="break-all">
                  폴더: {item.folderPath.join(' / ') || '폴더 없음'}
                </p>
                <p className="font-medium">
                  {item.eligibility === 'ready' && !complete
                    ? '기존 저장 여부 확인 대기'
                    : labels[item.eligibility]}
                </p>
                {item.eligibility === 'duplicate_in_file' && (
                  <p className="text-muted-foreground">
                    파일의 앞선 항목과 서버 저장 기준으로 같은 링크예요.
                  </p>
                )}
                {item.eligibility === 'invalid' && (
                  <p className="text-muted-foreground">
                    올바른 HTTP(S) URL만 지원해요.
                  </p>
                )}
                {item.eligibility === 'comparison_unverified' && (
                  <p className="text-muted-foreground">
                    서버와 같은 비교 결과를 확인하지 못해 제외했어요.
                  </p>
                )}
                {item.hasHash && (
                  <p className="text-muted-foreground">
                    현재 서버 저장 방식은 # 뒤 위치 정보를 저장하지 않아요.
                  </p>
                )}
                {item.titleWarning && (
                  <p className="text-muted-foreground">
                    등록 시 제목이 200자 이내로 줄어들거나 생략돼요. 위에는 원본
                    제목을 표시해요.
                  </p>
                )}
                <details className="mt-2 min-w-0">
                  <summary className="cursor-pointer py-2">
                    원본 URL 보기
                  </summary>
                  <p className="break-all">{item.originalUrl || 'URL 없음'}</p>
                </details>
              </li>
            );
          })}
      </ul>
      {items.length > 0 && !visible.length && (
        <p role="status">이 상태의 항목은 없어요.</p>
      )}
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
        aria-label="미리보기 페이지"
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          이전 25개
        </Button>
        <span role="status">
          {currentPage + 1} / {pages} 페이지
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={currentPage + 1 >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          다음 25개
        </Button>
      </div>
    </section>
  );
}
