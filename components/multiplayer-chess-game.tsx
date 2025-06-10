"use client"

import { useState, useEffect } from "react"
import type { Socket } from "socket.io-client"
import type { Room } from "@/types/multiplayer"
import type { GameState, Position, PieceColor, Piece } from "@/types/chess"
import { ChessSquare } from "./chess-square"
import { GameStatus } from "./multiplayer-game-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAvailableMoves } from "@/utils/move-calculator"

interface MultiplayerChessGameProps {
  room: Room
  socket: Socket | null
  onLeaveRoom: () => void
}

export function MultiplayerChessGame({ room: initialRoom, socket, onLeaveRoom }: MultiplayerChessGameProps) {
  const [room, setRoom] = useState<Room>(initialRoom)
  const [gameState, setGameState] = useState<GameState>(initialRoom.gameState)
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null)
  const [availableMoves, setAvailableMoves] = useState<Position[]>([])
  const [myPlayer, setMyPlayer] = useState(() => room.players.find((p) => p.id === localStorage.getItem("playerId")))

  useEffect(() => {
    if (!socket) return

    socket.on("gameStateUpdated", (newGameState) => {
      setGameState(newGameState)
      setSelectedPiece(null)
      setAvailableMoves([])
    })

    socket.on("gameStarted", () => {
      setRoom((prev) => ({ ...prev, isGameStarted: true }))
    })

    socket.on("gameReset", () => {
      setRoom((prev) => ({ ...prev, isGameStarted: false }))
      setSelectedPiece(null)
      setAvailableMoves([])
    })

    socket.on("playerJoined", (player) => {
      setRoom((prev) => ({
        ...prev,
        players: [...prev.players, player],
      }))
    })

    socket.on("playerLeft", (playerId) => {
      setRoom((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }))
    })

    socket.on("playerDisconnected", (playerId) => {
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p)),
      }))
    })

    socket.on("playerReconnected", (playerId) => {
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, isConnected: true } : p)),
      }))
    })

    return () => {
      socket.off("gameStateUpdated")
      socket.off("gameStarted")
      socket.off("gameReset")
      socket.off("playerJoined")
      socket.off("playerLeft")
      socket.off("playerDisconnected")
      socket.off("playerReconnected")
    }
  }, [])

  // Transform board coordinates based on player's perspective
  const transformBoardForPlayer = (playerColor: PieceColor | undefined): (Piece | null)[][] => {
    if (!playerColor) {
      return gameState.board // Default view if no player color
    }

    const board = gameState.board
    const transformedBoard: (Piece | null)[][] = Array(14)
      .fill(null)
      .map(() => Array(14).fill(null))

    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 14; col++) {
        let newRow = row
        let newCol = col

        switch (playerColor) {
          case "red":
            // Red sees the board normally
            newRow = row
            newCol = col
            break
          case "blue":
            // Blue sees the board rotated 90° counterclockwise
            newRow = 13 - col
            newCol = row
            break
          case "yellow":
            // Yellow sees the board rotated 180°
            newRow = 13 - row
            newCol = 13 - col
            break
          case "green":
            // Green sees the board rotated 90° clockwise
            newRow = col
            newCol = 13 - row
            break
        }

        transformedBoard[newRow][newCol] = board[row][col]
      }
    }

    return transformedBoard
  }

  // Transform a position from player's view to actual board coordinates
  const transformPositionToActual = (displayPos: Position, playerColor: PieceColor | undefined): Position => {
    if (!playerColor || playerColor === "red") {
      return displayPos // Red player's view matches actual coordinates
    }

    const { row, col } = displayPos

    switch (playerColor) {
      case "blue":
        // From Blue's view to actual: (row, col) -> (col, 13-row)
        return { row: col, col: 13 - row }
      case "yellow":
        // From Yellow's view to actual: (row, col) -> (13-row, 13-col)
        return { row: 13 - row, col: 13 - col }
      case "green":
        // From Green's view to actual: (row, col) -> (13-col, row)
        return { row: 13 - col, col: row }
      default:
        return displayPos
    }
  }

  // Transform a position from actual board coordinates to player's view
  const transformPositionToView = (actualPos: Position, playerColor: PieceColor | undefined): Position => {
    if (!playerColor || playerColor === "red") {
      return actualPos // Red player's view matches actual coordinates
    }

    const { row, col } = actualPos

    switch (playerColor) {
      case "blue":
        // From actual to Blue's view: (row, col) -> (13-col, row)
        return { row: 13 - col, col: row }
      case "yellow":
        // From actual to Yellow's view: (row, col) -> (13-row, 13-col)
        return { row: 13 - row, col: 13 - col }
      case "green":
        // From actual to Green's view: (row, col) -> (row, 13-col)
        return { row: col, col: 13 - row }
      default:
        return actualPos
    }
  }

  const handleSquareClick = (displayRow: number, displayCol: number) => {
    if (!socket || !room.isGameStarted || !myPlayer) return

    // Transform display coordinates to actual board coordinates
    const actualPos = transformPositionToActual({ row: displayRow, col: displayCol }, myPlayer.color)
    const piece = gameState.board[actualPos.row][actualPos.col]

    const isMyTurn = gameState.currentPlayer === myPlayer.color
    const isEliminated = gameState.eliminatedPlayers.includes(myPlayer.color)

    if (isEliminated || !isMyTurn) return

    // If no piece is selected and clicking on own piece
    if (!selectedPiece && piece && piece.color === myPlayer.color) {
      const actualMoves = getAvailableMoves(gameState.board, actualPos)
      // Transform moves to display coordinates
      const displayMoves = actualMoves.map((move) => transformPositionToView(move, myPlayer.color))

      setSelectedPiece({ row: displayRow, col: displayCol })
      setAvailableMoves(displayMoves)
      return
    }

    // If piece is selected
    if (selectedPiece) {
      // Clicking same piece - deselect
      if (selectedPiece.row === displayRow && selectedPiece.col === displayCol) {
        setSelectedPiece(null)
        setAvailableMoves([])
        return
      }

      // Clicking another own piece - select it
      if (piece && piece.color === myPlayer.color) {
        const actualMoves = getAvailableMoves(gameState.board, actualPos)
        const displayMoves = actualMoves.map((move) => transformPositionToView(move, myPlayer.color))

        setSelectedPiece({ row: displayRow, col: displayCol })
        setAvailableMoves(displayMoves)
        return
      }

      // Check if move is valid
      const isValidMove = availableMoves.some((move) => move.row === displayRow && move.col === displayCol)

      if (isValidMove) {
        // Transform selected piece coordinates to actual coordinates
        const actualSelectedPos = transformPositionToActual(selectedPiece, myPlayer.color)
        socket.emit("makeMove", actualSelectedPos, actualPos, myPlayer.id)
      }
    }
  }

  const startGame = () => {
    if (!socket || !myPlayer) return
    socket.emit("startGame", myPlayer.id)
  }

  const resetGame = () => {
    if (!socket || !myPlayer) return
    socket.emit("resetGame", myPlayer.id)
  }

  const isRoomCreator = myPlayer?.id === room.players[0]?.id
  const transformedBoard = transformBoardForPlayer(myPlayer?.color)

  return (
    <div className="w-full max-w-6xl">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Room: {room.name} ({room.id})
            </CardTitle>
            <Button variant="outline" onClick={onLeaveRoom}>
              Leave Room
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {["red", "blue", "yellow", "green"].map((color) => {
              const player = room.players.find((p) => p.color === color)
              const isEliminated = gameState.eliminatedPlayers.includes(color as any)
              const isCurrentPlayer = gameState.currentPlayer === color
              const isInCheck = gameState.playersInCheck.includes(color as any)

              return (
                <div
                  key={color}
                  className={`p-3 rounded border-2 ${
                    isCurrentPlayer ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  } ${isEliminated ? "opacity-50" : ""}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-${color}-400 mb-2`}></div>
                  <p className="font-medium">{player?.name || (room.isGameStarted ? "No player" : "Waiting...")}</p>
                  <p className="text-sm text-gray-500">
                    {player?.isConnected === false ? "Disconnected" : player ? "Connected" : "Empty"}
                  </p>
                  {isEliminated && <p className="text-red-500 text-sm">💀 Eliminated</p>}
                  {isInCheck && !isEliminated && <p className="text-red-500 text-sm">⚠️ In Check</p>}
                  {isCurrentPlayer && !isEliminated && <p className="text-blue-500 text-sm">👑 Current Turn</p>}
                </div>
              )
            })}
          </div>

          {!room.isGameStarted && (
            <div className="text-center space-y-4">
              <p>Waiting for game to start... ({room.players.length}/4 players)</p>
              {isRoomCreator && room.players.length >= 2 && <Button onClick={startGame}>Start Game</Button>}
              {isRoomCreator && room.players.length < 2 && (
                <p className="text-gray-500">Need at least 2 players to start</p>
              )}
            </div>
          )}

          {room.isGameStarted && (
            <div className="space-y-4">
              <GameStatus gameState={gameState} myPlayer={myPlayer} players={room.players} />

              <div className="flex justify-center">
                <div className="chess-board border-4 border-gray-800 bg-gray-600 p-1 shadow-2xl">
                  {transformedBoard.map((row, rowIndex) =>
                    row.map((piece, colIndex) => {
                      // Check if this position is selected in the player's view
                      const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex

                      // Check if this position is an available move in the player's view
                      const isAvailableMove = availableMoves.some(
                        (move) => move.row === rowIndex && move.col === colIndex,
                      )

                      // Check if the piece is a king in check
                      const isKingInCheck = piece?.type === "king" && gameState.playersInCheck.includes(piece.color)

                      return (
                        <ChessSquare
                          key={`${rowIndex}-${colIndex}`}
                          row={rowIndex}
                          col={colIndex}
                          piece={piece}
                          isSelected={isSelected}
                          isAvailableMove={isAvailableMove}
                          isKingInCheck={isKingInCheck}
                          onClick={() => handleSquareClick(rowIndex, colIndex)}
                          playerView={myPlayer?.color}
                        />
                      )
                    }),
                  )}
                </div>
              </div>

              {isRoomCreator && (
                <div className="text-center">
                  <Button variant="outline" onClick={resetGame}>
                    Reset Game
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
