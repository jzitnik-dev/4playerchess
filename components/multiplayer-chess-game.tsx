"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Socket } from "socket.io-client"
import type { Room, Player } from "@/types/multiplayer"
import type { GameState, Position, PieceColor, Piece, Move } from "@/types/chess"
import { ChessSquare } from "./chess-square"
import { GameStatus } from "./multiplayer-game-status"
import { MoveHistory } from "./move-history"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAvailableMoves } from "@/utils/move-calculator"

const PLAYER_ORDER: PieceColor[] = ["red", "blue", "yellow", "green"]

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

  // Ensure moveHistory is always initialized as an array
  const [moveHistory, setMoveHistory] = useState<Move[]>(initialRoom.gameState.moveHistory || [])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [isViewingHistory, setIsViewingHistory] = useState(false)
  const [displayedGameState, setDisplayedGameState] = useState<GameState>(initialRoom.gameState)

  const isViewingHistoryRef = useRef(isViewingHistory)
  useEffect(() => {
    isViewingHistoryRef.current = isViewingHistory
  }, [isViewingHistory])

  const gameStateRef = useRef(gameState)
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  const initializeBoard = (): (Piece | null)[][] => {
    const board: (Piece | null)[][] = Array(14)
      .fill(null)
      .map(() => Array(14).fill(null))
    const backPieces: Piece["type"][] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
    for (let i = 0; i < 8; i++) {
      board[0][3 + i] = { type: backPieces[i], color: "yellow" }
      board[1][3 + i] = { type: "pawn", color: "yellow" }
    }
    for (let i = 0; i < 8; i++) {
      board[3 + i][0] = { type: backPieces[i], color: "blue" }
      board[3 + i][1] = { type: "pawn", color: "blue" }
    }
    for (let i = 0; i < 8; i++) {
      board[13][3 + i] = { type: backPieces[i], color: "red" }
      board[12][3 + i] = { type: "pawn", color: "red" }
    }
    for (let i = 0; i < 8; i++) {
      board[3 + i][13] = { type: backPieces[i], color: "green" }
      board[3 + i][12] = { type: "pawn", color: "green" }
    }
    return board
  }

  const reconstructGameStateAtMove = useCallback(
    (moveIdx: number): GameState => {
      const board = initializeBoard()
      const capturedPiecesHistory = { yellow: [], blue: [], green: [], red: [] }
      let finalEliminatedPlayersList: PieceColor[] = []

      // Apply moves one by one up to moveIdx
      for (let i = 0; i <= moveIdx && i < moveHistory.length; i++) {
        const move = moveHistory[i]

        const pieceToPlace = { ...move.piece, hasMoved: true }
        board[move.to.row][move.to.col] = pieceToPlace
        board[move.from.row][move.from.col] = null

        if (move.capturedPiece) {
          capturedPiecesHistory[move.playerColor].push(move.capturedPiece)
        }
        // The list of eliminated players after *this specific move* (move i)
        finalEliminatedPlayersList = move.eliminatedPlayersAfterMove ? [...move.eliminatedPlayersAfterMove] : []
      }

      // After all moves in the sequence are applied to the board,
      // ensure pieces of all players in `finalEliminatedPlayersList` (from the last processed move) are removed.
      finalEliminatedPlayersList.forEach((eliminatedColor) => {
        for (let r = 0; r < 14; r++) {
          for (let c = 0; c < 14; c++) {
            if (board[r][c]?.color === eliminatedColor) {
              board[r][c] = null
            }
          }
        }
      })

      let currentPlayerForHistory: PieceColor = "red"
      if (moveIdx >= 0 && moveHistory[moveIdx]) {
        const lastMovePlayerColor = moveHistory[moveIdx].playerColor
        const lastMoverIndex = PLAYER_ORDER.indexOf(lastMovePlayerColor)
        let nextPlayerIndex = (lastMoverIndex + 1) % PLAYER_ORDER.length

        let safetyBreak = PLAYER_ORDER.length
        while (finalEliminatedPlayersList.includes(PLAYER_ORDER[nextPlayerIndex]) && safetyBreak > 0) {
          nextPlayerIndex = (nextPlayerIndex + 1) % PLAYER_ORDER.length
          safetyBreak--
        }
        if (safetyBreak > 0) {
          currentPlayerForHistory = PLAYER_ORDER[nextPlayerIndex]
        } else {
          const activePlayers = PLAYER_ORDER.filter((p) => !finalEliminatedPlayersList.includes(p))
          if (activePlayers.length === 1) currentPlayerForHistory = activePlayers[0]
          else if (activePlayers.length === 0 && finalEliminatedPlayersList.length < PLAYER_ORDER.length) {
            // This case implies a draw or an issue, try to find any non-eliminated player if possible
            // Or default to the winner if one was determined by the last move
            const winner = PLAYER_ORDER.find((p) => !finalEliminatedPlayersList.includes(p))
            if (winner) currentPlayerForHistory = winner
          }
        }
      }

      return {
        board,
        currentPlayer: currentPlayerForHistory,
        selectedPiece: null,
        availableMoves: [],
        capturedPieces: capturedPiecesHistory,
        playersInCheck: [],
        eliminatedPlayers: finalEliminatedPlayersList,
        gameWinner: null,
        moveHistory: moveHistory.slice(0, moveIdx + 1),
      }
    },
    [moveHistory], // Dependency: only moveHistory
  )

  const navigateHistory = useCallback(
    (direction: "previous" | "next" | "first" | "current" | number) => {
      const currentMoveHistory = gameStateRef.current.moveHistory || [] // Use history from current gameState
      if (currentMoveHistory.length === 0 && typeof direction !== "number") return

      let newIndex: number
      if (typeof direction === "number") {
        newIndex = direction
      } else {
        switch (direction) {
          case "previous":
            newIndex = currentMoveIndex <= 0 ? 0 : currentMoveIndex - 1
            break
          case "next":
            newIndex =
              currentMoveIndex === -1 || currentMoveIndex >= currentMoveHistory.length - 1 ? -1 : currentMoveIndex + 1
            break
          case "first":
            newIndex = currentMoveHistory.length > 0 ? 0 : -1
            break
          case "current":
            newIndex = -1
            break
          default:
            return
        }
      }

      setCurrentMoveIndex(newIndex)
      const newIsViewingHistory = newIndex !== -1
      setIsViewingHistory(newIsViewingHistory)

      if (newIsViewingHistory) {
        // Pass the up-to-date moveHistory from gameStateRef to reconstruction
        setDisplayedGameState(reconstructGameStateAtMove(newIndex))
      } else {
        setDisplayedGameState(gameStateRef.current)
      }
      setSelectedPiece(null)
      setAvailableMoves([])
    },
    [currentMoveIndex, reconstructGameStateAtMove], // gameStateRef is implicitly used via reconstructGameStateAtMove's dependency on moveHistory
  )

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault()
          navigateHistory("previous")
          break
        case "ArrowRight":
          event.preventDefault()
          navigateHistory("next")
          break
        case "Home":
          event.preventDefault()
          navigateHistory("first")
          break
        case "End":
          event.preventDefault()
          navigateHistory("current")
          break
      }
    }
    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [navigateHistory])

  useEffect(() => {
    if (!socket) return

    // This handler receives the definitive move and the full resulting gameState
    const handleMoveExecuted = (data: { move: Move; gameState: GameState }) => {
      setGameState(data.gameState) // Authoritative state from server
      setMoveHistory(data.gameState.moveHistory || []) // Authoritative history from server
      if (!isViewingHistoryRef.current) {
        setDisplayedGameState(data.gameState)
      }
      setSelectedPiece(null)
      setAvailableMoves([])
    }

    // This handler is for general gameState updates (e.g., on join, reset)
    const handleGameStateUpdate = (newGameState: GameState) => {
      setGameState(newGameState)
      setMoveHistory(newGameState.moveHistory || []) // Authoritative history from server
      if (!isViewingHistoryRef.current) {
        setDisplayedGameState(newGameState)
      }
      // If game is reset, ensure history view is also reset
      if (!newGameState.moveHistory || newGameState.moveHistory.length === 0) {
        setCurrentMoveIndex(-1)
        setIsViewingHistory(false)
      }
    }

    const handleGameReset = () => {
      // The new GameState will be sent via gameStateUpdated, which will reset history
      setRoom((prev) => ({ ...prev, isGameStarted: false }))
      // Client-side state resets that depend on UI interaction rather than just data
      setCurrentMoveIndex(-1)
      setIsViewingHistory(false)
      setSelectedPiece(null)
      setAvailableMoves([])
    }

    const handleGameStarted = () => setRoom((prev) => ({ ...prev, isGameStarted: true }))
    const handlePlayerJoined = (player: Player) => setRoom((prev) => ({ ...prev, players: [...prev.players, player] }))
    const handlePlayerLeft = (playerId: string) =>
      setRoom((prev) => ({ ...prev, players: prev.players.filter((p) => p.id !== playerId) }))
    const handlePlayerDisconnected = (playerId: string) =>
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p)),
      }))
    const handlePlayerReconnected = (playerId: string) =>
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, isConnected: true } : p)),
      }))

    socket.on("moveExecuted", handleMoveExecuted)
    socket.on("gameStateUpdated", handleGameStateUpdate)
    socket.on("gameStarted", handleGameStarted)
    socket.on("gameReset", handleGameReset)
    socket.on("playerJoined", handlePlayerJoined)
    socket.on("playerLeft", handlePlayerLeft)
    socket.on("playerDisconnected", handlePlayerDisconnected)
    socket.on("playerReconnected", handlePlayerReconnected)

    return () => {
      socket.off("moveExecuted")
      socket.off("gameStateUpdated")
      socket.off("gameStarted", handleGameStarted)
      socket.off("gameReset")
      socket.off("playerJoined")
      socket.off("playerLeft")
      socket.off("playerDisconnected")
      socket.off("playerReconnected")
    }
  }, [socket]) // Removed reconstructGameStateAtMove from here as it's not directly called by socket events

  const transformBoardForPlayer = useCallback(
    (playerColor: PieceColor | undefined): (Piece | null)[][] => {
      const boardToTransform = displayedGameState.board
      if (!playerColor) return boardToTransform
      const transformedBoard: (Piece | null)[][] = Array(14)
        .fill(null)
        .map(() => Array(14).fill(null))
      for (let row = 0; row < 14; row++) {
        for (let col = 0; col < 14; col++) {
          let newRow = row,
            newCol = col
          switch (playerColor) {
            case "blue":
              newRow = 13 - col
              newCol = row
              break
            case "yellow":
              newRow = 13 - row
              newCol = 13 - col
              break
            case "green":
              newRow = col
              newCol = 13 - row
              break
          }
          transformedBoard[newRow][newCol] = boardToTransform[row][col]
        }
      }
      return transformedBoard
    },
    [displayedGameState.board],
  )

  const transformPositionToActual = useCallback(
    (displayPos: Position, playerColor: PieceColor | undefined): Position => {
      if (!playerColor || playerColor === "red") return displayPos
      switch (playerColor) {
        case "blue":
          return { row: displayPos.col, col: 13 - displayPos.row }
        case "yellow":
          return { row: 13 - displayPos.row, col: 13 - displayPos.col }
        case "green":
          return { row: 13 - displayPos.col, col: displayPos.row }
        default:
          return displayPos
      }
    },
    [],
  )

  const transformPositionToView = useCallback((actualPos: Position, playerColor: PieceColor | undefined): Position => {
    if (!playerColor || playerColor === "red") return actualPos
    switch (playerColor) {
      case "blue":
        return { row: 13 - actualPos.col, col: actualPos.row }
      case "yellow":
        return { row: 13 - actualPos.row, col: 13 - actualPos.col }
      case "green":
        return { row: actualPos.col, col: 13 - actualPos.row }
      default:
        return actualPos
    }
  }, [])

  const handleSquareClick = (displayRow: number, displayCol: number) => {
    if (!socket || !room.isGameStarted || !myPlayer || isViewingHistoryRef.current) return

    const actualPos = transformPositionToActual({ row: displayRow, col: displayCol }, myPlayer.color)
    const piece = gameState.board[actualPos.row][actualPos.col] // Use live gameState for interaction

    const isMyTurn = gameState.currentPlayer === myPlayer.color
    const isEliminated = gameState.eliminatedPlayers.includes(myPlayer.color)

    if (isEliminated || !isMyTurn) return

    if (!selectedPiece && piece && piece.color === myPlayer.color) {
      const actualMoves = getAvailableMoves(gameState.board, actualPos)
      const displayMoves = actualMoves.map((move) => transformPositionToView(move, myPlayer.color))
      setSelectedPiece({ row: displayRow, col: displayCol })
      setAvailableMoves(displayMoves)
      return
    }

    if (selectedPiece) {
      if (selectedPiece.row === displayRow && selectedPiece.col === displayCol) {
        setSelectedPiece(null)
        setAvailableMoves([])
        return
      }
      if (piece && piece.color === myPlayer.color) {
        const actualMoves = getAvailableMoves(gameState.board, actualPos)
        const displayMoves = actualMoves.map((move) => transformPositionToView(move, myPlayer.color))
        setSelectedPiece({ row: displayRow, col: displayCol })
        setAvailableMoves(displayMoves)
        return
      }
      const isValidMove = availableMoves.some((move) => move.row === displayRow && move.col === displayCol)
      if (isValidMove) {
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
  const currentTransformedBoard = transformBoardForPlayer(myPlayer?.color)

  return (
    <div className="w-full max-w-7xl">
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
            {PLAYER_ORDER.map((color) => {
              const player = room.players.find((p) => p.color === color)
              // Use live gameState for player status display
              const isEliminated = gameState.eliminatedPlayers.includes(color)
              const isCurrentPlayer = gameState.currentPlayer === color
              const isInCheck = gameState.playersInCheck.includes(color)

              return (
                <div
                  key={color}
                  className={`p-3 rounded border-2 ${
                    isCurrentPlayer ? "border-blue-500 bg-blue-50" : "border-gray-200"
                  } ${isEliminated ? "opacity-50" : ""}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full mb-2 ${
                      color === "red"
                        ? "bg-red-400"
                        : color === "blue"
                          ? "bg-blue-400"
                          : color === "yellow"
                            ? "bg-yellow-400"
                            : "bg-green-400"
                    }`}
                  ></div>
                  <p className="font-medium">{player?.name || (room.isGameStarted ? "AI/Empty" : "Waiting...")}</p>
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
              {isRoomCreator && room.players.length >= 1 && <Button onClick={startGame}>Start Game</Button>}
              {isRoomCreator && room.players.length < 1 && (
                <p className="text-gray-500">Need at least 1 player to start</p>
              )}
            </div>
          )}

          {room.isGameStarted && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-4">
                <GameStatus gameState={gameState} myPlayer={myPlayer} players={room.players} />
                {isViewingHistory && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-blue-700 font-medium">
                      Viewing move {currentMoveIndex + 1} of {moveHistory.length}
                    </p>
                    <p className="text-blue-600 text-sm">
                      Use ← → arrow keys or click moves to navigate • Press End to return to current position
                    </p>
                  </div>
                )}
                <div className="flex justify-center">
                  <div className="chess-board border-4 border-gray-800 bg-gray-600 p-1 shadow-2xl">
                    {currentTransformedBoard.map((rowItems, rowIndex) =>
                      rowItems.map((piece, colIndex) => {
                        const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex
                        const isAvailableMove = availableMoves.some(
                          (move) => move.row === rowIndex && move.col === colIndex,
                        )
                        // Use displayedGameState for visual check status during history viewing
                        const kingInCheckVisual =
                          piece?.type === "king" && displayedGameState.playersInCheck.includes(piece.color)

                        return (
                          <ChessSquare
                            key={`${rowIndex}-${colIndex}`}
                            row={rowIndex}
                            col={colIndex}
                            piece={piece}
                            isSelected={isSelected && !isViewingHistory}
                            isAvailableMove={isAvailableMove && !isViewingHistory}
                            isKingInCheck={kingInCheckVisual}
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
              <div className="lg:col-span-1">
                <MoveHistory
                  moves={moveHistory}
                  currentMoveIndex={currentMoveIndex}
                  onMoveClick={navigateHistory}
                  onNavigate={navigateHistory}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
