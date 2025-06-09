import type { Piece, PieceColor } from "@/types/chess"
import { ChessPiece } from "./chess-piece-four-player"

interface CapturedPiecesProps {
  capturedPieces: {
    yellow: Piece[]
    blue: Piece[]
    green: Piece[]
    red: Piece[]
  }
  side: "top" | "bottom" | "left" | "right"
}

export function CapturedPieces({ capturedPieces, side }: CapturedPiecesProps) {
  const getPlayerForSide = (side: string): PieceColor => {
    switch (side) {
      case "top":
        return "yellow"
      case "left":
        return "blue"
      case "right":
        return "green"
      case "bottom":
        return "red"
      default:
        return "yellow"
    }
  }

  const player = getPlayerForSide(side)
  const pieces = capturedPieces[player]

  const getPlayerColor = (color: PieceColor) => {
    switch (color) {
      case "yellow":
        return "text-yellow-600"
      case "blue":
        return "text-blue-600"
      case "green":
        return "text-green-600"
      case "red":
        return "text-red-600"
    }
  }

  const getContainerClasses = () => {
    switch (side) {
      case "top":
      case "bottom":
        return "flex flex-wrap justify-center gap-1 max-w-[300px]"
      case "left":
      case "right":
        return "flex flex-col gap-1 max-h-[300px] flex-wrap"
    }
  }

  return (
    <div className="p-2">
      <h3 className={`font-bold mb-2 text-sm ${getPlayerColor(player)}`}>
        {player.charAt(0).toUpperCase() + player.slice(1)} ({pieces.length})
      </h3>
      <div className={getContainerClasses()}>
        {pieces.map((piece, index) => (
          <div key={index} className="w-6 h-6 flex items-center justify-center">
            <ChessPiece type={piece.type} color={piece.color} small />
          </div>
        ))}
      </div>
    </div>
  )
}
