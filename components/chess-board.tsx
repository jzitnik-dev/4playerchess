"use client"

import { useState, useEffect } from "react"
import { ChessPiece } from "./chess-piece"
import { GameControls } from "./game-controls"
import { GameStatus } from "./game-status"

// Chess piece types and colors
type PieceType = "pawn" | "rook" | "knight" | "bishop" | "queen" | "king"
type PieceColor = "white" | "black"

// Piece representation
interface Piece {
  type: PieceType
  color: PieceColor
  hasMoved?: boolean
}

// Position on the board
interface Position {
  row: number
  col: number
}

// Game state
interface GameState {
  board: (Piece | null)[][]
  currentPlayer: PieceColor
  selectedPiece: Position | null
  availableMoves: Position[]
  capturedPieces: {
    white: Piece[]
    black: Piece[]
  }
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
}

export function ChessBoard() {
  const [gameState, setGameState] = useState<GameState>({
    board: initializeBoard(),
    currentPlayer: "white",
    selectedPiece: null,
    availableMoves: [],
    capturedPieces: {
      white: [],
      black: [],
    },
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
  })

  // Check for check, checkmate, or stalemate after each move
  useEffect(() => {
    const { board, currentPlayer, isCheck, isCheckmate, isStalemate } = gameState

    // Find the king of the current player
    let kingPosition: Position | null = null
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece && piece.type === "king" && piece.color === currentPlayer) {
          kingPosition = { row, col }
          break
        }
      }
      if (kingPosition) break
    }

    if (kingPosition) {
      // Check if the king is in check
      const isInCheck = isPositionUnderAttack(board, kingPosition, currentPlayer)

      // Check if there are any legal moves
      let hasLegalMoves = false
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col]
          if (piece && piece.color === currentPlayer) {
            const moves = getAvailableMoves(board, { row, col }, { ...gameState, isCheck: isInCheck })
            if (moves.length > 0) {
              hasLegalMoves = true
              break
            }
          }
        }
        if (hasLegalMoves) break
      }

      const newIsCheck = isInCheck
      const newIsCheckmate = isInCheck && !hasLegalMoves
      const newIsStalemate = !isInCheck && !hasLegalMoves

      // Only update state if the values have actually changed
      if (
        gameState.isCheck !== newIsCheck ||
        gameState.isCheckmate !== newIsCheckmate ||
        gameState.isStalemate !== newIsStalemate
      ) {
        setGameState((prev) => ({
          ...prev,
          isCheck: newIsCheck,
          isCheckmate: newIsCheckmate,
          isStalemate: newIsStalemate,
        }))
      }
    }
  }, [gameState.board, gameState.currentPlayer])

  // Initialize the chess board
  function initializeBoard(): (Piece | null)[][] {
    const board: (Piece | null)[][] = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null))

    // Set up pawns
    for (let col = 0; col < 8; col++) {
      board[1][col] = { type: "pawn", color: "black" }
      board[6][col] = { type: "pawn", color: "white" }
    }

    // Set up rooks
    board[0][0] = { type: "rook", color: "black" }
    board[0][7] = { type: "rook", color: "black" }
    board[7][0] = { type: "rook", color: "white" }
    board[7][7] = { type: "rook", color: "white" }

    // Set up knights
    board[0][1] = { type: "knight", color: "black" }
    board[0][6] = { type: "knight", color: "black" }
    board[7][1] = { type: "knight", color: "white" }
    board[7][6] = { type: "knight", color: "white" }

    // Set up bishops
    board[0][2] = { type: "bishop", color: "black" }
    board[0][5] = { type: "bishop", color: "black" }
    board[7][2] = { type: "bishop", color: "white" }
    board[7][5] = { type: "bishop", color: "white" }

    // Set up queens
    board[0][3] = { type: "queen", color: "black" }
    board[7][3] = { type: "queen", color: "white" }

    // Set up kings
    board[0][4] = { type: "king", color: "black" }
    board[7][4] = { type: "king", color: "white" }

    return board
  }

  // Check if a position is under attack by the opponent
  function isPositionUnderAttack(board: (Piece | null)[][], position: Position, playerColor: PieceColor): boolean {
    const opponentColor = playerColor === "white" ? "black" : "white"

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece && piece.color === opponentColor) {
          const moves = getAvailableMovesWithoutCheckValidation(board, { row, col })
          if (moves.some((move) => move.row === position.row && move.col === position.col)) {
            return true
          }
        }
      }
    }

    return false
  }

  // Get available moves for a piece without check validation (to avoid infinite recursion)
  function getAvailableMovesWithoutCheckValidation(board: (Piece | null)[][], position: Position): Position[] {
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
        getKingMoves(board, position, piece.color, moves)
        break
    }

    return moves
  }

  // Get all available moves for a piece
  function getAvailableMoves(board: (Piece | null)[][], position: Position, gameState: GameState): Position[] {
    const moves = getAvailableMovesWithoutCheckValidation(board, position)
    const { row, col } = position
    const piece = board[row][col]

    if (!piece) return []

    // Filter out moves that would put or leave the king in check
    return moves.filter((move) => {
      // Create a copy of the board to simulate the move
      const newBoard = board.map((row) => [...row])
      newBoard[move.row][move.col] = piece
      newBoard[row][col] = null

      // Find the king's position
      let kingPosition: Position | null = null
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = newBoard[r][c]
          if (p && p.type === "king" && p.color === piece.color) {
            kingPosition = { row: r, col: c }
            break
          }
        }
        if (kingPosition) break
      }

      // If king not found (shouldn't happen), allow the move
      if (!kingPosition) return true

      // Check if the king would be in check after the move
      return !isPositionUnderAttack(newBoard, kingPosition, piece.color)
    })
  }

  // Get pawn moves
  function getPawnMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
    const { row, col } = position
    const direction = color === "white" ? -1 : 1
    const startRow = color === "white" ? 6 : 1

    // Move forward one square
    if (row + direction >= 0 && row + direction < 8 && !board[row + direction][col]) {
      moves.push({ row: row + direction, col })

      // Move forward two squares from starting position
      if (row === startRow && !board[row + 2 * direction][col]) {
        moves.push({ row: row + 2 * direction, col })
      }
    }

    // Capture diagonally
    const capturePositions = [
      { row: row + direction, col: col - 1 },
      { row: row + direction, col: col + 1 },
    ]

    capturePositions.forEach((pos) => {
      if (pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8) {
        const targetPiece = board[pos.row][pos.col]
        if (targetPiece && targetPiece.color !== color) {
          moves.push(pos)
        }
      }
    })
  }

  // Get rook moves
  function getRookMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
    const { row, col } = position
    const directions = [
      { dr: -1, dc: 0 }, // up
      { dr: 1, dc: 0 }, // down
      { dr: 0, dc: -1 }, // left
      { dr: 0, dc: 1 }, // right
    ]

    directions.forEach((dir) => {
      let r = row + dir.dr
      let c = col + dir.dc

      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const targetPiece = board[r][c]

        if (!targetPiece) {
          moves.push({ row: r, col: c })
        } else {
          if (targetPiece.color !== color) {
            moves.push({ row: r, col: c })
          }
          break
        }

        r += dir.dr
        c += dir.dc
      }
    })
  }

  // Get knight moves
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
      const r = row + move.dr
      const c = col + move.dc

      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const targetPiece = board[r][c]

        if (!targetPiece || targetPiece.color !== color) {
          moves.push({ row: r, col: c })
        }
      }
    })
  }

  // Get bishop moves
  function getBishopMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
    const { row, col } = position
    const directions = [
      { dr: -1, dc: -1 }, // up-left
      { dr: -1, dc: 1 }, // up-right
      { dr: 1, dc: -1 }, // down-left
      { dr: 1, dc: 1 }, // down-right
    ]

    directions.forEach((dir) => {
      let r = row + dir.dr
      let c = col + dir.dc

      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const targetPiece = board[r][c]

        if (!targetPiece) {
          moves.push({ row: r, col: c })
        } else {
          if (targetPiece.color !== color) {
            moves.push({ row: r, col: c })
          }
          break
        }

        r += dir.dr
        c += dir.dc
      }
    })
  }

  // Get queen moves (combination of rook and bishop)
  function getQueenMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
    getRookMoves(board, position, color, moves)
    getBishopMoves(board, position, color, moves)
  }

  // Get king moves
  function getKingMoves(board: (Piece | null)[][], position: Position, color: PieceColor, moves: Position[]) {
    const { row, col } = position
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
      const r = row + move.dr
      const c = col + move.dc

      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const targetPiece = board[r][c]

        if (!targetPiece || targetPiece.color !== color) {
          moves.push({ row: r, col: c })
        }
      }
    })
  }

  // Handle clicking on a square
  function handleSquareClick(row: number, col: number) {
    const { board, currentPlayer, selectedPiece } = gameState
    const piece = board[row][col]

    // If no piece is selected and the clicked square has a piece of the current player's color
    if (!selectedPiece && piece && piece.color === currentPlayer) {
      const availableMoves = getAvailableMoves(board, { row, col }, gameState)
      setGameState({
        ...gameState,
        selectedPiece: { row, col },
        availableMoves,
      })
      return
    }

    // If a piece is already selected
    if (selectedPiece) {
      // If clicking on the same piece, deselect it
      if (selectedPiece.row === row && selectedPiece.col === col) {
        setGameState({
          ...gameState,
          selectedPiece: null,
          availableMoves: [],
        })
        return
      }

      // If clicking on another piece of the same color, select that piece instead
      if (piece && piece.color === currentPlayer) {
        const availableMoves = getAvailableMoves(board, { row, col }, gameState)
        setGameState({
          ...gameState,
          selectedPiece: { row, col },
          availableMoves,
        })
        return
      }

      // Check if the move is valid
      const isValidMove = gameState.availableMoves.some((move) => move.row === row && move.col === col)

      if (isValidMove) {
        // Create a new board with the move applied
        const newBoard = board.map((r) => [...r])
        const movingPiece = { ...newBoard[selectedPiece.row][selectedPiece.col]! }

        // Track if a piece was captured
        const capturedPiece = newBoard[row][col]
        const newCapturedPieces = { ...gameState.capturedPieces }

        if (capturedPiece) {
          newCapturedPieces[currentPlayer] = [...newCapturedPieces[currentPlayer], capturedPiece]
        }

        // Update piece's hasMoved status (for pawns, kings, rooks)
        movingPiece.hasMoved = true

        // Handle pawn promotion
        if (movingPiece.type === "pawn" && (row === 0 || row === 7)) {
          movingPiece.type = "queen" // Auto-promote to queen for simplicity
        }

        // Apply the move
        newBoard[row][col] = movingPiece
        newBoard[selectedPiece.row][selectedPiece.col] = null

        // Switch to the other player's turn
        setGameState({
          ...gameState,
          board: newBoard,
          currentPlayer: currentPlayer === "white" ? "black" : "white",
          selectedPiece: null,
          availableMoves: [],
          capturedPieces: newCapturedPieces,
        })
      }
    }
  }

  // Reset the game
  function resetGame() {
    setGameState({
      board: initializeBoard(),
      currentPlayer: "white",
      selectedPiece: null,
      availableMoves: [],
      capturedPieces: {
        white: [],
        black: [],
      },
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
    })
  }

  // Render the chess board
  return (
    <div className="flex flex-col items-center">
      <GameStatus
        currentPlayer={gameState.currentPlayer}
        isCheck={gameState.isCheck}
        isCheckmate={gameState.isCheckmate}
        isStalemate={gameState.isStalemate}
      />

      <div className="flex my-4">
        <div className="mr-4">
          <div className="grid grid-cols-8 border-2 border-gray-800">
            {Array(8)
              .fill(null)
              .map((_, rowIndex) =>
                Array(8)
                  .fill(null)
                  .map((_, colIndex) => {
                    const isSelected =
                      gameState.selectedPiece?.row === rowIndex && gameState.selectedPiece?.col === colIndex
                    const isAvailableMove = gameState.availableMoves.some(
                      (move) => move.row === rowIndex && move.col === colIndex,
                    )
                    const piece = gameState.board[rowIndex][colIndex]

                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`
                      w-16 h-16 flex items-center justify-center
                      ${(rowIndex + colIndex) % 2 === 0 ? "bg-amber-100" : "bg-amber-800"}
                      ${isSelected ? "ring-4 ring-blue-500 ring-inset" : ""}
                      ${isAvailableMove ? "ring-4 ring-green-500 ring-inset" : ""}
                      relative
                    `}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                      >
                        {piece && <ChessPiece type={piece.type} color={piece.color} />}
                        {isAvailableMove && !piece && (
                          <div className="absolute w-4 h-4 rounded-full bg-green-500 opacity-60"></div>
                        )}
                        {rowIndex === 7 && (
                          <div className="absolute bottom-0 left-1 text-xs">{String.fromCharCode(97 + colIndex)}</div>
                        )}
                        {colIndex === 0 && <div className="absolute top-0 left-1 text-xs">{8 - rowIndex}</div>}
                      </div>
                    )
                  }),
              )}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold mb-2">Captured by White</h3>
            <div className="flex flex-wrap gap-1 max-w-[120px]">
              {gameState.capturedPieces.white.map((piece, index) => (
                <div key={index} className="w-6 h-6">
                  <ChessPiece type={piece.type} color={piece.color} small />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-2">Captured by Black</h3>
            <div className="flex flex-wrap gap-1 max-w-[120px]">
              {gameState.capturedPieces.black.map((piece, index) => (
                <div key={index} className="w-6 h-6">
                  <ChessPiece type={piece.type} color={piece.color} small />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <GameControls onReset={resetGame} />
    </div>
  )
}
