"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { getSession } from "../auth/auth";
import { query, withTransaction } from "../db";
import { mapJobRow } from "../data/board-queries";

interface JobApplicationData {
  company: string;
  position: string;
  location?: string;
  notes?: string;
  salary?: string;
  jobUrl?: string;
  columnId: string;
  boardId: string;
  tags?: string[];
  description?: string;
}

interface JobRow extends RowDataPacket {
  id: string;
  user_id: string;
  column_id: string;
  sort_order: number;
}

export async function createJobApplication(data: JobApplicationData) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const {
    company,
    position,
    location,
    notes,
    salary,
    jobUrl,
    columnId,
    boardId,
    tags,
    description,
  } = data;

  if (!company || !position || !columnId || !boardId) {
    return { error: "Missing required fields" };
  }

  const userId = session.user.id;

  // Verify board ownership
  const boards = await query(
    `SELECT id FROM boards WHERE id = ? AND user_id = ? LIMIT 1`,
    [boardId, userId]
  );

  if (boards.length === 0) {
    return { error: "Board not found" };
  }

  // Verify column belongs to board
  const columns = await query(
    `SELECT id FROM board_columns WHERE id = ? AND board_id = ? LIMIT 1`,
    [columnId, boardId]
  );

  if (columns.length === 0) {
    return { error: "Column not found" };
  }

  const [maxRow] = await query<RowDataPacket & { max_order: number | null }>(
    `SELECT MAX(sort_order) AS max_order FROM job_applications WHERE column_id = ?`,
    [columnId]
  );

  const newOrder =
    maxRow?.max_order !== null && maxRow?.max_order !== undefined
      ? Number(maxRow.max_order) + 1
      : 0;

  const id = randomUUID();

  await query(
    `INSERT INTO job_applications
      (id, company, position, location, notes, salary, job_url, column_id,
       board_id, user_id, tags, description, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      company,
      position,
      location ?? null,
      notes ?? null,
      salary ?? null,
      jobUrl ?? null,
      columnId,
      boardId,
      userId,
      JSON.stringify(tags ?? []),
      description ?? null,
      "applied",
      newOrder,
    ]
  );

  const [created] = await query(
    `SELECT * FROM job_applications WHERE id = ?`,
    [id]
  );

  revalidatePath("/dashboard");

  return { data: JSON.parse(JSON.stringify(mapJobRow(created))) };
}

export async function updateJobApplication(
  id: string,
  updates: {
    company?: string;
    position?: string;
    location?: string;
    notes?: string;
    salary?: string;
    jobUrl?: string;
    columnId?: string;
    order?: number;
    tags?: string[];
    description?: string;
  }
) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const [jobRow] = await query<JobRow>(
    `SELECT id, user_id, column_id, sort_order FROM job_applications WHERE id = ? LIMIT 1`,
    [id]
  );

  if (!jobRow) {
    return { error: "Job application not found" };
  }

  if (jobRow.user_id !== session.user.id) {
    return { error: "Unauthorized" };
  }

  const { columnId, order, ...otherUpdates } = updates;

  const setClauses: string[] = [];
  const values: unknown[] = [];

  // Plain field updates (only the fields that were actually provided)
  const fieldColumns: Array<[keyof typeof otherUpdates, string]> = [
    ["company", "company"],
    ["position", "position"],
    ["location", "location"],
    ["notes", "notes"],
    ["salary", "salary"],
    ["jobUrl", "job_url"],
    ["description", "description"],
    ["tags", "tags"],
  ];

  for (const [key, column] of fieldColumns) {
    const value = otherUpdates[key];
    if (value === undefined) continue;

    setClauses.push(`${column} = ?`);
    values.push(key === "tags" ? JSON.stringify(value ?? []) : value ?? null);
  }

  const currentColumnId: string = jobRow.column_id;
  const newColumnId = columnId?.toString();

  await withTransaction(async (conn) => {
    const getSiblings = async (colId: string) => {
      const [rows] = await conn.query(
        `SELECT id, sort_order FROM job_applications
         WHERE column_id = ? AND id <> ? ORDER BY sort_order ASC`,
        [colId, id]
      );
      return rows as Array<{ id: string; sort_order: number }>;
    };

    const setSortOrder = (rowId: string, newSortOrder: number) =>
      conn.query(`UPDATE job_applications SET sort_order = ? WHERE id = ?`, [
        newSortOrder,
        rowId,
      ]);

    if (newColumnId && newColumnId !== currentColumnId) {
      // Moving to a different column
      const jobsInTargetColumn = await getSiblings(newColumnId);

      let newOrderValue: number;

      if (order !== undefined && order !== null) {
        newOrderValue = order * 100;

        for (const job of jobsInTargetColumn.slice(order)) {
          await setSortOrder(job.id, job.sort_order + 100);
        }
      } else if (jobsInTargetColumn.length > 0) {
        const lastJobOrder =
          jobsInTargetColumn[jobsInTargetColumn.length - 1].sort_order || 0;
        newOrderValue = lastJobOrder + 100;
      } else {
        newOrderValue = 0;
      }

      setClauses.push("column_id = ?", "sort_order = ?");
      values.push(newColumnId, newOrderValue);
    } else if (order !== undefined && order !== null) {
      // Reordering within the same column
      const otherJobsInColumn = await getSiblings(currentColumnId);

      const currentJobOrder = jobRow.sort_order || 0;
      const currentPositionIndex = otherJobsInColumn.findIndex(
        (job) => job.sort_order > currentJobOrder
      );
      const oldPositionIndex =
        currentPositionIndex === -1
          ? otherJobsInColumn.length
          : currentPositionIndex;

      if (order < oldPositionIndex) {
        for (const job of otherJobsInColumn.slice(order, oldPositionIndex)) {
          await setSortOrder(job.id, job.sort_order + 100);
        }
      } else if (order > oldPositionIndex) {
        for (const job of otherJobsInColumn.slice(oldPositionIndex, order)) {
          await setSortOrder(job.id, Math.max(0, job.sort_order - 100));
        }
      }

      setClauses.push("sort_order = ?");
      values.push(order * 100);
    }

    if (setClauses.length > 0) {
      await conn.query(
        `UPDATE job_applications SET ${setClauses.join(", ")} WHERE id = ?`,
        [...values, id]
      );
    }
  });

  const [updated] = await query(
    `SELECT * FROM job_applications WHERE id = ?`,
    [id]
  );

  revalidatePath("/dashboard");

  return { data: JSON.parse(JSON.stringify(mapJobRow(updated))) };
}

export async function deleteJobApplication(id: string) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const [jobRow] = await query<JobRow>(
    `SELECT id, user_id FROM job_applications WHERE id = ? LIMIT 1`,
    [id]
  );

  if (!jobRow) {
    return { error: "Job application not found" };
  }

  if (jobRow.user_id !== session.user.id) {
    return { error: "Unauthorized" };
  }

  await query(`DELETE FROM job_applications WHERE id = ?`, [id]);

  revalidatePath("/dashboard");

  return { success: true };
}
