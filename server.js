const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { Server } = require("socket.io")

const dev = process.env.NODE_ENV !== "production"
const hostname = "0.0.0.0"
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Game state management
const rooms = new Map()
const playerRooms = new Map()
const PLAYER_ORDER = ["red", "blue", "yellow", "green"]

// AI move timers
const aiMoveTimers = new Map()

// Store io instance globally
let io

// Initialize board function
function initializeBoard() {
  const board = Array(14)
    .fill(null)
    .map(() => Array(14).fill(null))

  const backPieces = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"]
  const bluePieces = ["rook", "knight", "bishop", "king", "queen", "bishop", "knight", "rook"]

  // Yellow pieces (top) - rows 0-1, cols 3-10
  for (let i = 0; i < 8; i++) {
    board[0][3 + i] = { type: bluePieces[i], color: "yellow" }
    board[1][3 + i] = { type: "pawn", color: "yellow" }
  }

  // Blue pieces (left) - rows 3-10, cols 0-1
  for (let i = 0; i < 8; i++) {
    board[3 + i][0] = { type: bluePieces[i], color: "blue" }
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

// Add this new function right before `getKingMoves`
function addCastlingMoves(board, position, color, moves) {
  const { row, col } = position

  // Can't castle while in check
  if (isPositionUnderAttack(board, position, color)) return

  let kingSideRookPos, queenSideRookPos
  let kingPath, queenPath
  let castlingTarget = { kingSide: null, queenSide: null }

  switch (color) {
    case "red":
    case "yellow":
      kingSideRookPos = { row, col: col + 3 }
      queenSideRookPos = { row, col: col - 4 }
      kingPath = [ { row, col: col + 1 }, { row, col: col + 2 } ]
      queenPath = [ { row, col: col - 1 }, { row, col: col - 2 } ]
      castlingTarget.kingSide = { row, col: col + 2 }
      castlingTarget.queenSide = { row, col: col - 2 }
      break

    case "blue":
      kingSideRookPos = { row: row + 3, col }
      queenSideRookPos = { row: row - 4, col }
      kingPath = [ { row: row + 1, col }, { row: row + 2, col } ]
      queenPath = [ { row: row - 1, col }, { row: row - 2, col } ]
      castlingTarget.kingSide = { row: row + 2, col }
      castlingTarget.queenSide = { row: row - 2, col }
      break

    case "green":
      kingSideRookPos = { row: row - 3, col }
      queenSideRookPos = { row: row + 4, col }
      kingPath = [ { row: row - 1, col }, { row: row - 2, col } ]
      queenPath = [ { row: row + 1, col }, { row: row + 2, col } ]
      castlingTarget.kingSide = { row: row - 2, col }
      castlingTarget.queenSide = { row: row + 2, col }
      break
  }

  function isPathClear(path) {
    for (const pos of path) {
      if (!isValidPosition(pos) || board[pos.row][pos.col] !== null) return false
      if (isPositionUnderAttack(board, pos, color)) return false
    }
    return true
  }

  // King-side castling
  if (
    isValidPosition(kingSideRookPos) &&
    board[kingSideRookPos.row][kingSideRookPos.col]?.type === "rook" &&
    board[kingSideRookPos.row][kingSideRookPos.col]?.color === color &&
    !board[kingSideRookPos.row][kingSideRookPos.col]?.hasMoved &&
    isPathClear(kingPath)
  ) {
    moves.push(castlingTarget.kingSide)
  }

  // Queen-side castling
  if (
    isValidPosition(queenSideRookPos) &&
    board[queenSideRookPos.row][queenSideRookPos.col]?.type === "rook" &&
    board[queenSideRookPos.row][queenSideRookPos.col]?.color === color &&
    !board[queenSideRookPos.row][queenSideRookPos.col]?.hasMoved &&
    isPathClear(queenPath)
  ) {
    moves.push(castlingTarget.queenSide)
  }
}

// Replace the existing `getKingMoves` function with this one:
function getKingMoves(board, position, color, moves, includeCastling = false) {
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

// Replace the existing `getAvailableMovesWithoutCheckValidation` function with this one:
function getAvailableMovesWithoutCheckValidation(board, position, includeCastling = false) {
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
      getKingMoves(board, position, piece.color, moves, includeCastling)
      break
  }

  return moves
}

// Replace the existing `isPositionUnderAttack` function with this one:
function isPositionUnderAttack(board, position, playerColor) {
  const opponents = ["yellow", "blue", "green", "red"].filter((color) => color !== playerColor)

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && opponents.includes(piece.color)) {
        const moves = getAvailableMovesWithoutCheckValidation(board, { row, col }, false)
        if (moves.some((move) => move.row === position.row && move.col === position.col)) {
          return true
        }
      }
    }
  }

  return false
}

// Replace the existing `getAvailableMoves` function with this one:
function getAvailableMoves(board, position) {
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

// AI Functions
function getAllLegalMovesForPlayer(board, color) {
  const allMoves = []

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && piece.color === color) {
        const moves = getAvailableMoves(board, { row, col })
        moves.forEach((move) => {
          allMoves.push({
            from: { row, col },
            to: move,
          })
        })
      }
    }
  }

  return allMoves
}

function makeRandomMove(room) {
  const { board, currentPlayer } = room.gameState
  const legalMoves = getAllLegalMovesForPlayer(board, currentPlayer)

  if (legalMoves.length === 0) {
    console.log(`No legal moves available for AI player ${currentPlayer}`)
    return null
  }

  const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
  const move = executeMove(room, randomMove.from, randomMove.to)

  if (move) {
    console.log(
      `AI ${currentPlayer} made move from (${randomMove.from.row},${randomMove.from.col}) to (${randomMove.to.row},${randomMove.to.col})`,
    )
    return move
  }
  return null
}

function scheduleAIMove(roomId, delay = 2000) {
  if (aiMoveTimers.has(roomId)) {
    clearTimeout(aiMoveTimers.get(roomId))
  }

  const timer = setTimeout(() => {
    const room = rooms.get(roomId)
    if (!room || !room.isGameStarted || room.gameState.gameWinner) return

    const currentPlayer = room.gameState.currentPlayer
    const player = room.players.find((p) => p.color === currentPlayer)

    if (!player || !player.isConnected) {
      const move = makeRandomMove(room)
      if (move) {
        if (io) {
          io.to(roomId).emit("moveExecuted", { move, gameState: room.gameState })
        }
        const nextPlayer = room.gameState.currentPlayer
        const nextPlayerObj = room.players.find((p) => p.color === nextPlayer)
        if (!nextPlayerObj || !nextPlayerObj.isConnected) {
          scheduleAIMove(roomId)
        }
      }
    }
    aiMoveTimers.delete(roomId)
  }, delay)
  aiMoveTimers.set(roomId, timer)
}

function checkAndScheduleAIMove(roomId) {
  const room = rooms.get(roomId)
  if (!room || !room.isGameStarted || room.gameState.gameWinner) {
    return
  }

  const currentPlayer = room.gameState.currentPlayer
  const player = room.players.find((p) => p.color === currentPlayer)

  // If current player is AI (no player or disconnected), schedule a move
  if (!player || !player.isConnected) {
    scheduleAIMove(roomId)
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getNextPlayer(currentPlayer, eliminatedPlayers) {
  const currentIndex = PLAYER_ORDER.indexOf(currentPlayer)
  let nextIndex = (currentIndex + 1) % PLAYER_ORDER.length
  let safetyBreak = PLAYER_ORDER.length

  while (eliminatedPlayers.includes(PLAYER_ORDER[nextIndex]) && safetyBreak > 0) {
    nextIndex = (nextIndex + 1) % PLAYER_ORDER.length
    safetyBreak--
  }
  if (safetyBreak === 0) {
    // All remaining players are eliminated, should mean game over
    const activePlayers = PLAYER_ORDER.filter((p) => !eliminatedPlayers.includes(p))
    return activePlayers.length > 0 ? activePlayers[0] : currentPlayer // Fallback
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
  const { board } = room.gameState // board here is already updated with the current move
  const playersInCheck = []
  // Start with players already known to be eliminated
  const eliminatedPlayers = [...room.gameState.eliminatedPlayers]

  PLAYER_ORDER.forEach((playerColor) => {
    if (eliminatedPlayers.includes(playerColor)) return // Skip already eliminated players

    const kingPosition = findKingPosition(board, playerColor)
    if (!kingPosition) {
      // King not on board (e.g., captured, though this logic is for checkmate)
      if (!eliminatedPlayers.includes(playerColor)) {
        eliminatedPlayers.push(playerColor)
        // Pieces of this player should already be removed if king was captured leading to this.
        // If king is missing due to other reasons (should not happen in standard rules), remove pieces.
        removeAllPiecesOfColor(board, playerColor)
      }
      return
    }

    const isInCheck = isPositionUnderAttack(board, kingPosition, playerColor)
    if (isInCheck) {
      playersInCheck.push(playerColor)

      let hasLegalMoves = false
      for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
          const piece = board[r][c]
          if (piece && piece.color === playerColor) {
            const moves = getAvailableMoves(board, { row: r, col: c })
            if (moves.length > 0) {
              hasLegalMoves = true
              break
            }
          }
        }
        if (hasLegalMoves) break
      }

      if (!hasLegalMoves) {
        // Checkmate
        if (!eliminatedPlayers.includes(playerColor)) {
          eliminatedPlayers.push(playerColor)
          removeAllPiecesOfColor(board, playerColor) // Remove pieces of checkmated player
        }
      }
    }
  })

  room.gameState.playersInCheck = playersInCheck
  room.gameState.eliminatedPlayers = eliminatedPlayers // This is the updated list

  const activePlayers = PLAYER_ORDER.filter((p) => !eliminatedPlayers.includes(p))
  room.gameState.gameWinner = activePlayers.length === 1 ? activePlayers[0] : null

  if (!room.gameState.gameWinner) {
    room.gameState.currentPlayer = getNextPlayer(room.gameState.currentPlayer, eliminatedPlayers)
  } else {
    // If there's a winner, current player might be the winner or null
    room.gameState.currentPlayer = room.gameState.gameWinner
  }
}

function executeMove(room, from, to) {
  const { board: boardBeforeMove, currentPlayer } = room.gameState
  const pieceBeingMoved = boardBeforeMove[from.row][from.col]

  if (!pieceBeingMoved || pieceBeingMoved.color !== currentPlayer) {
    return null
  }

  const availableMoves = getAvailableMoves(boardBeforeMove, from)
  const isValidMove = availableMoves.some((move) => move.row === to.row && move.col === to.col)

  if (!isValidMove) {
    return null
  }

  const newBoard = boardBeforeMove.map((r) => [...r])
  const movingPieceData = { ...newBoard[from.row][from.col] } // Data of the piece that is moving
  const capturedPieceOnSquare = newBoard[to.row][to.col] ? { ...newBoard[to.row][to.col] } : null

  if (capturedPieceOnSquare) {
    room.gameState.capturedPieces[currentPlayer].push(capturedPieceOnSquare)
  }

  movingPieceData.hasMoved = true

  const dx = Math.abs(to.col - from.col);
  const dy = Math.abs(to.row - from.row);

  if (pieceBeingMoved.type === "king" && (Math.abs(dx) === 2 ^ Math.abs(dy) === 2)) {
    switch (pieceBeingMoved.color) {
      case "red": {
        if (dx == -2) {

        }
        break;
      }
      case "yellow": {
        const rookFromCol = dx > 0 ? from.col + 3 : from.col - 4
        const rookToCol = dx > 0 ? from.col + 1 : from.col - 1
        boardBeforeMove[from.row][rookToCol] = boardBeforeMove[from.row][rookFromCol]
        boardBeforeMove[from.row][rookFromCol] = null
        break
      }
      case "blue": {
        const rookFromRow = dy > 0 ? from.row + 3 : from.row - 4
        const rookToRow = dy > 0 ? from.row + 1 : from.row - 1
        boardBeforeMove[rookToRow][from.col] = boardBeforeMove[rookFromRow][from.col]
        boardBeforeMove[rookFromRow][from.col] = null
        break
      }
      case "green": {
        const rookFromRow = dy < 0 ? from.row - 3 : from.row + 4
        const rookToRow = dy < 0 ? from.row - 1 : from.row + 1
        boardBeforeMove[rookToRow][from.col] = boardBeforeMove[rookFromRow][from.col]
        boardBeforeMove[rookFromRow][from.col] = null
        break
      }
    }
  }

  if (movingPieceData.type === "pawn") {
    // Pawn Promotion
    const isPromotion =
      (currentPlayer === "yellow" && to.row === 7) ||
      (currentPlayer === "red" && to.row === 6) ||
      (currentPlayer === "blue" && to.col === 7) ||
      (currentPlayer === "green" && to.col === 6)
    if (isPromotion) {
      movingPieceData.type = "queen"
    }
  }

  newBoard[to.row][to.col] = movingPieceData
  newBoard[from.row][from.col] = null
  room.gameState.board = newBoard // Board updated with the single move

  updateGameStatus(room) // This updates playersInCheck, eliminatedPlayers (and removes pieces), gameWinner, currentPlayer

  const player = room.players.find((p) => p.color === movingPieceData.color)
  const playerName = player ? player.name : `AI ${movingPieceData.color}`

  if (!room.gameState.moveHistory) {
    // Should be initialized
    room.gameState.moveHistory = []
  }

  const move = {
    from,
    to,
    piece: movingPieceData, // The piece that moved, with its state *before* this move (e.g. pawn before promotion)
    capturedPiece: capturedPieceOnSquare, // The piece that was on the target square
    playerColor: movingPieceData.color,
    playerName,
    moveNumber: room.gameState.moveHistory.length + 1,
    timestamp: Date.now(),
    eliminatedPlayersAfterMove: [...room.gameState.eliminatedPlayers], // Crucial: list of all eliminated players AFTER this move and its consequences
  }

  room.gameState.moveHistory.push(move)
  return move
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// Helper function to create public player info (without socketId)
function createPublicPlayerInfo(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    isConnected: player.isConnected,
  }
}

// Helper function to create public room info
function createPublicRoomInfo(room) {
  return {
    id: room.id,
    name: room.name,
    players: room.players.map(createPublicPlayerInfo),
    gameState: room.gameState, // This will include the full moveHistory
    isGameStarted: room.isGameStarted,
    createdAt: room.createdAt,
  }
}

// Helper function to find the king's position
function findKingPosition(board, color) {
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = board[row][col]
      if (piece && piece.type === "king" && piece.color === color) {
        return { row, col }
      }
    }
  }
  return null // King not found (should not happen in a valid game state)
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

  // Initialize Socket.IO server and store globally
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    socket.on("createRoom", (roomName, playerName) => {
      const roomId = generateRoomId()
      const playerId = generatePlayerId()
      const player = {
        id: playerId,
        socketId: socket.id,
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
          moveHistory: [],
        },
        isGameStarted: false,
        createdAt: new Date(),
      }

      rooms.set(roomId, room)
      playerRooms.set(socket.id, roomId)
      socket.join(roomId)

      const publicRoom = createPublicRoomInfo(room)
      const myPlayerInfo = createPublicPlayerInfo(player)

      socket.emit("roomCreated", publicRoom, myPlayerInfo)
      console.log(`Room created: ${roomId} by ${playerName} (${playerId})`)
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

      const playerId = generatePlayerId()
      const player = {
        id: playerId,
        socketId: socket.id,
        name: playerName,
        color: availableColor,
        isConnected: true,
      }

      room.players.push(player)
      playerRooms.set(socket.id, roomId)
      socket.join(roomId)

      const publicRoom = createPublicRoomInfo(room)
      const myPlayerInfo = createPublicPlayerInfo(player)

      socket.emit("roomJoined", publicRoom, myPlayerInfo)
      socket.to(roomId).emit("playerJoined", createPublicPlayerInfo(player))

      console.log(`${playerName} (${playerId}) joined room ${roomId} as ${availableColor}`)
    })

    socket.on("joinRoomAgain", (roomId, playerId) => {
      const room = rooms.get(roomId)
      if (!room) {
        socket.emit("error", "Room not found")
        return
      }

      const player = room.players.find((p) => p.id === playerId)
      if (!player) {
        socket.emit("error", "Player not found")
        return
      }

      // Update player's socket ID and connection status
      player.socketId = socket.id
      player.isConnected = true
      playerRooms.set(socket.id, roomId)
      socket.join(roomId)

      const publicRoom = createPublicRoomInfo(room) // This will send the full gameState including history
      const myPlayerInfo = createPublicPlayerInfo(player)

      socket.emit("roomJoined", publicRoom, myPlayerInfo)
      socket.to(roomId).emit("playerReconnected", playerId)

      console.log(`${player.name} (${playerId}) reconnected to room ${roomId}`)

      // Check if AI should make a move after reconnection
      checkAndScheduleAIMove(roomId)
    })

    socket.on("makeMove", (from, to, playerId) => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room || !room.isGameStarted) return
      const player = room.players.find((p) => p.id === playerId && p.socketId === socket.id)
      if (
        !player ||
        player.color !== room.gameState.currentPlayer ||
        room.gameState.eliminatedPlayers.includes(player.color)
      ) {
        return socket.emit("error", "Invalid move request")
      }

      if (aiMoveTimers.has(roomId)) {
        clearTimeout(aiMoveTimers.get(roomId))
        aiMoveTimers.delete(roomId)
      }

      const move = executeMove(room, from, to)
      if (move) {
        console.log(`Move executed: ${player.name} moved from (${from.row},${from.col}) to (${to.row},${to.col})`)
        // gameState sent here includes the updated moveHistory and board after eliminations
        io.to(roomId).emit("moveExecuted", { move, gameState: room.gameState })
        checkAndScheduleAIMove(roomId)
      } else {
        socket.emit("error", "Invalid move")
      }
    })

    socket.on("startGame", (playerId) => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      const player = room.players.find((p) => p.id === playerId && p.socketId === socket.id)
      if (!player || room.players[0]?.id !== playerId) {
        socket.emit("error", "Only room creator can start the game")
        return
      }

      if (room.players.length < 1) {
        // Changed from 2 to 1 for testing, can be 2 for real games
        socket.emit("error", "Need at least 1 player to start")
        return
      }

      room.isGameStarted = true
      io.to(roomId).emit("gameStarted")
      io.to(roomId).emit("gameStateUpdated", room.gameState) // Send initial state

      console.log(`Game started in room ${roomId} by ${player.name} (${playerId})`)

      // Check if AI should make the first move
      checkAndScheduleAIMove(roomId)
    })

    socket.on("resetGame", (playerId) => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      const player = room.players.find((p) => p.id === playerId && p.socketId === socket.id)
      if (!player || room.players[0]?.id !== playerId) {
        socket.emit("error", "Only room creator can reset the game")
        return
      }

      // Clear any AI timers
      if (aiMoveTimers.has(roomId)) {
        clearTimeout(aiMoveTimers.get(roomId))
        aiMoveTimers.delete(roomId)
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
        moveHistory: [], // Reset history
      }
      room.isGameStarted = false // Ensure game is marked as not started

      io.to(roomId).emit("gameReset") // Signal client to reset UI components
      io.to(roomId).emit("gameStateUpdated", room.gameState) // Send the fresh gameState

      console.log(`Game reset in room ${roomId} by ${player.name} (${playerId})`)
    })

    socket.on("getRooms", () => {
      const publicRooms = Array.from(rooms.values())
        .filter((room) => !room.isGameStarted && room.players.length < 4)
        .map(createPublicRoomInfo)
      socket.emit("roomsList", publicRooms)
    })

    socket.on("leaveRoom", (playerId) => {
      const roomId = playerRooms.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      const player = room.players.find((p) => p.id === playerId && p.socketId === socket.id)
      if (!player) {
        socket.emit("error", "Player not found or unauthorized")
        return
      }

      // Check if the leaving player was on their turn
      const wasCurrentPlayer = room.gameState.currentPlayer === player.color && room.isGameStarted

      room.players = room.players.filter((p) => p.id !== playerId)
      playerRooms.delete(socket.id)

      if (room.players.length === 0) {
        // Clear AI timer if room is being deleted
        if (aiMoveTimers.has(roomId)) {
          clearTimeout(aiMoveTimers.get(roomId))
          aiMoveTimers.delete(roomId)
        }
        rooms.delete(roomId)
        console.log(`Room ${roomId} deleted - no players left`)
      } else {
        io.to(roomId).emit("playerLeft", playerId)

        // If the leaving player was on their turn, schedule AI move
        if (wasCurrentPlayer) {
          checkAndScheduleAIMove(roomId)
        }
      }
    })

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
      const roomId = playerRooms.get(socket.id)
      if (roomId) {
        const room = rooms.get(roomId)
        if (room) {
          const player = room.players.find((p) => p.socketId === socket.id)
          if (player) {
            // Check if the disconnecting player was on their turn
            const wasCurrentPlayer = room.gameState.currentPlayer === player.color && room.isGameStarted

            player.isConnected = false
            io.to(roomId).emit("playerDisconnected", player.id)

            // If the disconnecting player was on their turn, schedule AI move
            if (wasCurrentPlayer) {
              checkAndScheduleAIMove(roomId)
            }

            const connectedPlayers = room.players.filter((p) => p.isConnected)
            if (connectedPlayers.length === 0 && !room.isGameStarted) {
              // Clear AI timer if room is being deleted
              if (aiMoveTimers.has(roomId)) {
                clearTimeout(aiMoveTimers.get(roomId))
                aiMoveTimers.delete(roomId)
              }
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
