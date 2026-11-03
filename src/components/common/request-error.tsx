import { Button } from '@/components/ui/button';
export function RequestError({
  text,
  retry,
  retrying = false,
}: {
  text: string;
  retry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p role="alert" className="text-sm text-destructive">
        {text}
      </p>
      <Button
        type="button"
        variant="secondary"
        loading={retrying}
        onClick={retry}
      >
        다시 시도
      </Button>
    </div>
  );
}
