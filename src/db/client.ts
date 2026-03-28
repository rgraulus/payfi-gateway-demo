import { Pool, type QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/payfi_gateway";

export const pool = new Pool({
  connectionString,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
