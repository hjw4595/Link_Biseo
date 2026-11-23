'use client';

import { Accordion as Primitive } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Accordion = Primitive.Root;
export const AccordionItem = Primitive.Item;

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Header>
      <Primitive.Trigger
        {...props}
        className={cn(
          'flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 [&[data-state=open]>svg]:rotate-180',
          className,
        )}
      >
        <span>{children}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform motion-reduce:transition-none"
        />
      </Primitive.Trigger>
    </Primitive.Header>
  );
}

export function AccordionContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      {...props}
      className={cn(
        'px-4 pb-4 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]',
        className,
      )}
    />
  );
}
