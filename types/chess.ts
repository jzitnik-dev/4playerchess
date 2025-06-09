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
}

export interface PlayerInfo {
  color: PieceColor
  name: string
  isActive: boolean
  isEliminated: boolean
  isInCheck: boolean
}
