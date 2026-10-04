// Presentation types, separate from the public HTTP contract.
import type { OrganizationReport } from '@/contracts/organization-report';
export type PreviewLink = { id: string; title: string; domain: string };
export type RecommendationDefinition = {
  kind: string;
  section: keyof Pick<
    OrganizationReport,
    'cleanupCandidates' | 'uncategorized' | 'metadataFailures'
  >;
  title: string;
  description: string;
  priority: number;
  action: string;
};
export type RecommendationItem = Omit<RecommendationDefinition, 'section'> & {
  id: string;
  count: number | null;
  status: 'ready' | 'loading' | 'unavailable';
  returnedCount: number;
  truncated: boolean;
  previewItems: PreviewLink[];
};
