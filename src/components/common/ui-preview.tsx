'use client';
import { useState } from 'react';
import { DialogPreview } from './dialog-preview';
import { AppSheetPreview } from './app-sheet-preview';
import { TopBar } from './top-bar';
import { EmptyState } from './empty-state';
import { LoadingState } from './loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { CategoryBento } from '@/features/categories/components/category-bento';
import { LinkList } from '@/features/links/components/link-list';
import { useDemo } from '@/lib/mock/demo-provider';

const colors = [
  ['Outside', 'bg-outside'],
  ['Background', 'bg-background'],
  ['Surface', 'bg-surface'],
  ['Raised', 'bg-surface-raised'],
  ['Primary text', 'bg-foreground'],
  ['Secondary text', 'bg-muted-foreground'],
  ['Disabled', 'bg-disabled'],
  ['Accent', 'bg-accent'],
  ['Accent subtle', 'bg-accent-subtle'],
  ['Accent hover', 'bg-accent-hover'],
  ['Border', 'bg-border'],
  ['Danger', 'bg-destructive'],
];

export function UiPreview() {
  const { categories, links, toggleFavorite } = useDemo();
  const [tab, setTab] = useState('all');
  return (
    <>
      <TopBar title="UI Preview · 개발 전용" backHref="/" />
      <div className="screen-content">
        <h1 className="text-hero font-semibold">링크비서 디자인 시스템</h1>
        <DialogPreview />
        <AppSheetPreview />
        <section className="space-y-4">
          <h2 className="text-base font-semibold">컬러 토큰</h2>
          <ul className="grid grid-cols-3 gap-3">
            {colors.map(([name, className]) => (
              <li key={name} className="space-y-2">
                <div className={`h-12 rounded-sm border ${className}`} />
                <p className="text-meta text-muted-foreground">{name}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Typography</h2>
          <p className="text-hero font-semibold">요즘 관심 있는 것</p>
          <p className="text-base font-semibold">섹션 제목 16px</p>
          <p className="text-list font-medium">리스트 제목 15px</p>
          <p>본문 14px · 조용하고 정돈된 개인 비서</p>
          <p className="text-meta text-muted-foreground">
            도메인 / 보조 정보 12px
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Button</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Input states</h2>
          <label className="block space-y-2">
            <span>기본 입력</span>
            <Input placeholder="내용을 입력하세요" />
          </label>
          <label className="block space-y-2">
            <span>URL</span>
            <Input type="url" placeholder="https://" />
          </label>
          <label className="block space-y-2">
            <span>검색</span>
            <Input type="search" placeholder="링크 검색" />
          </label>
          <label className="block space-y-2">
            <span>오류 입력</span>
            <Input
              aria-invalid="true"
              aria-describedby="preview-error"
              defaultValue="잘못된 URL"
            />
          </label>
          <p id="preview-error" className="text-destructive">
            올바른 URL을 입력해주세요.
          </p>
          <label className="block space-y-2">
            <span>비활성 입력</span>
            <Input disabled placeholder="사용할 수 없어요" />
          </label>
          <label className="block space-y-2">
            <span>메모</span>
            <Textarea placeholder="메모를 남겨보세요" />
          </label>
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Tabs / LinkItem</h2>
          <FilterTabs
            label="미리보기 필터"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: 'all', label: '전체' },
              { value: 'favorites', label: '즐겨찾기' },
            ]}
          >
            <LinkList
              onFavorite={(link) => toggleFavorite(link.id)}
              links={
                tab === 'favorites'
                  ? links.filter((link) => link.favorite)
                  : links
              }
            />
          </FilterTabs>
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">CategoryBento · 5개</h2>
          <CategoryBento categories={categories} />
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">CategoryBento · 2개</h2>
          <CategoryBento categories={categories.slice(0, 2)} />
        </section>
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Empty / Loading / Error</h2>
          <EmptyState
            title="아직 링크가 없어요"
            description="관심 있는 링크를 하나씩 모아보세요."
          />
          <LoadingState text="불러오는 중…" />
          <p role="alert" className="text-destructive">
            연결하지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        </section>
      </div>
    </>
  );
}
