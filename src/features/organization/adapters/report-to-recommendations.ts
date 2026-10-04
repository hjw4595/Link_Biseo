import type { LinkResponse } from '@/contracts/links';
import type { OrganizationReport } from '@/contracts/organization-report';
import { recommendationPolicy } from '../recommendation-policy';
import type { RecommendationDefinition, RecommendationItem } from '../types';

export function reportToRecommendations(
  report: OrganizationReport,
  policy: readonly RecommendationDefinition[] = recommendationPolicy,
): RecommendationItem[] {
  return recommendationSections(report, policy).flatMap((rule) => {
    const section = report[rule.section];
    return [
      {
        ...rule,
        id: rule.kind,
        status: 'ready',
        count: section.totalCount,
        description:
          rule.section === 'cleanupCandidates'
            ? `${report.cleanupCandidates.thresholdDays}일 이상 사용하지 않은 후보예요. ${rule.description}`
            : rule.description,
        returnedCount: section.items.length,
        truncated: section.truncated,
        previewItems: section.items
          .slice(0, 3)
          .map(({ id, title, domain }) => ({ id, title, domain })),
      },
    ];
  });
}

function recommendationSections(
  report: OrganizationReport,
  policy: readonly RecommendationDefinition[],
) {
  return [...policy]
    .sort((a, b) => a.priority - b.priority)
    .filter(
      (rule) =>
        !(
          rule.section === 'cleanupCandidates' &&
          report.cleanupCandidates.thresholdDays === null
        ) && report[rule.section].totalCount > 0,
    );
}
/** Reuse the existing report policy; no candidate predicate or server total is recomputed. */
export function reportToCandidateLinks(
  report: OrganizationReport,
  removedLinkIds: readonly string[] = [],
) {
  const removed = new Set(removedLinkIds);
  const links = new Map<string, LinkResponse>();
  const sections = recommendationSections(report, recommendationPolicy);
  for (const rule of sections)
    for (const link of report[rule.section].items) {
      const id = link.id.toLowerCase();
      if (!removed.has(id) && !links.has(id)) links.set(id, link);
    }
  return {
    links: [...links.values()],
    truncated: sections.some((rule) => report[rule.section].truncated),
  };
}
