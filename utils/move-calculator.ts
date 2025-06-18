import type { Position, Piece, PieceColor } from "@/types/chess"
import { isPositionUnderAttack, findKingPosition } from "./game-logic"

export function getAvailableMoves(board: (Piece | null)[][], position: Position): Position[] {
  const moves = getAvailableMovesWithoutCheckValidation(board, position, true) // Allow castling
  const { row, col } = position
  const piece = board[row][col]

  if (!piece) return []

  // Filter out moves that would put or leave the king in check
  return moves.filter((move) => {
    // Create a copy of the board to simulate the move
    const newBoard = board.map((row) => [...row])

    // Handle castling move simulation
    if (piece.type === "king" && Math.abs(move.col - col) === 2) {
      // This is a castling move
      const isKingSide = move.col > col
      const rookCol = isKingSide ? col + 3 : col - 4
      const rookNewCol = isKingSide ? col + 1 : col - 1

      // Move king and rook
      newBoard[move.row][move.col] = piece
      newBoard[row][col] = null
      newBoard[row][rookNewCol] = newBoard[row][rookCol]
      newBoard[row][rookCol] = null
    } else {
      // Regular move
      newBoard[move.row][move.col] = piece
      newBoard[row][col] = null
    }

    // Find the king's position after the move
    const kingPosition = findKingPosition(newBoard, piece.color)
    if (!kingPosition) return false

    // Check if the king would be in check after the move
    return !isPositionUnderAttack(newBoard, kingPosition, piece.color)
  })
}

export function getAvailableMovesWithoutCheckValidation(
  board: (Piece | null)[][],
  position: Position,
  includeCastling = false,
): Position[] {
  const { row, col } = position
  const piece = board[row][col]

  if (!piece) return []

  const moves: Position[] = []

  switch (piece.type) {
    case "pawn":
      getPawnMoves(board, position, piece.color, moves)
      break
    case "rook":
      getRookMoves(board, position, piece.color, moves)
      break
    case "knight":
      getKnightMoves(board, position, piece.color, moves)
      break
    case "bishop":
      getBishopMoves(board, position, piece.color, moves)
      break
    case "queen":
      getQueenMoves(board, position, piece.color, moves)
      break
    case "king":
      getKingMoves(board, position, piece.color, moves, includeCastling)
      break
  }

  return moves
}

function getPawnMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
  const { row, col } = position

  // Determine direction based on player color
  let direction: { dr: number; dc: number }
  let startPosition: boolean

  switch (color) {
    case "yellow":
      direction = { dr: 1, dc: 0 } // Move down
      startPosition = row === 1
      break
    case "red":
      direction = { dr: -1, dc: 0 } // Move up
      startPosition = row === 12
      break
    case "blue":
      direction = { dr: 0, dc: 1 } // Move right
      startPosition = col === 1
      break
    case "green":
      direction = { dr: 0, dc: -1 } // Move left
      startPosition = col === 12
      break
  }

  // Move forward one square
  const oneStep = { row: row + direction.dr, col: col + direction.dc }
  if (isValidPosition(oneStep) && !board[oneStep.row][oneStep.col]) {
    moves.push(oneStep)

    // Move forward two squares from starting position
    if (startPosition) {
      const twoSteps = { row: row + 2 * direction.dr, col: col + 2 * direction.dc }
      if (isValidPosition(twoSteps) && !board[twoSteps.row][twoSteps.col]) {
        moves.push(twoSteps)
      }
    }
  }

  // Capture diagonally
  const captureDirections =
    color === "yellow" || color === "red"
      ? [
          { dr: direction.dr, dc: -1 },
          { dr: direction.dr, dc: 1 },
        ]
      : [
          { dr: -1, dc: direction.dc },
          { dr: 1, dc: direction.dc },
        ]

  captureDirections.forEach((captureDir) => {
    const capturePos = { row: row + captureDir.dr, col: col + captureDir.dc }
    if (isValidPosition(capturePos)) {
      const targetPiece = board[capturePos.row][capturePos.col]
      if (targetPiece && targetPiece.color !== color) {
        moves.push(capturePos)
      }
    }
  })
}

function getRookMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
  const directions = [
    { dr: -1, dc: 0 }, // up
    { dr: 1, dc: 0 }, // down
    { dr: 0, dc: -1 }, // left
    { dr: 0, dc: 1 }, // right
  ]

  directions.forEach((dir) => {
    addMovesInDirection(board, position, dir, color, moves)
  })
}

function getBishopMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
  const directions = [
    { dr: -1, dc: -1 }, // up-left
    { dr: -1, dc: 1 }, // up-right
    { dr: 1, dc: -1 }, // down-left
    { dr: 1, dc: 1 }, // down-right
  ]

  directions.forEach((dir) => {
    addMovesInDirection(board, position, dir, color, moves)
  })
}

function getQueenMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
  getRookMoves(board, position, color, moves)
  getBishopMoves(board, position, color, moves)
}

function getKnightMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
  const { row, col } = position
  const knightMoves = [
    { dr: -2, dc: -1 },
    { dr: -2, dc: 1 },
    { dr: -1, dc: -2 },
    { dr: -1, dc: 2 },
    { dr: 1, dc: -2 },
    { dr: 1, dc: 2 },
    { dr: 2, dc: -1 },
    { dr: 2, dc: 1 },
  ]

  knightMoves.forEach((move) => {
    const newPos = { row: row + move.dr, col: col + move.dc }
    if (isValidPosition(newPos)) {
      const targetPiece = board[newPos.row][newPos.col]
      if (!targetPiece || targetPiece.color !== color) {
        moves.push(newPos)
      }
    }
  })
}

function getKingMoves(
  board: (Piece | null)[][],
  position: Position,
  color: PieceColor,
  moves: Position[],
  includeCastling = false,
) {
  const { row, col } = position
  const piece = board[row][col]

  // Regular king moves
  const kingMoves = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: -1, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
  ]

  kingMoves.forEach((move) => {
    const newPos = { row: row + move.dr, col: col + move.dc }
    if (isValidPosition(newPos)) {
      const targetPiece = board[newPos.row][newPos.col]
      if (!targetPiece || targetPiece.color !== color) {
        moves.push(newPos)
      }
    }
  })

  // Castling moves (only when explicitly requested to avoid recursion)
  if (includeCastling && piece && !piece.hasMoved) {
    addCastlingMoves(board, position, color, moves)
  }
}

function addCastlingMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
  const { row, col } = position

  // King cannot castle while in check
  if (isPositionUnderAttack(board, position, color)) return

  let kingSideRookPos: Position
  let queenSideRookPos: Position
  let pathToCheck: Position[] = []
  let castlingTarget: { kingSide: Position; queenSide: Position }

  switch (color) {
    case "red":
    case "yellow":
      // Horizontal castling
      kingSideRookPos = { row, col: col + 3 }
      queenSideRookPos = { row, col: col - 4 }
      castlingTarget = {
        kingSide: { row, col: col + 2 },
        queenSide: { row, col: col - 2 },
      }
      break
    case "blue":
      // Vertical castling
      kingSideRookPos = { row: row + 3, col }
      queenSideRookPos = { row: row - 4, col }
      castlingTarget = {
        kingSide: { row: row + 2, col },
        queenSide: { row: row - 2, col },
      }
      break
    case "green":
      // Vertical castling (opposite direction)
      kingSideRookPos = { row: row - 3, col }
      queenSideRookPos = { row: row + 4, col }
      castlingTarget = {
        kingSide: { row: row - 2, col },
        queenSide: { row: row + 2, col },
      }
      break
  }

  // Helper to check castling path
  const canCastle = (rookPos: Position, targetPos: Position, path: Position[]) => {
    const rook = board[rookPos.row][rookPos.col]
    if (!rook || rook.type !== "rook" || rook.color !== color || rook.hasMoved) return false

    // Check path clear
    for (const pos of path) {
      if (board[pos.row][pos.col]) return false
      if (isPositionUnderAttack(board, pos, color)) return false
    }

    return true
  }

  // Check king-side castling
  const kingSidePath =
    color === "red" || color === "yellow"
      ? [ { row, col: col + 1 }, { row, col: col + 2 } ]
      : color === "blue"
        ? [ { row: row + 1, col }, { row: row + 2, col } ]
        : [ { row: row - 1, col }, { row: row - 2, col } ]

  if (canCastle(kingSideRookPos, castlingTarget.kingSide, kingSidePath)) {
    moves.push(castlingTarget.kingSide)
  }

  // Check queen-side castling
  const queenSidePath =
    color === "red" || color === "yellow"
      ? [ { row, col: col - 1 }, { row, col: col - 2 } ]
      : color === "blue"
        ? [ { row: row - 1, col }, { row: row - 2, col } ]
        : [ { row: row + 1, col }, { row: row + 2, col } ]

  if (canCastle(queenSideRookPos, castlingTarget.queenSide, queenSidePath)) {
    moves.push(castlingTarget.queenSide)
  }
}

function addMovesInDirection(
  board: (Piece | null)[][],
  position: Position,
  direction: { dr: number; dc: number },
  color: PieceColor,
  moves: Position[],
) {
  const { row, col } = position
  let r = row + direction.dr
  let c = col + direction.dc

  while (isValidPosition({ row: r, col: c })) {
    const targetPiece = board[r][c]

    if (!targetPiece) {
      moves.push({ row: r, col: c })
    } else {
      if (targetPiece.color !== color) {
        moves.push({ row: r, col: c })
      }
      break
    }

    r += direction.dr
    c += direction.dc
  }
}

function isValidPosition(position: Position): boolean {
  const { row, col } = position

  // Check if position is within the 14x14 board
  if (row < 0 || row >= 14 || col < 0 || col >= 14) return false

  // Check if position is in the playable cross-shaped area
  const isPlayableSquare =
    (row >= 0 && row <= 2 && col >= 3 && col <= 10) || // Top extension
    (row >= 3 && row <= 10 && col >= 0 && col <= 13) || // Middle (full width)
    (row >= 11 && row <= 13 && col >= 3 && col <= 10) // Bottom extension

  return isPlayableSquare
}
