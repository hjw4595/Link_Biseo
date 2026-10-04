import type { RecommendationItem as Item } from '../types';
import { RecommendationItem } from './recommendation-item';

export function RecommendationList({ items }: { items: Item[] }) {
  return (
    <div className="space-y-4" aria-label="추천 항목">
      {items.map((item) => (
        <RecommendationItem key={item.id} item={item} />
      ))}
    </div>
  );
}
