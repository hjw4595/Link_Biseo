'use client';
import { Tabs } from 'radix-ui';
import type { ReactNode } from 'react';

type FilterTabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  label: string;
  children: ReactNode;
  toolbarEnd?: ReactNode;
};
export function FilterTabs({
  value,
  onValueChange,
  options,
  label,
  children,
  toolbarEnd,
}: FilterTabsProps) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <Tabs.List aria-label={label} className="flex gap-6 border-b">
          {options.map((option) => (
            <Tabs.Trigger
              key={option.value}
              value={option.value}
              className="min-h-12 border-b-2 border-transparent px-1 text-list text-muted-foreground data-[state=active]:border-accent data-[state=active]:text-foreground"
            >
              {option.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {toolbarEnd}
      </div>
      {options.map((option) => (
        <Tabs.Content key={option.value} value={option.value} className="pt-4">
          {children}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
