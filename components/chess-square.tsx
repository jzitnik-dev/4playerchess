"use client"

import type { Piece, PieceColor } from "@/types/chess"
import { ChessPiece } from "./chess-piece-four-player"

interface ChessSquareProps {
  row: number
  col: number
  piece: Piece | null
  isSelected: boolean
  isAvailableMove: boolean
  isKingInCheck: boolean
  onClick: () => void
  playerView?: PieceColor
}

export function ChessSquare({
  row,
  col,
  piece,
  isSelected,
  isAvailableMove,
  isKingInCheck,
  onClick,
  playerView,
}: ChessSquareProps) {
  // Determine if this square should be rendered as playable based on transformed coordinates
  const isPlayableSquare = () => {
    // For the transformed board, we need to check if the square is playable
    // in the original board orientation
    return (
      (row >= 0 && row <= 2 && col >= 3 && col <= 10) || // Top
      (row >= 3 && row <= 10 && col >= 0 && col <= 13) || // Middle (full width)
      (row >= 11 && row <= 13 && col >= 3 && col <= 10) // Bottom
    )
  }

  if (!isPlayableSquare()) {
    return <div className="w-8 h-8 bg-gray-600" />
  }

  const isLightSquare = (row + col) % 2 === 0

  // Determine background color based on state
  let bgColor = isLightSquare ? "bg-amber-100" : "bg-amber-800"

  if (isKingInCheck) {
    bgColor = "bg-red-500" // Red background for king in check
  }

  return (
    <div
      className={`
        w-8 h-8 flex items-center justify-center cursor-pointer
        ${bgColor}
        ${isSelected ? "ring-2 ring-blue-500 ring-inset" : ""}
        ${isAvailableMove ? "ring-2 ring-green-500 ring-inset" : ""}
        relative hover:brightness-110 transition-all
      `}
      onClick={onClick}
    >
      {piece && <ChessPiece type={piece.type} color={piece.color} playerView={playerView} />}
      {isAvailableMove && !piece && <div className="absolute w-3 h-3 rounded-full bg-green-500 opacity-70"></div>}
    </div>
  )
}
