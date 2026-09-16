import type { LinkResponse } from '@/contracts/links';
export type LinkView = {
  id: string;
  categoryId: string | null;
  title: string;
  url: string;
  domain: string;
  description: string | null;
  favicon: string | null;
  favorite: boolean;
  createdAt: string;
  lastOpenedAt: string | null;
};
export function linkView(link: LinkResponse): LinkView {
  return { ...link, favicon: link.faviconUrl, favorite: link.isFavorite };
}
