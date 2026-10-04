import { organizationReport as buildOrganizationReport } from './organization-report-data';
import type { BrowserContext, Request } from '@playwright/test';
import type { OrganizationReport } from '../src/contracts/organization-report';
import {
  initialProduct,
  installProductApi,
  fixtureId,
} from './product-fixture';
import { testUser, testSession } from './auth-fixture';

export function organizationState() {
  const state = initialProduct();
  for (const link of state.links) {
    if (!link.isFavorite) {
      link.createdAt = '2025-01-01T00:00:00.000Z';
      link.lastOpenedAt = null;
    }
    if (link.id === fixtureId('react')) link.categoryId = null;
  }
  return state;
}
export function organizationReport(
  state = organizationState(),
  timeZone = 'Asia/Seoul',
  asOf = new Date().toISOString(),
) {
  return buildOrganizationReport(state, timeZone, asOf);
}
export async function installOrganizationApi(context: BrowserContext) {
  const product = await installProductApi(context);
  product.users.set(testUser.id, organizationState());
  const alternateId = testSession(false, 'alternate').user.id;
  const alternate = organizationState();
  alternate.links = alternate.links.map((link) => ({
    ...link,
    id: fixtureId(`${alternateId}-${link.id}`),
    title: `B 전용 ${link.title}`,
  }));
  product.users.set(alternateId, alternate);
  const requests: Request[] = [];
  const modelRequests: Request[] = [];
  context.on('request', (request) => {
    if (
      /generativelanguage|gemini|\/embeddings?(?:[/?]|$)/i.test(request.url())
    )
      modelRequests.push(request);
  });
  const control: {
    status: number;
    delay: number;
    body?: (report: OrganizationReport) => unknown;
    network: boolean;
    gate?: Promise<void>;
  } = { status: 200, delay: 0, network: false };
  await context.route(
    /^http:\/\/127\.0\.0\.1:54329\/organization-reports(?:[/?]|$)/,
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS')
        return route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3100',
            'Access-Control-Allow-Headers': 'authorization,content-type',
            'Access-Control-Allow-Methods': 'POST',
          },
        });
      requests.push(request);
      const token = request
        .headers()
        .authorization?.split(' ')[1]
        ?.split('.')[1];
      const claims: unknown = token
        ? JSON.parse(Buffer.from(token, 'base64url').toString())
        : null;
      if (
        !claims ||
        typeof claims !== 'object' ||
        !('sub' in claims) ||
        typeof claims.sub !== 'string'
      )
        return route.fulfill({ status: 401, json: {} });
      const userId = claims.sub;
      let state = product.users.get(userId);
      if (!state) {
        state = organizationState();
        state.links = state.links.map((link) => ({
          ...link,
          id: fixtureId(`${userId}-${link.id}`),
          title: `B 전용 ${link.title}`,
        }));
        product.users.set(userId, state);
      }
      const body: unknown = request.postDataJSON();
      const timeZone =
        body &&
        typeof body === 'object' &&
        'timeZone' in body &&
        typeof body.timeZone === 'string'
          ? body.timeZone
          : 'Asia/Seoul';
      const response = control.body
        ? control.body(organizationReport(state, timeZone))
        : organizationReport(state, timeZone);
      const status = control.status,
        network = control.network;
      await control.gate;
      if (control.delay)
        await new Promise((resolve) => setTimeout(resolve, control.delay));
      if (network) return route.abort();
      return route.fulfill({
        status,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3100',
          'Cache-Control': 'private, no-store',
        },
        json:
          status === 200
            ? response
            : { message: 'INTERNAL_PRIVATE_ERROR_DO_NOT_DISPLAY' },
      });
    },
  );
  return {
    ...product,
    productRequests: product.requests,
    requests,
    modelRequests,
    control,
  };
}
