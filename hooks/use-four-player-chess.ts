"use client"

import { useState, useCallback } from "react"
import type { GameState, PieceColor, Piece } from "@/types/chess"
import { initializeBoard } from "@/utils/board-setup"
import { getAvailableMoves } from "@/utils/move-calculator"
import { isPositionUnderAttack, findKingPosition } from "@/utils/game-logic"

// Updated player order to start with Red and go clockwise
const PLAYER_ORDER: PieceColor[] = ["red", "blue", "yellow", "green"]

export function useFourPlayerChess() {
  const [gameState, setGameState] = useState<GameState>({
    board: initializeBoard(),
    currentPlayer: "red", // Red starts the game
    selectedPiece: null,
    availableMoves: [],
    capturedPieces: {
      yellow: [],
      blue: [],
      green: [],
      red: [],
    },
    playersInCheck: [],
    eliminatedPlayers: [],
    gameWinner: null,
  })

  const checkGameStatus = useCallback(
    (board: (Piece | null)[][], currentPlayer: PieceColor) => {
      const playersInCheck: PieceColor[] = []
      const eliminatedPlayers: PieceColor[] = [...gameState.eliminatedPlayers]
      let newBoard = board.map((row) => [...row])

      // Check each active player
      PLAYER_ORDER.forEach((player) => {
        if (gameState.eliminatedPlayers.includes(player)) {
          return
        }

        const kingPosition = findKingPosition(newBoard, player)
        if (!kingPosition) {
          // King is missing, player is eliminated
          if (!eliminatedPlayers.includes(player)) {
            eliminatedPlayers.push(player)
            newBoard = removeAllPiecesOfColor(newBoard, player)
          }
          return
        }

        const isInCheck = isPositionUnderAttack(newBoard, kingPosition, player)
        if (isInCheck) {
          playersInCheck.push(player)

          // Check if player has any legal moves (checkmate)
          let hasLegalMoves = false
          for (let row = 0; row < 14; row++) {
            for (let col = 0; col < 14; col++) {
              const piece = newBoard[row][col]
              if (piece && piece.color === player) {
                const moves = getAvailableMoves(newBoard, { row, col })
                if (moves.length > 0) {
                  hasLegalMoves = true
                  break
                }
              }
            }
            if (hasLegalMoves) break
          }

          // If no legal moves and in check = checkmate
          if (!hasLegalMoves && !eliminatedPlayers.includes(player)) {
            eliminatedPlayers.push(player)
            newBoard = removeAllPiecesOfColor(newBoard, player)
          }
        }
      })

      const activePlayers = PLAYER_ORDER.filter((p) => !eliminatedPlayers.includes(p))
      const gameWinner = activePlayers.length === 1 ? activePlayers[0] : null

      return { playersInCheck, eliminatedPlayers, gameWinner, newBoard }
    },
    [gameState.eliminatedPlayers],
  )

  // Function to remove all pieces of a specific color from the board
  const removeAllPiecesOfColor = useCallback((board: (Piece | null)[][], color: PieceColor): (Piece | null)[][] => {
    const newBoard = board.map((row) => [...row])

    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 14; col++) {
        const piece = newBoard[row][col]
        if (piece && piece.color === color) {
          newBoard[row][col] = null
        }
      }
    }

    return newBoard
  }, [])

  const getNextPlayer = useCallback((currentPlayer: PieceColor, eliminatedPlayers: PieceColor[]): PieceColor => {
    const currentIndex = PLAYER_ORDER.indexOf(currentPlayer)
    let nextIndex = (currentIndex + 1) % PLAYER_ORDER.length

    // Skip eliminated players
    while (eliminatedPlayers.includes(PLAYER_ORDER[nextIndex])) {
      nextIndex = (nextIndex + 1) % PLAYER_ORDER.length
    }

    return PLAYER_ORDER[nextIndex]
  }, [])

  const handleSquareClick = useCallback(
    (row: number, col: number) => {
      const { board, currentPlayer, selectedPiece, eliminatedPlayers } = gameState

      // Don't allow moves if player is eliminated
      if (eliminatedPlayers.includes(currentPlayer)) return

      const piece = board[row][col]

      // If no piece is selected and the clicked square has a piece of the current player's color
      if (!selectedPiece && piece && piece.color === currentPlayer) {
        const availableMoves = getAvailableMoves(board, { row, col })
        setGameState((prev) => ({
          ...prev,
          selectedPiece: { row, col },
          availableMoves,
        }))
        return
      }

      // If a piece is already selected
      if (selectedPiece) {
        // If clicking on the same piece, deselect it
        if (selectedPiece.row === row && selectedPiece.col === col) {
          setGameState((prev) => ({
            ...prev,
            selectedPiece: null,
            availableMoves: [],
          }))
          return
        }

        // If clicking on another piece of the same color, select that piece instead
        if (piece && piece.color === currentPlayer) {
          const availableMoves = getAvailableMoves(board, { row, col })
          setGameState((prev) => ({
            ...prev,
            selectedPiece: { row, col },
            availableMoves,
          }))
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

          // Update piece's hasMoved status
          movingPiece.hasMoved = true

          // Handle castling
          if (movingPiece.type === "king" && Math.abs(col - selectedPiece.col) === 2) {
            // This is a castling move
            const isKingSide = col > selectedPiece.col
            const rookCol = isKingSide ? selectedPiece.col + 3 : selectedPiece.col - 4
            const rookNewCol = isKingSide ? selectedPiece.col + 1 : selectedPiece.col - 1

            // Move the rook
            const rook = { ...newBoard[selectedPiece.row][rookCol]! }
            rook.hasMoved = true
            newBoard[selectedPiece.row][rookNewCol] = rook
            newBoard[selectedPiece.row][rookCol] = null
          }

          // Handle pawn promotion (8th rank from each player's perspective)
          if (movingPiece.type === "pawn") {
            const isPromotion =
              (currentPlayer === "yellow" && row === 7) || // Yellow: 8th rank from row 1 (1+6=7)
              (currentPlayer === "red" && row === 6) || // Red: 8th rank from row 12 (12-6=6)
              (currentPlayer === "blue" && col === 7) || // Blue: 8th rank from col 1 (1+6=7)
              (currentPlayer === "green" && col === 6) // Green: 8th rank from col 12 (12-6=6)

            if (isPromotion) {
              movingPiece.type = "queen" // Auto-promote to queen
            }
          }

          // Apply the move
          newBoard[row][col] = movingPiece
          newBoard[selectedPiece.row][selectedPiece.col] = null

          // Check game status
          const {
            playersInCheck,
            eliminatedPlayers: newEliminatedPlayers,
            gameWinner,
            newBoard: updatedBoard,
          } = checkGameStatus(newBoard, currentPlayer)

          // Get next player
          const nextPlayer = gameWinner ? currentPlayer : getNextPlayer(currentPlayer, newEliminatedPlayers)

          setGameState((prev) => ({
            ...prev,
            board: updatedBoard,
            currentPlayer: nextPlayer,
            selectedPiece: null,
            availableMoves: [],
            capturedPieces: newCapturedPieces,
            playersInCheck,
            eliminatedPlayers: newEliminatedPlayers,
            gameWinner,
          }))
        }
      }
    },
    [gameState, checkGameStatus, getNextPlayer],
  )

  const resetGame = useCallback(() => {
    setGameState({
      board: initializeBoard(),
      currentPlayer: "red", // Red starts
      selectedPiece: null,
      availableMoves: [],
      capturedPieces: {
        yellow: [],
        blue: [],
        green: [],
        red: [],
      },
      playersInCheck: [],
      eliminatedPlayers: [],
      gameWinner: null,
    })
  }, [])

  return {
    gameState,
    handleSquareClick,
    resetGame,
  }
}
