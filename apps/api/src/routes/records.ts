import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { prisma } from '@getvinyls/db';
import {
  RecordListSchema,
  RecordSchema,
  ErrorSchema,
  IdParamSchema,
  toRecordDto,
} from '../schemas.js';

export const recordsRouter = new OpenAPIHono();

const listRecordsRoute = createRoute({
  method: 'get',
  path: '/records',
  tags: ['records'],
  summary: 'List records',
  responses: {
    200: {
      description: 'A list of records.',
      content: { 'application/json': { schema: RecordListSchema } },
    },
  },
});

recordsRouter.openapi(listRecordsRoute, async (c) => {
  const rows = await prisma.record.findMany({ orderBy: { createdAt: 'desc' } });
  return c.json({ records: rows.map(toRecordDto), total: rows.length }, 200);
});

const getRecordRoute = createRoute({
  method: 'get',
  path: '/records/{id}',
  tags: ['records'],
  summary: 'Get a record by id',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'The requested record.',
      content: { 'application/json': { schema: RecordSchema } },
    },
    404: {
      description: 'Record not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

recordsRouter.openapi(getRecordRoute, async (c) => {
  const { id } = c.req.valid('param');
  const row = await prisma.record.findUnique({ where: { id } });
  if (!row) {
    return c.json({ error: 'not_found', message: `No record with id ${id}` }, 404);
  }
  return c.json(toRecordDto(row), 200);
});
