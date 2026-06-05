import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { prisma } from '@getvinyls/db';
import {
  VinylListSchema,
  VinylSchema,
  ShopListSchema,
  GenreListSchema,
  ErrorSchema,
  IdParamSchema,
  toVinylSummaryDto,
  toVinylDto,
  toShopDto,
  toGenreDto,
} from '../schemas.js';

export const vinylsRouter = new OpenAPIHono();

const listVinylsRoute = createRoute({
  method: 'get',
  path: '/vinyls',
  tags: ['vinyls'],
  summary: 'List vinyls',
  responses: {
    200: {
      description: 'A list of vinyls with their tracks, genres, and a cheapest-price summary.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
  },
});

vinylsRouter.openapi(listVinylsRoute, async (c) => {
  const rows = await prisma.vinyl.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tracks: { orderBy: { position: 'asc' } },
      genres: { include: { genre: true } },
      shopVinyls: { select: { shopId: true, offers: { select: { currentPrice: true, currentCurrency: true } } } },
    },
  });
  return c.json({ vinyls: rows.map(toVinylSummaryDto), total: rows.length }, 200);
});

const getVinylRoute = createRoute({
  method: 'get',
  path: '/vinyls/{id}',
  tags: ['vinyls'],
  summary: 'Get a vinyl by id',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'The requested vinyl with its tracks, genres, and shop offers.',
      content: { 'application/json': { schema: VinylSchema } },
    },
    404: {
      description: 'Vinyl not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

vinylsRouter.openapi(getVinylRoute, async (c) => {
  const { id } = c.req.valid('param');
  const row = await prisma.vinyl.findUnique({
    where: { id },
    include: {
      tracks: { orderBy: { position: 'asc' } },
      genres: { include: { genre: true } },
      shopVinyls: { include: { shop: true, offers: { orderBy: { currentPrice: 'asc' } } } },
    },
  });
  if (!row) {
    return c.json({ error: 'not_found', message: `No vinyl with id ${id}` }, 404);
  }
  return c.json(toVinylDto(row), 200);
});

const listShopsRoute = createRoute({
  method: 'get',
  path: '/shops',
  tags: ['shops'],
  summary: 'List shops',
  responses: {
    200: {
      description: 'A list of shops.',
      content: { 'application/json': { schema: ShopListSchema } },
    },
  },
});

vinylsRouter.openapi(listShopsRoute, async (c) => {
  const rows = await prisma.shop.findMany({ orderBy: { name: 'asc' } });
  return c.json({ shops: rows.map(toShopDto), total: rows.length }, 200);
});

const listGenresRoute = createRoute({
  method: 'get',
  path: '/genres',
  tags: ['genres'],
  summary: 'List genres',
  responses: {
    200: {
      description: 'A list of genres.',
      content: { 'application/json': { schema: GenreListSchema } },
    },
  },
});

vinylsRouter.openapi(listGenresRoute, async (c) => {
  const rows = await prisma.genre.findMany({ orderBy: { name: 'asc' } });
  return c.json({ genres: rows.map(toGenreDto), total: rows.length }, 200);
});
