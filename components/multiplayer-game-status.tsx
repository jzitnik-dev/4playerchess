import type { GameState, PieceColor } from "@/types/chess"
import type { Player } from "@/types/multiplayer"

interface MultiplayerGameStatusProps {
  gameState: GameState
  myPlayer: Player | undefined
  players: Player[]
}

export function GameStatus({ gameState, myPlayer, players }: MultiplayerGameStatusProps) {
  const getPlayerName = (color: PieceColor) => {
    const player = players.find((p) => p.color === color)
    return player?.name || color.charAt(0).toUpperCase() + color.slice(1)
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

  if (gameState.gameWinner) {
    const winnerName = getPlayerName(gameState.gameWinner)
    const isMyWin = myPlayer?.color === gameState.gameWinner

    return (
      <div className="text-center mb-4">
        <div className={`text-2xl font-bold ${getPlayerColor(gameState.gameWinner)}`}>
          {isMyWin ? "🎉 You Win!" : `${winnerName} Wins!`}
        </div>
        <div className="text-sm text-gray-600 mt-2">All other players have been eliminated</div>
      </div>
    )
  }

  const currentPlayerName = getPlayerName(gameState.currentPlayer)
  const isMyTurn = myPlayer?.color === gameState.currentPlayer
  const amEliminated = myPlayer ? gameState.eliminatedPlayers.includes(myPlayer.color) : false

  return (
    <div className="text-center mb-4 space-y-2">
      <div className={`text-xl font-bold ${getPlayerColor(gameState.currentPlayer)}`}>
        {isMyTurn ? "Your Turn!" : `${currentPlayerName}'s Turn`}
      </div>

      {amEliminated && <div className="text-red-500 font-semibold">💀 You have been eliminated</div>}

      {gameState.playersInCheck.length > 0 && (
        <div className="text-red-600 font-semibold">
          Players in Check: {gameState.playersInCheck.map(getPlayerName).join(", ")}
        </div>
      )}

      {gameState.eliminatedPlayers.length > 0 && (
        <div className="text-red-500 font-semibold">
          💀 Eliminated: {gameState.eliminatedPlayers.map(getPlayerName).join(", ")}
        </div>
      )}
    </div>
  )
}
