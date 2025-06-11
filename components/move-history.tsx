"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react"
import type { PieceColor, PieceType } from "@/types/chess"

interface Move {
  from: { row: number; col: number }
  to: { row: number; col: number }
  piece: { type: PieceType; color: PieceColor }
  capturedPiece?: { type: PieceType; color: PieceColor }
  player: PieceColor
  playerName: string
  timestamp: number
  moveNumber: number
}

interface MoveHistoryProps {
  moves: Move[]
  currentMoveIndex: number
  onMoveClick: (index: number) => void
  onNavigate: (direction: "previous" | "next" | "first" | "current") => void
}

export function MoveHistory({ moves, currentMoveIndex, onMoveClick, onNavigate }: MoveHistoryProps) {
  const getPieceSymbol = (type: PieceType): string => {
    const symbols = {
      king: "♔",
      queen: "♕",
      rook: "♖",
      bishop: "♗",
      knight: "♘",
      pawn: "♙",
    }
    return symbols[type]
  }

  const getPositionNotation = (row: number, col: number): string => {
    // Convert to chess notation (simplified for 4-player board)
    const files = "abcdefghijklmn"
    return `${files[col]}${14 - row}`
  }

  const formatMove = (move: Move): string => {
    const piece = move.piece.type === "pawn" ? "" : getPieceSymbol(move.piece.type)
    const from = getPositionNotation(move.from.row, move.from.col)
    const to = getPositionNotation(move.to.row, move.to.col)
    const capture = move.capturedPiece ? "x" : "-"

    return `${piece}${from}${capture}${to}`
  }

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

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Move History</CardTitle>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("first")}
            disabled={moves.length === 0}
            title="First move (Home)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("previous")}
            disabled={moves.length === 0 || currentMoveIndex <= 0}
            title="Previous move (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("next")}
            disabled={moves.length === 0 || currentMoveIndex >= moves.length - 1}
            title="Next move (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("current")}
            disabled={currentMoveIndex === -1}
            title="Current position (End)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {moves.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No moves yet</p>
          ) : (
            moves.map((move, index) => (
              <div
                key={index}
                className={`p-2 rounded cursor-pointer transition-colors text-sm ${
                  index === currentMoveIndex
                    ? "bg-blue-100 border border-blue-300"
                    : index < currentMoveIndex || currentMoveIndex === -1
                      ? "bg-gray-50 hover:bg-gray-100"
                      : "bg-white hover:bg-gray-50 opacity-60"
                }`}
                onClick={() => onMoveClick(index)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{move.moveNumber}.</span>
                  <span className="text-xs text-gray-500">
                    {new Date(move.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className={`font-medium ${getPlayerColor(move.player)}`}>{move.playerName}</div>
                <div className="font-mono text-xs">
                  {formatMove(move)}
                  {move.capturedPiece && (
                    <span className="ml-1 text-red-600">captures {getPieceSymbol(move.capturedPiece.type)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {moves.length > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <p>
              <strong>Keyboard shortcuts:</strong>
            </p>
            <p>← Previous move • → Next move</p>
            <p>Home: First move • End: Current position</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
