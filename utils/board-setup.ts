import type { Piece } from "@/types/chess"

export function initializeBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array(14)
    .fill(null)
    .map(() => Array(14).fill(null))

  // Yellow pieces (top) - rows 0-1, cols 3-10
  setupYellowPieces(board)

  // Blue pieces (left) - rows 3-10, cols 0-1
  setupBluePieces(board)

  // Red pieces (bottom) - rows 12-13, cols 3-10
  setupRedPieces(board)

  // Green pieces (right) - rows 3-10, cols 12-13
  setupGreenPieces(board)

  return board
}

function setupYellowPieces(board: (Piece | null)[][]) {
  // Back rank (row 0)
  const backPieces: Piece["type"][] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
  for (let i = 0; i < 8; i++) {
    board[0][3 + i] = { type: backPieces[i], color: "yellow" }
  }

  // Pawns (row 1)
  for (let i = 0; i < 8; i++) {
    board[1][3 + i] = { type: "pawn", color: "yellow" }
  }
}

function setupBluePieces(board: (Piece | null)[][]) {
  // Back rank (col 0)
  const backPieces: Piece["type"][] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
  for (let i = 0; i < 8; i++) {
    board[3 + i][0] = { type: backPieces[i], color: "blue" }
  }

  // Pawns (col 1)
  for (let i = 0; i < 8; i++) {
    board[3 + i][1] = { type: "pawn", color: "blue" }
  }
}

function setupRedPieces(board: (Piece | null)[][]) {
  // Back rank (row 13)
  const backPieces: Piece["type"][] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
  for (let i = 0; i < 8; i++) {
    board[13][3 + i] = { type: backPieces[i], color: "red" }
  }

  // Pawns (row 12)
  for (let i = 0; i < 8; i++) {
    board[12][3 + i] = { type: "pawn", color: "red" }
  }
}

function setupGreenPieces(board: (Piece | null)[][]) {
  // Back rank (col 13)
  const backPieces: Piece["type"][] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
  for (let i = 0; i < 8; i++) {
    board[3 + i][13] = { type: backPieces[i], color: "green" }
  }

  // Pawns (col 12)
  for (let i = 0; i < 8; i++) {
    board[3 + i][12] = { type: "pawn", color: "green" }
  }
}
