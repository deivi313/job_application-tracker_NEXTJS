import type { RowDataPacket } from "mysql2/promise";
import { query } from "../db";
import type { Board, JobApplication } from "../models/models.types";

export const BOARD_NAME = "Job Hunt";

export interface BoardRow extends RowDataPacket {
  id: string;
  name: string;
  user_id: string;
}

interface ColumnRow extends RowDataPacket {
  id: string;
  name: string;
  sort_order: number;
}

function parseTags(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Maps a job_applications row to the shape the UI components expect.
export function mapJobRow(row: RowDataPacket): JobApplication {
  return {
    _id: row.id,
    company: row.company,
    position: row.position,
    location: row.location ?? undefined,
    status: row.status,
    notes: row.notes ?? undefined,
    salary: row.salary ?? undefined,
    jobUrl: row.job_url ?? undefined,
    order: Number(row.sort_order),
    columnId: row.column_id,
    tags: parseTags(row.tags),
    description: row.description ?? undefined,
  };
}

export async function findBoardForUser(
  userId: string
): Promise<BoardRow | undefined> {
  const rows = await query<BoardRow>(
    `SELECT id, name, user_id FROM boards WHERE user_id = ? AND name = ? LIMIT 1`,
    [userId, BOARD_NAME]
  );
  return rows[0];
}

export async function getBoardForUser(userId: string): Promise<Board | null> {
  const boardRow = await findBoardForUser(userId);
  if (!boardRow) return null;

  const columnRows = await query<ColumnRow>(
    `SELECT id, name, sort_order FROM board_columns
     WHERE board_id = ? ORDER BY sort_order ASC`,
    [boardRow.id]
  );

  const jobRows = await query<RowDataPacket>(
    `SELECT * FROM job_applications
     WHERE board_id = ? ORDER BY sort_order ASC`,
    [boardRow.id]
  );

  const jobsByColumn = new Map<string, JobApplication[]>();
  for (const row of jobRows) {
    const list = jobsByColumn.get(row.column_id) ?? [];
    list.push(mapJobRow(row));
    jobsByColumn.set(row.column_id, list);
  }

  return {
    _id: boardRow.id,
    name: boardRow.name,
    columns: columnRows.map((col) => ({
      _id: col.id,
      name: col.name,
      order: Number(col.sort_order),
      jobApplications: jobsByColumn.get(col.id) ?? [],
    })),
  };
}
