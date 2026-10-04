import type {
  OrganizationReport,
  ReportSection,
} from '../src/contracts/organization-report';
import type { initialProduct } from './product-fixture';
const section = <T>(items: T[]): ReportSection<T> => ({
  totalCount: items.length,
  items: items.slice(0, 10),
  truncated: items.length > 10,
});
function day(asOf: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(asOf));
}
export function organizationReport(
  state: ReturnType<typeof initialProduct>,
  timeZone = 'Asia/Seoul',
  asOf = new Date().toISOString(),
): OrganizationReport {
  const thresholdDays = state.cleanupThresholdDays;
  const unused =
    thresholdDays === null
      ? []
      : state.links
          .filter((link) => !link.isFavorite)
          .map((link) => ({
            ...link,
            unusedDays:
              (Date.parse(day(asOf, timeZone)) -
                Date.parse(
                  day(link.lastOpenedAt ?? link.createdAt, timeZone),
                )) /
              86400000,
          }))
          .filter((link) => link.unusedDays >= thresholdDays);
  const uncategorized = state.links.filter((link) => link.categoryId === null);
  const failures = state.links.filter((link) =>
    link.domain.includes('example.com'),
  );
  return {
    asOf,
    timeZone,
    summary: {
      totalLinks: state.links.length,
      totalCategories: state.categories.length,
      uncategorizedCount: uncategorized.length,
      cleanupCandidateCount: unused.length,
      metadataFailedCount: failures.length,
    },
    categories: state.categories.map((category) => ({
      id: category.id,
      name: category.name,
      linkCount: state.links.filter((link) => link.categoryId === category.id)
        .length,
    })),
    uncategorized: section(uncategorized),
    recentlyAdded: section(
      [...state.links].sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
    ),
    cleanupCandidates: {
      ...section(unused),
      thresholdDays,
      asOfDate: day(asOf, timeZone),
    },
    metadataFailures: section(failures),
    semantics: { status: 'not_included' },
  };
}
