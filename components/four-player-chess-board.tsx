"use client"

import { useFourPlayerChess } from "@/hooks/use-four-player-chess"
import { ChessSquare } from "./chess-square"
import { GameStatus } from "./game-status-four-player"
import { GameControls } from "./game-controls"
import { CapturedPieces } from "./captured-pieces"

export function FourPlayerChessBoard() {
  const { gameState, handleSquareClick, resetGame } = useFourPlayerChess()

  // Helper function to check if a square contains a king in check
  const isKingInCheck = (row: number, col: number): boolean => {
    const piece = gameState.board[row][col]
    if (!piece || piece.type !== "king") return false

    return gameState.playersInCheck.includes(piece.color)
  }

  return (
    <div className="flex flex-col items-center">
      <GameStatus
        currentPlayer={gameState.currentPlayer}
        playersInCheck={gameState.playersInCheck}
        eliminatedPlayers={gameState.eliminatedPlayers}
        gameWinner={gameState.gameWinner}
      />

      <div className="flex flex-col items-center my-4">
        {/* Top player (Yellow) */}
        <div className="h-20 flex items-center">
          <CapturedPieces capturedPieces={gameState.capturedPieces} side="top" />
        </div>

        {/* Middle row with Left, Board, and Right */}
        <div className="flex items-center justify-center gap-6">
          {/* Left player (Blue) */}
          <div className="flex flex-col items-center w-32">
            <CapturedPieces capturedPieces={gameState.capturedPieces} side="left" />
          </div>

          {/* Chess board */}
          <div className="chess-board border-4 border-gray-800 bg-gray-600 p-1 shadow-2xl">
            {Array(14)
              .fill(null)
              .map((_, rowIndex) =>
                Array(14)
                  .fill(null)
                  .map((_, colIndex) => {
                    const isSelected =
                      gameState.selectedPiece?.row === rowIndex && gameState.selectedPiece?.col === colIndex
                    const isAvailableMove = gameState.availableMoves.some(
                      (move) => move.row === rowIndex && move.col === colIndex,
                    )
                    const piece = gameState.board[rowIndex][colIndex]
                    const kingInCheck = isKingInCheck(rowIndex, colIndex)

                    return (
                      <ChessSquare
                        key={`${rowIndex}-${colIndex}`}
                        row={rowIndex}
                        col={colIndex}
                        piece={piece}
                        isSelected={isSelected}
                        isAvailableMove={isAvailableMove}
                        isKingInCheck={kingInCheck}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                      />
                    )
                  }),
              )}
          </div>

          {/* Right player (Green) */}
          <div className="flex flex-col items-center w-32">
            <CapturedPieces capturedPieces={gameState.capturedPieces} side="right" />
          </div>
        </div>

        {/* Bottom player (Red) */}
        <div className="h-20 flex items-center">
          <CapturedPieces capturedPieces={gameState.capturedPieces} side="bottom" />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-400 rounded-full"></div>
          <span>Red (Bottom) - Starts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
          <span>Blue (Left)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
          <span>Yellow (Top)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded-full"></div>
          <span>Green (Right)</span>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <div className="mb-2">
          <strong>Rules:</strong> Castling available • When checkmated, all pieces disappear
        </div>
        <div>Pawn Promotion Ranks:</div>
        <div className="flex flex-wrap justify-center gap-4 mt-1">
          <span>Yellow: Row 7</span>
          <span>Red: Row 6</span>
          <span>Blue: Col 7</span>
          <span>Green: Col 6</span>
        </div>
      </div>

      <GameControls onReset={resetGame} />
    </div>
  )
}
