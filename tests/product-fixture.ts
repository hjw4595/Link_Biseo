import { dateInZone, normalizeTimeZone } from '../src/lib/time-zone';
import { organizationReport } from './organization-report-data';
import type { BrowserContext, Request } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { demoCategories, demoLinks } from '../src/lib/mock/data';
import type { CategoryResponse } from '../src/contracts';
import type { LinkResponse } from '../src/contracts/links';

export function fixtureId(name: string) {
  const hex = createHash('sha256').update(name).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function initialProduct() {
  return {
    cleanupThresholdDays: 14 as 7 | 14 | 30 | null,
    events: new Map<string, string[]>(),
    categories: demoCategories.map((c): CategoryResponse => ({
      id: fixtureId(c.id),
      name: c.name,
      sortOrder: c.interestRank,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
    links: demoLinks.map((l): LinkResponse => ({
      id: fixtureId(l.id),
      categoryId: fixtureId(l.categoryId),
      title: l.title,
      url: l.url,
      domain: l.domain,
      description: l.description,
      faviconUrl: l.favicon,
      isFavorite: l.favorite,
      clickCount: l.id === 'ai-reference' ? 20 : 1,
      createdAt: new Date(l.createdAt).toISOString(),
      updatedAt: new Date(l.createdAt).toISOString(),
      lastOpenedAt: l.lastOpenedAt
        ? new Date(l.lastOpenedAt).toISOString()
        : null,
    })),
  };
}
type State = ReturnType<typeof initialProduct>;
export async function installProductApi(
  context: BrowserContext,
  options: { now?: number } = {},
) {
  // Domain fixture time only. Never replace the process clock or auth/JWT time.
  const currentDate = () =>
    options.now === undefined ? new Date() : new Date(options.now);
  const users = new Map<string, State>();
  const requests: Request[] = [];
  await context.route('http://127.0.0.1:54329/quick-launch-presets', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3100' },
      json: { items: [] },
    }),
  );
  await context.route(
    /^http:\/\/127\.0\.0\.1:54329\/(?:categories|links|users|organization-reports)(?:[/?]|$)/,
    async (route) => {
      const request = route.request();
      requests.push(request);
      const headers = {
        'Access-Control-Allow-Origin': 'http://localhost:3100',
      };
      const send = (status: number, json?: unknown) =>
        route.fulfill({
          status,
          headers,
          ...(json === undefined ? {} : { json }),
        });
      let userId: string;
      try {
        const token = request.headers().authorization?.split(' ')[1];
        const part = token?.split('.')[1];
        const claims: unknown = part
          ? JSON.parse(Buffer.from(part, 'base64url').toString())
          : null;
        if (
          typeof claims !== 'object' ||
          claims === null ||
          !('sub' in claims) ||
          typeof claims.sub !== 'string'
        )
          return send(401, {});
        userId = claims.sub;
      } catch {
        return send(401, {});
      }
      let state = users.get(userId);
      if (!state) {
        state = initialProduct();
        for (const link of state.links)
          state.events.set(
            link.id,
            Array.from(
              { length: link.clickCount },
              () => link.lastOpenedAt ?? link.createdAt,
            ),
          );
        users.set(userId, state);
      }
      const url = new URL(request.url());
      const [, resource, id, action] = url.pathname.split('/');
      const method = request.method();
      if (method === 'POST' && resource === 'organization-reports') {
        const body: unknown = request.postDataJSON();
        const zone =
          typeof body === 'object' &&
          body !== null &&
          'timeZone' in body &&
          typeof body.timeZone === 'string'
            ? body.timeZone
            : 'Asia/Seoul';
        return send(
          200,
          organizationReport(state, zone, currentDate().toISOString()),
        );
      }

      if (method === 'GET' && url.pathname === '/users/me/usage-summary') {
        const timezone = normalizeTimeZone(
          url.searchParams.get('timeZone') ?? 'Asia/Seoul',
        );
        if (!timezone) return send(400, {});
        const end = dateInZone(currentDate().getTime(), timezone);
        const start = new Date(`${end}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() - 6);
        const periodStartDate = start.toISOString().slice(0, 10);
        const counts = state.links.map(
          (link) =>
            (state.events.get(link.id) ?? []).filter((stamp) => {
              const date = dateInZone(stamp, timezone);
              return date >= periodStartDate && date <= end;
            }).length,
        );
        return send(200, {
          recent7DayUsedLinkCount: counts.filter((count) => count > 0).length,
          recent7DayOpenCount: counts.reduce((a, b) => a + b, 0),
          timezone,
          periodStartDate,
          periodEndDate: end,
          historyScope: 'currently_saved_links',
        });
      }
      if (method === 'GET' && resource === 'categories' && id === 'summary')
        return send(200, {
          items: state.categories.map((category) => ({
            id: category.id,
            linkCount: state.links.filter(
              (link) => link.categoryId === category.id,
            ).length,
          })),
          uncategorizedCount: state.links.filter(
            (link) => link.categoryId === null,
          ).length,
          totalLinkCount: state.links.length,
        });
      if (method === 'GET' && resource === 'categories')
        return send(200, state.categories);
      let body: Record<string, unknown> = {};
      if (request.postData()) {
        const parsed: unknown = request.postDataJSON();
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        )
          return send(400, {});
        body = Object.fromEntries(Object.entries(parsed));
      }
      if (resource === 'links' && id === 'preview' && method === 'POST') {
        const value = typeof body.url === 'string' ? body.url : '';
        return send(200, {
          url: value,
          domain: new URL(value).hostname,
          title: null,
          faviconUrl: null,
          status: 'failed',
        });
      }
      if (resource === 'categories') {
        if (method === 'PATCH' && id === 'reorder') {
          const ids = body.categoryIds;
          if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string'))
            return send(400, {});
          if (
            ids.length !== state.categories.length ||
            new Set(ids).size !== ids.length ||
            ids.some((id) => !state.categories.some((row) => row.id === id))
          )
            return send(409, {});
          state.categories = ids.flatMap((id, sortOrder) =>
            state.categories
              .filter((row) => row.id === id)
              .map((row) => ({ ...row, sortOrder })),
          );
          return send(200, state.categories);
        }
        if (method === 'DELETE') {
          state.categories = state.categories.filter((c) => c.id !== id);
          state.links = state.links.map((l) =>
            l.categoryId === id ? { ...l, categoryId: null } : l,
          );
          return send(204);
        }
        const old = state.categories.find((c) => c.id === id);
        const name = typeof body.name === 'string' ? body.name : old?.name;
        if (!name?.trim()) return send(400, {});
        if (
          state.categories.some(
            (c) =>
              c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
              c.id !== id,
          )
        )
          return send(409, {});
        const row: CategoryResponse = {
          id: old?.id ?? randomUUID(),
          name,
          sortOrder:
            typeof body.sortOrder === 'number'
              ? body.sortOrder
              : (old?.sortOrder ?? 0),
          createdAt: old?.createdAt ?? currentDate().toISOString(),
          updatedAt: currentDate().toISOString(),
        };
        state.categories = [
          ...state.categories.filter((c) => c.id !== row.id),
          row,
        ].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
        return send(method === 'POST' ? 201 : 200, row);
      }
      if (resource === 'users') {
        if (method === 'PATCH') {
          const value = body.cleanupThresholdDays;
          if (value !== null && value !== 7 && value !== 14 && value !== 30)
            return send(400, {});
          state.cleanupThresholdDays = value;
        }
        return send(200, { cleanupThresholdDays: state.cleanupThresholdDays });
      }
      if (id === 'cleanup' && method === 'GET') {
        const timeZone = url.searchParams.get('timeZone') ?? 'UTC';
        let formatter: Intl.DateTimeFormat;
        try {
          formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
        } catch {
          return send(400, {});
        }
        const now = currentDate();
        const asOfDate = formatter.format(now);
        const ordinal = (stamp: string) =>
          Date.parse(`${formatter.format(new Date(stamp))}T00:00:00Z`) /
          86_400_000;
        const items = state.links
          .map((link) => ({
            ...link,
            unusedDays:
              ordinal(now.toISOString()) -
              ordinal(link.lastOpenedAt ?? link.createdAt),
          }))
          .filter(
            (link) =>
              state.cleanupThresholdDays !== null &&
              !link.isFavorite &&
              link.unusedDays >= state.cleanupThresholdDays,
          )
          .sort(
            (a, b) =>
              (a.lastOpenedAt ?? a.createdAt).localeCompare(
                b.lastOpenedAt ?? b.createdAt,
              ) || a.id.localeCompare(b.id),
          );
        const start = Number(
            url.searchParams.get('cursor')?.split('.')[0] ?? 0,
          ),
          limit = Number(url.searchParams.get('limit') ?? 10);
        return send(200, {
          thresholdDays: state.cleanupThresholdDays,
          timeZone,
          asOfDate,
          serverNow: now.toISOString(),
          totalCount: items.length,
          items: items.slice(start, start + limit),
          nextCursor:
            start + limit < items.length ? `${start + limit}.signature` : null,
        });
      }
      if (method === 'GET' && !id) {
        let items = state.links
          .filter(
            (l) =>
              !url.searchParams.get('q') ||
              [l.title, l.url, l.domain].some((v) =>
                v
                  .toLowerCase()
                  .includes((url.searchParams.get('q') ?? '').toLowerCase()),
              ),
          )
          .filter(
            (l) =>
              !url.searchParams.has('categoryId') ||
              (url.searchParams.get('categoryId') === 'uncategorized'
                ? l.categoryId === null
                : l.categoryId === url.searchParams.get('categoryId')),
          )
          .filter(
            (l) =>
              !url.searchParams.has('favorite') ||
              l.isFavorite === (url.searchParams.get('favorite') === 'true'),
          );
        const sort = url.searchParams.get('sort');
        const recent = (a: LinkResponse, b: LinkResponse) =>
          (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '');
        items = items.sort(
          (a, b) =>
            (sort === 'recent'
              ? recent(a, b)
              : sort === 'frequent'
                ? b.clickCount - a.clickCount || recent(a, b)
                : sort === 'smart'
                  ? Number(b.isFavorite) - Number(a.isFavorite) ||
                    recent(a, b) ||
                    b.clickCount - a.clickCount
                  : Number(b.isFavorite) - Number(a.isFavorite)) ||
            b.createdAt.localeCompare(a.createdAt) ||
            b.id.localeCompare(a.id),
        );
        const start = Number(
          url.searchParams.get('cursor')?.split('.')[0] ?? 0,
        );
        const limit = Number(url.searchParams.get('limit') ?? 20);
        return send(200, {
          items: items.slice(start, start + limit),
          nextCursor:
            start + limit < items.length ? `${start + limit}.signature` : null,
        });
      }
      const old = state.links.find((l) => l.id === id);
      if (id && !old) return send(404, {});
      if (action === 'stats' && old) {
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: url.searchParams.get('timeZone') ?? 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(currentDate());
        const start = new Date(
          Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000,
        )
          .toISOString()
          .slice(0, 10);
        const stamps = state.events.get(old.id) ?? [];
        return send(200, {
          linkId: old.id,
          createdAt: old.createdAt,
          lastOpenedAt: old.lastOpenedAt,
          recent7DayOpenCount: stamps.filter((stamp) => {
            const day = new Intl.DateTimeFormat('en-CA', {
              timeZone: url.searchParams.get('timeZone') ?? 'Asia/Seoul',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date(stamp));
            return day >= start && day <= today;
          }).length,
          timezone: url.searchParams.get('timeZone') ?? 'Asia/Seoul',
          periodStartDate: start,
          periodEndDate: today,
          historyStatus:
            stamps.length === old.clickCount ? 'complete' : 'partial',
        });
      }
      if (method === 'GET') return send(200, old);
      if (method === 'DELETE') {
        state.links = state.links.filter((l) => l.id !== id);
        if (id) state.events.delete(id);
        return send(204);
      }
      if (action === 'open' && old) {
        old.clickCount++;
        old.lastOpenedAt = currentDate().toISOString();
        state.events.set(old.id, [
          ...(state.events.get(old.id) ?? []),
          old.lastOpenedAt,
        ]);
        return send(200, { url: old.url, openedAt: old.lastOpenedAt });
      }
      const value = typeof body.url === 'string' ? body.url : old?.url;
      if (!value) return send(400, {});
      if (method === 'POST' && state.links.some((l) => l.url === value))
        return send(409, {});
      if (typeof body.newCategoryName === 'string') {
        const name = body.newCategoryName.trim();
        let category = state.categories.find(
          (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (!category) {
          const now = currentDate().toISOString();
          category = {
            id: randomUUID(),
            name,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          };
          state.categories.push(category);
        }
        body.categoryId = category.id;
      }
      const parsed = new URL(value);
      const now = currentDate().toISOString();
      const row: LinkResponse = {
        id: old?.id ?? randomUUID(),
        url: value,
        domain: parsed.hostname,
        title:
          typeof body.customTitle === 'string'
            ? body.customTitle
            : body.customTitle === null
              ? parsed.hostname
              : (old?.title ?? parsed.hostname),
        description:
          typeof body.customDescription === 'string'
            ? body.customDescription
            : body.customDescription === null
              ? null
              : (old?.description ?? null),
        categoryId:
          typeof body.categoryId === 'string'
            ? body.categoryId
            : body.categoryId === null
              ? null
              : (old?.categoryId ?? null),
        isFavorite:
          typeof body.isFavorite === 'boolean'
            ? body.isFavorite
            : (old?.isFavorite ?? false),
        faviconUrl: old?.faviconUrl ?? null,
        clickCount: old?.clickCount ?? 0,
        lastOpenedAt: old?.lastOpenedAt ?? null,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      };
      state.links = [...state.links.filter((l) => l.id !== row.id), row];
      return send(method === 'POST' ? 201 : 200, row);
    },
  );
  return { users, requests };
}
