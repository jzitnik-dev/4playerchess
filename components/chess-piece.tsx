import {
  CastleIcon as ChessKing,
  DiamondIcon as ChessQueen,
  ChurchIcon as ChessBishop,
  CastleIcon as ChessKnight,
  RocketIcon as ChessRook,
  PianoIcon as ChessPawn,
} from "lucide-react"

interface ChessPieceProps {
  type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king"
  color: "white" | "black"
  small?: boolean
}

export function ChessPiece({ type, color, small = false }: ChessPieceProps) {
  const size = small ? 20 : 40
  const strokeWidth = small ? 2 : 1.5

  const pieceColor = color === "white" ? "text-white" : "text-black"
  const outlineColor = color === "white" ? "stroke-black" : "stroke-white"

  const renderPiece = () => {
    switch (type) {
      case "pawn":
        return <ChessPawn size={size} strokeWidth={strokeWidth} />
      case "rook":
        return <ChessRook size={size} strokeWidth={strokeWidth} />
      case "knight":
        return <ChessKnight size={size} strokeWidth={strokeWidth} />
      case "bishop":
        return <ChessBishop size={size} strokeWidth={strokeWidth} />
      case "queen":
        return <ChessQueen size={size} strokeWidth={strokeWidth} />
      case "king":
        return <ChessKing size={size} strokeWidth={strokeWidth} />
      default:
        return null
    }
  }

  return <div className={`${pieceColor} ${outlineColor}`}>{renderPiece()}</div>
}
