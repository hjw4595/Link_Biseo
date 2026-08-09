'use client';
import { DropdownMenu as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-40 rounded-md border bg-surface p-1 text-sm text-foreground shadow-lg',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 outline-none data-[disabled]:pointer-events-none data-[disabled]:text-disabled data-[highlighted]:bg-surface-raised',
        className,
      )}
      {...props}
    />
  );
}
