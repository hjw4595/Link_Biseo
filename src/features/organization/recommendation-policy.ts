import type { RecommendationDefinition } from './types';

// Provisional display order, not an AI score or a permanent product ranking.
export const recommendationPolicy: readonly RecommendationDefinition[] = [
  {
    kind: 'uncategorized_links',
    section: 'uncategorized',
    priority: 10,
    title: '카테고리가 없는 링크',
    description: '링크 상세에서 알맞은 카테고리를 지정해 보세요.',
    action: '미분류 링크 확인',
  },
  {
    kind: 'unused_links',
    section: 'cleanupCandidates',
    priority: 20,
    title: '오래 사용하지 않은 링크',
    description:
      '즐겨찾기를 제외하고, 설정한 기간 동안 열지 않은 링크를 확인해 보세요.',
    action: '정리 후보 확인',
  },
  {
    kind: 'metadata_failures',
    section: 'metadataFailures',
    priority: 30,
    title: '정보 수집에 실패한 링크',
    description:
      '정보 수집 실패가 사이트 접속 불가를 뜻하지는 않아요. 링크 상세에서 확인해 보세요.',
    action: '정보 수집 실패 항목 확인',
  },
];
