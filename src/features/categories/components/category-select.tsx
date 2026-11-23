import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type CategorySelectProps = ComponentProps<'select'> & {
  categories: readonly { id: string; name: string }[];
  retainedOption?: { id: string; label: string };
};

/** Parent controls placement and width; callers own selection and request state. */
export function CategorySelect({
  categories,
  retainedOption,
  children,
  className,
  ...props
}: CategorySelectProps) {
  return (
    <select className={cn('field-control', className)} {...props}>
      <option value="">미분류</option>
      {retainedOption &&
        !categories.some((category) => category.id === retainedOption.id) && (
          <option value={retainedOption.id}>{retainedOption.label}</option>
        )}
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
      {children}
    </select>
  );
}
