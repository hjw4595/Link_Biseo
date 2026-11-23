import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type ActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  'asChild' | 'children'
> & {
  children: ReactNode;
};

/** No wrapper: the parent owns grid/flex layout, widths and outer spacing. */
export function ActionButtons({
  cancel,
  primary,
}: {
  cancel: ActionButtonProps;
  primary: ActionButtonProps;
}) {
  return (
    <>
      <Button type="button" variant="secondary" {...cancel} />
      <Button type="button" {...primary} />
    </>
  );
}
