import type { ReactNode, Ref } from 'react';

/** Section-level h2 with an optional action. Page h1 and compact headings stay separate. */
export function SectionHeader({
  title,
  id,
  action,
  headingRef,
  focusable = false,
}: {
  title: ReactNode;
  id: string;
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  focusable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        id={id}
        ref={headingRef}
        tabIndex={focusable ? -1 : undefined}
        className="text-base font-semibold"
      >
        {title}
      </h2>
      {action}
    </div>
  );
}
