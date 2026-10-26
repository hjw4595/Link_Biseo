import type { Page } from '@playwright/test';
import { fixtureId, initialProduct } from './product-fixture';
import type { PresetDetail } from '../src/contracts/quick-launch';
import { validPresetMembers } from '../src/contracts/quick-launch';
export async function presetApi(page: Page, count = 1, memberCount = 2) {
  const links = initialProduct().links.slice(0, memberCount);
  const now = '2026-10-27T00:00:00.000Z';
  const state = {
    items: Array.from({ length: count }, (_, i): PresetDetail => ({
      id: fixtureId(`preset-${i}`),
      name: `업무 ${i + 1}`,
      sortOrder: i,
      linkCount: links.length,
      createdAt: now,
      updatedAt: now,
      links: links.map((link, sortOrder) => ({ link, sortOrder })),
    })),
    requests: [] as { method: string; path: string; body: unknown }[],
    failure: 0,
    detailFailure: 0,
    listFailure: 0,
  };
  await page.route(
    'http://127.0.0.1:54329/quick-launch-presets**',
    async (route) => {
      const r = route.request(),
        path = new URL(r.url()).pathname,
        method = r.method();
      const body: unknown = r.postData() ? r.postDataJSON() : undefined;
      state.requests.push({ method, path, body });
      const send = (status: number, json?: unknown) =>
        route.fulfill({
          status,
          headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
          ...(json === undefined ? {} : { json }),
        });
      const id = path.split('/')[2];
      if (method === 'GET') {
        if (!id)
          return send(
            state.listFailure || 200,
            state.listFailure
              ? {}
              : { items: state.items.map(({ links: _links, ...p }) => p) },
          );
        const item = state.items.find((p) => p.id === id);
        return send(
          state.detailFailure || (item ? 200 : 404),
          state.detailFailure ? {} : (item ?? {}),
        );
      }
      if (state.failure) return send(state.failure, {});
      if (method === 'DELETE') {
        state.items = state.items.filter((p) => p.id !== id);
        return send(204);
      }
      if (typeof body !== 'object' || !body) return send(400, {});
      if (
        id === 'reorder' &&
        'presetIds' in body &&
        Array.isArray(body.presetIds)
      ) {
        const ids = body.presetIds;
        state.items = state.items.map((p) => ({
          ...p,
          sortOrder: ids.indexOf(p.id),
        }));
        return send(200, {
          items: state.items.map(({ links: _links, ...p }) => p),
        });
      }
      if (
        !('name' in body) ||
        typeof body.name !== 'string' ||
        !('linkIds' in body) ||
        !Array.isArray(body.linkIds)
      )
        return send(400, {});
      const ids: unknown[] = body.linkIds;
      const old = state.items.find((p) => p.id === id);
      if (!ids.every((id): id is string => typeof id === 'string'))
        return send(400, {});
      if (
        !validPresetMembers(
          ids,
          old?.links.map((row) => row.link.id),
        )
      )
        return send(409, {});
      const selected = ids.flatMap((id) => {
        const link =
          initialProduct().links.find((l) => l.id === id) ??
          old?.links.find((row) => row.link.id === id)?.link;
        return link ? [link] : [];
      });
      const item: PresetDetail = {
        id: old?.id ?? fixtureId(`created-${state.items.length}`),
        name: body.name,
        sortOrder: old?.sortOrder ?? state.items.length,
        linkCount: selected.length,
        createdAt: now,
        updatedAt: now,
        links: selected.map((link, sortOrder) => ({ link, sortOrder })),
      };
      state.items = [...state.items.filter((p) => p.id !== item.id), item];
      return send(method === 'POST' ? 201 : 200, item);
    },
  );
  return state;
}
