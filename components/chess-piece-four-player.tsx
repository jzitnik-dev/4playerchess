import type { PieceType, PieceColor } from "@/types/chess"

interface ChessPieceProps {
  type: PieceType
  color: PieceColor
  small?: boolean
  playerView?: PieceColor
}

export function ChessPiece({ type, color, small = false, playerView }: ChessPieceProps) {
  const size = small ? "text-lg" : "text-3xl"

  const getColorClasses = (color: PieceColor) => {
    switch (color) {
      case "yellow":
        return "text-yellow-400 stroke-yellow-800"
      case "blue":
        return "text-blue-400 stroke-blue-800"
      case "green":
        return "text-green-400 stroke-green-800"
      case "red":
        return "text-red-400 stroke-red-800"
      default:
        return "text-gray-400 stroke-gray-800"
    }
  }

  const getPieceSymbol = (type: PieceType, color: PieceColor): string => {
    // Using Unicode chess symbols
    const pieces = {
      white: {
        king: "♔",
        queen: "♕",
        rook: "♖",
        bishop: "♗",
        knight: "♘",
        pawn: "♙",
      },
      black: {
        king: "♚",
        queen: "♛",
        rook: "♜",
        bishop: "♝",
        knight: "♞",
        pawn: "♟",
      },
    }

    // For colored pieces, we'll use the white symbols and color them
    return pieces.white[type]
  }

  return (
    <div
      className={`
        ${getColorClasses(color)} 
        ${size} 
        font-bold 
        select-none 
        drop-shadow-lg
        filter
        contrast-125
        brightness-110
      `}
      style={{
        textShadow: "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(255,255,255,0.3)",
        WebkitTextStroke: "1px rgba(0,0,0,0.5)",
      }}
    >
      {getPieceSymbol(type, color)}
    </div>
  )
}
