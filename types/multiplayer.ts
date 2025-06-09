import type { GameState, PieceColor, Position } from "./chess"

export interface Player {
  id: string
  name: string
  color: PieceColor
  isConnected: boolean
}

export interface Room {
  id: string
  name: string
  players: Player[]
  gameState: GameState
  isGameStarted: boolean
  createdAt: Date
}

export interface ServerToClientEvents {
  roomCreated: (room: Room) => void
  roomJoined: (room: Room) => void
  roomLeft: (room: Room) => void
  gameStateUpdated: (gameState: GameState) => void
  playerJoined: (player: Player) => void
  playerLeft: (playerId: string) => void
  playerDisconnected: (playerId: string) => void
  playerReconnected: (playerId: string) => void
  gameStarted: () => void
  gameReset: () => void
  error: (message: string) => void
  roomsList: (rooms: Room[]) => void
}

export interface ClientToServerEvents {
  createRoom: (roomName: string, playerName: string) => void
  joinRoom: (roomId: string, playerName: string) => void
  leaveRoom: () => void
  makeMove: (from: Position, to: Position) => void
  startGame: () => void
  resetGame: () => void
  getRooms: () => void
}
