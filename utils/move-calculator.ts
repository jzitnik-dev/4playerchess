import type { Position, Piece, PieceColor } from "@/types/chess"
import { isPositionUnderAttack, findKingPosition } from "./game-logic"

type Move = Position & { isCastling?: boolean }

export function getAvailableMoves(board: (Piece | null)[][], position: Position): Position[] {
  const moves = getAvailableMovesWithoutCheckValidation(board, position, true) // Allow castling
  const { row, col } = position
  const piece = board[row][col]

  if (!piece) return []

  // Filter out moves that would put or leave the king in check
  return (moves as Move[]).filter((move) => {
    // Create a copy of the board to simulate the move
    const newBoard = board.map((row) => [...row])
    const movingPiece = { ...piece }

    // Handle castling move simulation
    if (piece.type === "king" && (Math.abs(move.row - row) === 2 || Math.abs(move.col - col) === 2) && move.isCastling) {
      // This is a castling move
      const rowDelta = move.row - row
      const colDelta = move.col - col

      const direction = {
        row: Math.sign(rowDelta),
        col: Math.sign(colDelta)
      }

      let rookRow = row
      let rookCol = col
      for (let i = 1; i <= 4; i++) {
        const testRow = row + i * direction.row
        const testCol = col + i * direction.col

        if (!isValidPosition({ row: testRow, col: testCol })) break

        const maybeRook = newBoard[testRow][testCol]
        if (maybeRook && maybeRook.type === "rook" && maybeRook.color === movingPiece.color) {
          rookRow = testRow
          rookCol = testCol
          break
        }
      }

      if (!isPathClear(newBoard, { row, col }, { row: rookRow, col: rookCol })) {
        return false // Path blocked, castling not allowed
      }

      const rookNewRow = row + direction.row
      const rookNewCol = col + direction.col

      // Move king and rook
      newBoard[move.row][move.col] = movingPiece
      newBoard[row][col] = null

      const rook = newBoard[rookRow][rookCol]
      if (!rook) {
        console.warn(`[${movingPiece.color}] ❌ No rook found at (${rookRow}, ${rookCol}) during castling`)
        return false
      }
      newBoard[rookNewRow][rookNewCol] = rook
      newBoard[rookRow][rookCol] = null

      console.log(`[${movingPiece.color}] 🧩 Final board state (simplified):`)
      console.log(`King at (${move.row}, ${move.col}):`, newBoard[move.row][move.col])
      console.log(`Rook at (${rookNewRow}, ${rookNewCol}):`, newBoard[rookNewRow][rookNewCol])
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

function isPathClear(board: (Piece | null)[][], start: Position, end: Position): boolean {
  const rowStep = Math.sign(end.row - start.row)
  const colStep = Math.sign(end.col - start.col)

  let currentRow = start.row + rowStep
  let currentCol = start.col + colStep

  while (currentRow !== end.row || currentCol !== end.col) {
    if (board[currentRow][currentCol] !== null) {
      return false
    }
    currentRow += rowStep
    currentCol += colStep
  }
  return true
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
  console.log(`[${color}] Checking castling availability from position [${row};${col}]`);

  // Check if king is in check (can't castle while in check)
  if (isPositionUnderAttack(board, position, color)) {
    console.log(`[${color}] King is under attack — castling blocked.`);
    return
  }

  // Determine rook positions based on player color
  const rookOffsets = {
    yellow: { kingSide: { row: 0, col: -3 }, queenSide: { row: 0, col: 4 } },
    red: { kingSide: { row: 0, col: 3 }, queenSide: { row: 0, col: -4 } },
    blue: { kingSide: { row: 3, col: 0 }, queenSide: { row: -4, col: 0 } },
    green: { kingSide: { row: -3, col: 0 }, queenSide: { row: 4, col: 0 } }
  }

  const rookOffset = rookOffsets[color]

  const kingSideRookRow = row + rookOffset.kingSide.row
  const kingSideRookCol = col + rookOffset.kingSide.col
  const queenSideRookRow = row + rookOffset.queenSide.row
  const queenSideRookCol = col + rookOffset.queenSide.col

  // King-side castling
  if (isValidPosition({ row: kingSideRookRow, col: kingSideRookCol })) {
    const kingSideRook = board[kingSideRookRow][kingSideRookCol]
    console.log(`[${color}] King-side rook at [${kingSideRookRow};${kingSideRookCol}] is`, kingSideRook);

    if (kingSideRook && kingSideRook.type === "rook" && kingSideRook.color === color && !kingSideRook.hasMoved) {
      // Check if squares between king and rook are empty
      let canCastle = true

      if (kingSideRookRow === row) {
        const step = kingSideRookCol > col ? 1 : -1
        for (let c = col + step; c < kingSideRookCol; c += step) {
          if (board[row][c] !== null) {
            canCastle = false
            console.log(`[${color}] Blocked at [${row};${c}] — piece between king and rook`);
            break
          }
        }
      } else if (kingSideRookCol === col) {
        const step = kingSideRookRow > row ? 1 : -1
        for (let r = row + step; r !== kingSideRookRow; r += step) {
          if (board[r][col] !== null) {
            canCastle = false
            console.log(`[${color}] Blocked at [${r};${col}] — piece between king and rook`);
            break
          }
        }
      }

      // Check if king passes through or ends up in check
      if (canCastle) {
        const rowDelta = Math.sign(kingSideRookRow - row)
        const colDelta = Math.sign(kingSideRookCol - col)

        for (let i = 0; i <= 2; i++) {
          const checkRow = row + i * rowDelta
          const checkCol = col + i * colDelta

          if (
            !isValidPosition({ row: checkRow, col: checkCol }) ||
            isPositionUnderAttack(board, { row: checkRow, col: checkCol }, color)
          ) {
            canCastle = false
            console.log(`[${color}] Castling path under attack at [${checkRow};${checkCol}]`);
            break
          }
        }
      }

      if (canCastle) {
        console.log(`${color} - no check if king passes, castle continues!`)
        const rowDelta = Math.sign(kingSideRookRow - row)
        const colDelta = Math.sign(kingSideRookCol - col)

        const castleMove: Move = {
          row: row + 2 * rowDelta,
          col: col + 2 * colDelta,
          isCastling: true
        }

        console.log(`[${color}] ✅ King-side castling allowed: ${JSON.stringify(castleMove)}`);

        moves.push(castleMove)
      }
    }

    return true
  }

  // Queen-side castling
  if (isValidPosition({ row: queenSideRookRow, col: queenSideRookCol })) {
    const queenSideRook = board[queenSideRookRow][queenSideRookCol]
    if (queenSideRook && queenSideRook.type === "rook" && queenSideRook.color === color && !queenSideRook.hasMoved) {
      // Check if squares between king and rook are empty
      let canCastle = true

      if (queenSideRookRow === row) {
        const step = queenSideRookCol > col ? 1 : -1
        for (let c = col + step; c < queenSideRookCol; c += step) {
          if (board[row][c] !== null) {
            canCastle = false
            console.log(`[${color}] Blocked at [${row};${c}] — piece between king and rook`);
            break
          }
        }
      } else if (queenSideRookCol === col) {
        const step = queenSideRookRow > row ? 1 : -1
        for (let r = row + step; r !== queenSideRookRow; r += step) {
          if (board[r][col] !== null) {
            canCastle = false
            console.log(`[${color}] Blocked at [${r};${col}] — piece between king and rook`);
            break
          }
        }
      }

      // Check if king passes through or ends up in check
      if (canCastle) {
        const rowDelta = Math.sign(queenSideRookRow - row)
        const colDelta = Math.sign(queenSideRookCol - col)

        for (let i = 0; i <= 2; i++) {
          const checkRow = row + i * rowDelta
          const checkCol = col + i * colDelta

          if (
            !isValidPosition({ row: checkRow, col: checkCol }) ||
            isPositionUnderAttack(board, { row: checkRow, col: checkCol }, color)
          ) {
            canCastle = false
            console.log(`[${color}] Castling path under attack at [${checkRow};${checkCol}]`);
            break
          }
        }
      }

      if (canCastle) {
        console.log(`${color} - no check if king passes, castle continues!`)
        const rowDelta = Math.sign(queenSideRookRow - row)
        const colDelta = Math.sign(queenSideRookCol - col)
      
        const castleMove: Move = {
          row: row + 2 * rowDelta,
          col: col + 2 * colDelta,
          isCastling: true
        }

        console.log(`[${color}] ✅ Queen-side castling allowed: ${JSON.stringify(castleMove)}`);
        moves.push(castleMove)
      }
    }
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
