import { randomUUID } from "crypto";
import { withTransaction } from "./db";
import { BOARD_NAME, findBoardForUser } from "./data/board-queries";

const DEFAULT_COLUMNS = [
  { name: "Wish List", order: 0 },
  { name: "Applied", order: 1 },
  { name: "Interviewing", order: 2 },
  { name: "Rejected", order: 3 },
  { name: "Offer", order: 4 },
];

export async function initializeUserBoard(userId: string) {
  const existingBoard = await findBoardForUser(userId);

  if (existingBoard) {
    return { _id: existingBoard.id, name: existingBoard.name, userId };
  }

  const boardId = randomUUID();

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO boards (id, name, user_id) VALUES (?, ?, ?)`,
      [boardId, BOARD_NAME, userId]
    );

    for (const col of DEFAULT_COLUMNS) {
      await conn.query(
        `INSERT INTO board_columns (id, name, board_id, sort_order) VALUES (?, ?, ?, ?)`,
        [randomUUID(), col.name, boardId, col.order]
      );
    }
  });

  return { _id: boardId, name: BOARD_NAME, userId };
}
