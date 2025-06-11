export type PieceType = "pawn" | "rook" | "knight" | "bishop" | "queen" | "king"
export type PieceColor = "yellow" | "blue" | "green" | "red"

export interface Piece {
  type: PieceType
  color: PieceColor
  hasMoved?: boolean
}

export interface Position {
  row: number
  col: number
}

export interface Move {
  from: Position
  to: Position
  piece: Piece // The piece that moved
  capturedPiece?: Piece | null // The piece directly captured on the target square, if any
  playerColor: PieceColor // The color of the player who made the move
  playerName: string
  moveNumber: number
  timestamp: number
  eliminatedPlayersAfterMove: PieceColor[] // List of ALL players eliminated up to and including this move
}

export interface GameState {
  board: (Piece | null)[][]
  currentPlayer: PieceColor
  selectedPiece: Position | null
  availableMoves: Position[]
  capturedPieces: {
    yellow: Piece[]
    blue: Piece[]
    green: Piece[]
    red: Piece[]
  }
  playersInCheck: PieceColor[]
  eliminatedPlayers: PieceColor[]
  gameWinner: PieceColor | null
  moveHistory: Move[] // Server will ensure this is always up-to-date
}

export interface PlayerInfo {
  color: PieceColor
  name: string
  isActive: boolean
  isEliminated: boolean
  isInCheck: boolean
}
