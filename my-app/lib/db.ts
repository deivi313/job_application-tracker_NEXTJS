import {
  createPool,
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: Pool | undefined;
}

export function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Please define the DATABASE_URL environment variable inside .env (e.g. mysql://user:password@localhost:3306/job_tracker)"
    );
  }

  if (!global.mysqlPool) {
    global.mysqlPool = createPool({
      uri: databaseUrl,
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
      ssl: { rejectUnauthorized: true },
    });
  }

  return global.mysqlPool;
}

export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as unknown as T[];
}

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
