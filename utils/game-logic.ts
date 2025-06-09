import type { Position, Piece, PieceColor } from "@/types/chess"
import { getAvailableMovesWithoutCheckValidation } from "./move-calculator"

export function isPositionUnderAttack(board: (Piece | null)[][], position: Position, playerColor: PieceColor): boolean {
  const opponents: PieceColor[] = ["yellow", "blue", "green", "red"].filter((color) => color !== playerColor)

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && opponents.includes(piece.color)) {
        // Don't include castling moves when checking for attacks to prevent recursion
        const moves = getAvailableMovesWithoutCheckValidation(board, { row, col }, false)
        if (moves.some((move) => move.row === position.row && move.col === position.col)) {
          return true
        }
      }
    }
  }

  return false
}

export function findKingPosition(board: (Piece | null)[][], color: PieceColor): Position | null {
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && piece.type === "king" && piece.color === color) {
        return { row, col }
      }
    }
  }
  return null
}
