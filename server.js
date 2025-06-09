const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { Server } = require("socket.io")

const dev = process.env.NODE_ENV !== "production"
const hostname = "0.0.0.0"
const port = process.env.PORT || 3001

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Game state management
const rooms = new Map()
const playerRooms = new Map()
const PLAYER_ORDER = ["red", "blue", "yellow", "green"]

// Initialize board function
function initializeBoard() {
  const board = Array(14)
    .fill(null)
    .map(() => Array(14).fill(null))

  // Yellow pieces (top) - rows 0-1, cols 3-10
  const backPieces = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
  for (let i = 0; i < 8; i++) {
    board[0][3 + i] = { type: backPieces[i], color: "yellow" }
    board[1][3 + i] = { type: "pawn", color: "yellow" }
  }

  // Blue pieces (left) - rows 3-10, cols 0-1
  for (let i = 0; i < 8; i++) {
    board[3 + i][0] = { type: backPieces[i], color: "blue" }
    board[3 + i][1] = { type: "pawn", color: "blue" }
  }

  // Red pieces (bottom) - rows 12-13, cols 3-10
  for (let i = 0; i < 8; i++) {
    board[13][3 + i] = { type: backPieces[i], color: "red" }
    board[12][3 + i] = { type: "pawn", color: "red" }
  }

  // Green pieces (right) - rows 3-10, cols 12-13
  for (let i = 0; i < 8; i++) {
    board[3 + i][13] = { type: backPieces[i], color: "green" }
    board[3 + i][12] = { type: "pawn", color: "green" }
  }

  return board
}

// Chess move validation functions
function isValidPosition(position) {
  const { row, col } = position
  if (row < 0 || row >= 14 || col < 0 || col >= 14) return false

  const isPlayableSquare =
    (row >= 0 && row <= 2 && col >= 3 && col <= 10) ||
    (row >= 3 && row <= 10 && col >= 0 && col <= 13) ||
    (row >= 11 && row <= 13 && col >= 3 && col <= 10)

  return isPlayableSquare
}

function getPawnMoves(board, position, color, moves) {
  const { row, col } = position
  let direction, startPosition

  switch (color) {
    case "yellow":
      direction = { dr: 1, dc: 0 }
      startPosition = row === 1
      break
    case "red":
      direction = { dr: -1, dc: 0 }
      startPosition = row === 12
      break
    case "blue":
      direction = { dr: 0, dc: 1 }
      startPosition = col === 1
      break
    case "green":
      direction = { dr: 0, dc: -1 }
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

function addMovesInDirection(board, position, direction, color, moves) {
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

function getRookMoves(board, position, color, moves) {
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ]

  directions.forEach((dir) => {
    addMovesInDirection(board, position, dir, color, moves)
  })
}

function getBishopMoves(board, position, color, moves) {
  const directions = [
    { dr: -1, dc: -1 },
    { dr: -1, dc: 1 },
    { dr: 1, dc: -1 },
    { dr: 1, dc: 1 },
  ]

  directions.forEach((dir) => {
    addMovesInDirection(board, position, dir, color, moves)
  })
}

function getQueenMoves(board, position, color, moves) {
  getRookMoves(board, position, color, moves)
  getBishopMoves(board, position, color, moves)
}

function getKnightMoves(board, position, color, moves) {
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

function getKingMoves(board, position, color, moves) {
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
    const newPos = { row: row + move.dr, col: col + move.dc }
    if (isValidPosition(newPos)) {
      const targetPiece = board[newPos.row][newPos.col]
      if (!targetPiece || targetPiece.color !== color) {
        moves.push(newPos)
      }
    }
  })
}

function getAvailableMovesWithoutCheckValidation(board, position) {
  const { row, col } = position
  const piece = board[row][col]

  if (!piece) return []

  const moves = []

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

function isPositionUnderAttack(board, position, playerColor) {
  const opponents = ["yellow", "blue", "green", "red"].filter((color) => color !== playerColor)

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && opponents.includes(piece.color)) {
        const moves = getAvailableMovesWithoutCheckValidation(board, { row, col })
        if (moves.some((move) => move.row === position.row && move.col === position.col)) {
          return true
        }
      }
    }
  }

  return false
}

function findKingPosition(board, color) {
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

function getAvailableMoves(board, position) {
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
    const kingPosition = findKingPosition(newBoard, piece.color)
    if (!kingPosition) return true

    // Check if the king would be in check after the move
    return !isPositionUnderAttack(newBoard, kingPosition, piece.color)
  })
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getNextPlayer(currentPlayer, eliminatedPlayers) {
  const currentIndex = PLAYER_ORDER.indexOf(currentPlayer)
  let nextIndex = (currentIndex + 1) % PLAYER_ORDER.length

  while (eliminatedPlayers.includes(PLAYER_ORDER[nextIndex])) {
    nextIndex = (nextIndex + 1) % PLAYER_ORDER.length
  }

  return PLAYER_ORDER[nextIndex]
}

function removeAllPiecesOfColor(board, color) {
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && piece.color === color) {
        board[row][col] = null
      }
    }
  }
}

function updateGameStatus(room) {
  const { board } = room.gameState
  const playersInCheck = []
  const eliminatedPlayers = [...room.gameState.eliminatedPlayers]

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

function executeMove(room, from, to) {
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
  const movingPiece = { ...newBoard[from.row][from.col] }

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

    const rook = { ...newBoard[from.row][rookCol] }
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

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("internal server error")
    }
  })

  // Initialize Socket.IO server
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    socket.on("createRoom", (roomName, playerName) => {
      const roomId = generateRoomId()
      const player = {
        id: socket.id,
        name: playerName,
        color: "red",
        isConnected: true,
      }

      const room = {
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

      const usedColors = room.players.map((p) => p.color)
      const availableColor = PLAYER_ORDER.find((color) => !usedColors.includes(color))

      if (!availableColor) {
        socket.emit("error", "No available player slots")
        return
      }

      const player = {
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
        console.log(`Move executed: ${player.name} moved from (${from.row},${from.col}) to (${to.row},${to.col})`)
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

    socket.on("leaveRoom", () => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      room.players = room.players.filter((p) => p.id !== socket.id)
      playerRooms.delete(socket.id)

      if (room.players.length === 0) {
        rooms.delete(roomId)
        console.log(`Room ${roomId} deleted - no players left`)
      } else {
        io.to(roomId).emit("playerLeft", socket.id)
      }
    })

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
      const roomId = playerRooms.get(socket.id)
      if (roomId) {
        const room = rooms.get(roomId)
        if (room) {
          const player = room.players.find((p) => p.id === socket.id)
          if (player) {
            player.isConnected = false
            io.to(roomId).emit("playerDisconnected", socket.id)

            const connectedPlayers = room.players.filter((p) => p.isConnected)
            if (connectedPlayers.length === 0) {
              rooms.delete(roomId)
              console.log(`Room ${roomId} deleted - no connected players`)
            }
          }
        }
        playerRooms.delete(socket.id)
      }
    })
  })

  httpServer
    .once("error", (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log("> Socket.IO server initialized")
    })
})
