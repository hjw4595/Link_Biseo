// UI fixtures only: these types are not HTTP contracts or database entities.
export type DemoCategory = { id: string; name: string; interestRank: number };
export type DemoLink = {
  id: string;
  categoryId: string;
  title: string;
  url: string;
  domain: string;
  description: string | null;
  favicon: string | null;
  favorite: boolean;
  createdAt: string;
  lastOpenedAt: string | null;
  note: string | null;
};
