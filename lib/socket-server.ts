import { Server } from "socket.io"
import type { Server as HTTPServer } from "http"
import type { ServerToClientEvents, ClientToServerEvents, Room, Player } from "@/types/multiplayer"
import type { PieceColor } from "@/types/chess"
import { initializeBoard } from "@/utils/board-setup"
import { getAvailableMoves } from "@/utils/move-calculator"
import { isPositionUnderAttack, findKingPosition } from "@/utils/game-logic"

const rooms = new Map<string, Room>()
const playerRooms = new Map<string, string>() // socketId -> roomId

const PLAYER_ORDER: PieceColor[] = ["red", "blue", "yellow", "green"]

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    socket.on("createRoom", (roomName, playerName) => {
      const roomId = generateRoomId()
      const player: Player = {
        id: socket.id,
        name: playerName,
        color: "red", // First player gets red
        isConnected: true,
      }

      const room: Room = {
        id: roomId,
        name: roomName,
        players: [player],
        gameState: {
          board: initializeBoard(),
          currentPlayer: "red",
          selectedPiece: null,
          availableMoves: [],
          capturedPieces: { yellow: [], blue: [], green: [], red: [] },
          playersInCheck: [],
          eliminatedPlayers: [],
          gameWinner: null,
        },
        isGameStarted: false,
        createdAt: new Date(),
      }

      rooms.set(roomId, room)
      playerRooms.set(socket.id, roomId)
      socket.join(roomId)

      socket.emit("roomCreated", room)
      console.log(`Room created: ${roomId} by ${playerName}`)
    })

    socket.on("joinRoom", (roomId, playerName) => {
      const room = rooms.get(roomId)
      if (!room) {
        socket.emit("error", "Room not found")
        return
      }

      if (room.players.length >= 4) {
        socket.emit("error", "Room is full")
        return
      }

      if (room.isGameStarted) {
        socket.emit("error", "Game already started")
        return
      }

      // Assign next available color
      const usedColors = room.players.map((p) => p.color)
      const availableColor = PLAYER_ORDER.find((color) => !usedColors.includes(color))

      if (!availableColor) {
        socket.emit("error", "No available player slots")
        return
      }

      const player: Player = {
        id: socket.id,
        name: playerName,
        color: availableColor,
        isConnected: true,
      }

      room.players.push(player)
      playerRooms.set(socket.id, roomId)
      socket.join(roomId)

      socket.emit("roomJoined", room)
      socket.to(roomId).emit("playerJoined", player)

      console.log(`${playerName} joined room ${roomId} as ${availableColor}`)
    })

    socket.on("leaveRoom", () => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      leaveRoom(socket.id, roomId)
    })

    socket.on("makeMove", (from, to) => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) {
        socket.emit("error", "Not in a room")
        return
      }

      const room = rooms.get(roomId)
      if (!room || !room.isGameStarted) {
        socket.emit("error", "Game not started")
        return
      }

      const player = room.players.find((p) => p.id === socket.id)
      if (!player) {
        socket.emit("error", "Player not found")
        return
      }

      if (player.color !== room.gameState.currentPlayer) {
        socket.emit("error", "Not your turn")
        return
      }

      if (room.gameState.eliminatedPlayers.includes(player.color)) {
        socket.emit("error", "You are eliminated")
        return
      }

      // Validate and execute move
      const success = executeMove(room, from, to)
      if (success) {
        io.to(roomId).emit("gameStateUpdated", room.gameState)
      } else {
        socket.emit("error", "Invalid move")
      }
    })

    socket.on("startGame", () => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      // Only room creator (first player) can start game
      if (room.players[0]?.id !== socket.id) {
        socket.emit("error", "Only room creator can start the game")
        return
      }

      if (room.players.length < 2) {
        socket.emit("error", "Need at least 2 players to start")
        return
      }

      room.isGameStarted = true
      io.to(roomId).emit("gameStarted")
      io.to(roomId).emit("gameStateUpdated", room.gameState)

      console.log(`Game started in room ${roomId}`)
    })

    socket.on("resetGame", () => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      // Only room creator can reset
      if (room.players[0]?.id !== socket.id) {
        socket.emit("error", "Only room creator can reset the game")
        return
      }

      room.gameState = {
        board: initializeBoard(),
        currentPlayer: "red",
        selectedPiece: null,
        availableMoves: [],
        capturedPieces: { yellow: [], blue: [], green: [], red: [] },
        playersInCheck: [],
        eliminatedPlayers: [],
        gameWinner: null,
      }

      io.to(roomId).emit("gameReset")
      io.to(roomId).emit("gameStateUpdated", room.gameState)

      console.log(`Game reset in room ${roomId}`)
    })

    socket.on("getRooms", () => {
      const publicRooms = Array.from(rooms.values()).filter((room) => !room.isGameStarted && room.players.length < 4)
      socket.emit("roomsList", publicRooms)
    })

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
      const roomId = playerRooms.get(socket.id)
      if (roomId) {
        handlePlayerDisconnect(socket.id, roomId)
      }
    })
  })

  function leaveRoom(socketId: string, roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return

    room.players = room.players.filter((p) => p.id !== socketId)
    playerRooms.delete(socketId)

    if (room.players.length === 0) {
      rooms.delete(roomId)
      console.log(`Room ${roomId} deleted - no players left`)
    } else {
      io.to(roomId).emit("playerLeft", socketId)
    }
  }

  function handlePlayerDisconnect(socketId: string, roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === socketId)
    if (player) {
      player.isConnected = false
      io.to(roomId).emit("playerDisconnected", socketId)

      // Remove room if no connected players
      const connectedPlayers = room.players.filter((p) => p.isConnected)
      if (connectedPlayers.length === 0) {
        rooms.delete(roomId)
        console.log(`Room ${roomId} deleted - no connected players`)
      }
    }

    playerRooms.delete(socketId)
  }

  function executeMove(room: Room, from: any, to: any): boolean {
    const { board, currentPlayer } = room.gameState
    const piece = board[from.row][from.col]

    if (!piece || piece.color !== currentPlayer) {
      return false
    }

    // Get available moves and check if the move is valid
    const availableMoves = getAvailableMoves(board, from)
    const isValidMove = availableMoves.some((move) => move.row === to.row && move.col === to.col)

    if (!isValidMove) {
      return false
    }

    // Execute the move
    const newBoard = board.map((r) => [...r])
    const movingPiece = { ...newBoard[from.row][from.col]! }

    // Handle captured piece
    const capturedPiece = newBoard[to.row][to.col]
    if (capturedPiece) {
      room.gameState.capturedPieces[currentPlayer] = [...room.gameState.capturedPieces[currentPlayer], capturedPiece]
    }

    movingPiece.hasMoved = true

    // Handle castling
    if (movingPiece.type === "king" && Math.abs(to.col - from.col) === 2) {
      const isKingSide = to.col > from.col
      const rookCol = isKingSide ? from.col + 3 : from.col - 4
      const rookNewCol = isKingSide ? from.col + 1 : from.col - 1

      const rook = { ...newBoard[from.row][rookCol]! }
      rook.hasMoved = true
      newBoard[from.row][rookNewCol] = rook
      newBoard[from.row][rookCol] = null
    }

    // Handle pawn promotion
    if (movingPiece.type === "pawn") {
      const isPromotion =
        (currentPlayer === "yellow" && to.row === 7) ||
        (currentPlayer === "red" && to.row === 6) ||
        (currentPlayer === "blue" && to.col === 7) ||
        (currentPlayer === "green" && to.col === 6)

      if (isPromotion) {
        movingPiece.type = "queen"
      }
    }

    // Apply the move
    newBoard[to.row][to.col] = movingPiece
    newBoard[from.row][from.col] = null

    // Update game state
    room.gameState.board = newBoard
    room.gameState.selectedPiece = null
    room.gameState.availableMoves = []

    // Check game status
    updateGameStatus(room)

    return true
  }

  function updateGameStatus(room: Room) {
    const { board } = room.gameState
    const playersInCheck: PieceColor[] = []
    const eliminatedPlayers: PieceColor[] = [...room.gameState.eliminatedPlayers]

    PLAYER_ORDER.forEach((player) => {
      if (eliminatedPlayers.includes(player)) return

      const kingPosition = findKingPosition(board, player)
      if (!kingPosition) {
        if (!eliminatedPlayers.includes(player)) {
          eliminatedPlayers.push(player)
          removeAllPiecesOfColor(board, player)
        }
        return
      }

      const isInCheck = isPositionUnderAttack(board, kingPosition, player)
      if (isInCheck) {
        playersInCheck.push(player)

        // Check for checkmate
        let hasLegalMoves = false
        for (let row = 0; row < 14; row++) {
          for (let col = 0; col < 14; col++) {
            const piece = board[row][col]
            if (piece && piece.color === player) {
              const moves = getAvailableMoves(board, { row, col })
              if (moves.length > 0) {
                hasLegalMoves = true
                break
              }
            }
          }
          if (hasLegalMoves) break
        }

        if (!hasLegalMoves && !eliminatedPlayers.includes(player)) {
          eliminatedPlayers.push(player)
          removeAllPiecesOfColor(board, player)
        }
      }
    })

    room.gameState.playersInCheck = playersInCheck
    room.gameState.eliminatedPlayers = eliminatedPlayers

    // Determine winner
    const activePlayers = PLAYER_ORDER.filter((p) => !eliminatedPlayers.includes(p))
    room.gameState.gameWinner = activePlayers.length === 1 ? activePlayers[0] : null

    // Get next player
    if (!room.gameState.gameWinner) {
      room.gameState.currentPlayer = getNextPlayer(room.gameState.currentPlayer, eliminatedPlayers)
    }
  }

  function removeAllPiecesOfColor(board: any[][], color: PieceColor) {
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 14; col++) {
        const piece = board[row][col]
        if (piece && piece.color === color) {
          board[row][col] = null
        }
      }
    }
  }

  function getNextPlayer(currentPlayer: PieceColor, eliminatedPlayers: PieceColor[]): PieceColor {
    const currentIndex = PLAYER_ORDER.indexOf(currentPlayer)
    let nextIndex = (currentIndex + 1) % PLAYER_ORDER.length

    while (eliminatedPlayers.includes(PLAYER_ORDER[nextIndex])) {
      nextIndex = (nextIndex + 1) % PLAYER_ORDER.length
    }

    return PLAYER_ORDER[nextIndex]
  }

  function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  return io
}
