import './load-env';
import { prisma, Prisma } from '@getvinyls/db';
import { RESOURCES, RESOURCE_MAP, type ResourceDef } from './resources';

// Server-only Prisma data layer. Statically imports the Prisma client, so it must ONLY be reached
// through a dynamic import() inside a server-function handler (see resources-fns.ts), never
// statically from client-reachable code, or TanStack Start's import-protection will fail the build.

export const PAGE_SIZE = 50;

// A fully serialized scalar value, safe to cross the server/client boundary (createServerFn requires
// the return type to be provably serializable). Every Prisma column in this schema is a scalar/enum/
// Decimal/Date, so serializeValue collapses each to one of these.
export type Cell = string | number | boolean | null;
export type SerializedRow = Record<string, Cell>;

type RawRow = Record<string, unknown>;
type ListArgs = { skip?: number; take?: number; where?: object; orderBy?: object; include?: object };
type AnyDelegate = {
  findMany(args: ListArgs): Promise<RawRow[]>;
  findUnique(args: { where: object }): Promise<RawRow | null>;
  count(args?: { where?: object }): Promise<number>;
  update(args: { where: object; data: object }): Promise<RawRow>;
};

// One contained cast (NOT `any`): index the Prisma client by delegate name. Every ResourceDef.model
// names a real delegate, so the lookup is sound at runtime; AnyDelegate keeps args/returns shaped as
// plain objects rather than `any`, so the data layer stays type-checked.
const delegates = prisma as unknown as Record<string, AnyDelegate>;

function serializeValue(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  // No JSON/array columns exist in this schema; stringify defensively to stay serializable.
  return JSON.stringify(value);
}

function serializeRow(row: RawRow): SerializedRow {
  const out: SerializedRow = {};
  for (const [key, value] of Object.entries(row)) out[key] = serializeValue(value);
  return out;
}

// Combine the free-text search and the optional boolean (toggleField) filter. `flag` is undefined
// when the filter is "all", or true/false to keep only rows in that state.
function buildWhere(def: ResourceDef, q: string, flag?: boolean): object | undefined {
  const clauses: object[] = [];
  const term = q.trim();
  if (term && def.searchFields.length > 0) {
    clauses.push({
      OR: def.searchFields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' } })),
    });
  }
  if (def.toggleField && flag !== undefined) {
    clauses.push({ [def.toggleField]: flag });
  }
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

function delegateFor(def: ResourceDef): AnyDelegate {
  const delegate = delegates[def.model];
  if (!delegate) throw new Error(`No Prisma delegate for model "${def.model}"`);
  return delegate;
}

export async function listRows(resource: string, page: number, q: string, flag?: boolean) {
  const def = RESOURCE_MAP[resource];
  if (!def) throw new Error(`Unknown resource: ${resource}`);
  const delegate = delegateFor(def);
  const where = buildWhere(def, q, flag);
  const skip = (page - 1) * PAGE_SIZE;
  // Count a to-many relation (e.g. a genre's vinyls) and surface it as a `${countOf}Count` column.
  const include = def.countOf ? { _count: { select: { [def.countOf]: true } } } : undefined;
  const countCol = def.countOf ? `${def.countOf}Count` : null;
  const [rows, total] = await Promise.all([
    delegate.findMany({ skip, take: PAGE_SIZE, where, orderBy: def.orderBy, ...(include && { include }) }),
    delegate.count(where ? { where } : undefined),
  ]);
  return {
    rows: rows.map((raw) => {
      const { _count, ...rest } = raw as RawRow & { _count?: Record<string, number> };
      const row = serializeRow(rest);
      if (countCol && def.countOf) row[countCol] = _count?.[def.countOf] ?? 0;
      return row;
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    columns: countCol ? [...def.columns, countCol] : def.columns,
    label: def.label,
    key: def.key,
    idField: def.idField,
    hasDetail: def.hasDetail,
    // Drives the list's per-row toggle + status filter; null when the resource has no boolean gate.
    toggleField: def.toggleField ?? null,
  };
}

export async function getRow(resource: string, id: string) {
  const def = RESOURCE_MAP[resource];
  if (!def) throw new Error(`Unknown resource: ${resource}`);
  const delegate = delegateFor(def);
  const row = await delegate.findUnique({ where: { [def.idField]: id } });
  return { row: row ? serializeRow(row) : null, label: def.label, key: def.key };
}

// Set a resource's boolean toggleField on one row (e.g. mark a genre validated). The field name is
// not taken from the caller: it comes from the resource definition, so only the whitelisted gate can
// be written.
export async function setFlag(resource: string, id: string, value: boolean) {
  const def = RESOURCE_MAP[resource];
  if (!def) throw new Error(`Unknown resource: ${resource}`);
  if (!def.toggleField) throw new Error(`Resource "${resource}" has no toggle field`);
  await delegateFor(def).update({ where: { [def.idField]: id }, data: { [def.toggleField]: value } });
}

export async function countAll() {
  return Promise.all(
    RESOURCES.map(async (def) => ({
      key: def.key,
      label: def.label,
      count: await delegateFor(def).count(),
    })),
  );
}
