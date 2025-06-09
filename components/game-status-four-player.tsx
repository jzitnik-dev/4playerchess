import type { PieceColor } from "@/types/chess"

interface GameStatusProps {
  currentPlayer: PieceColor
  playersInCheck: PieceColor[]
  eliminatedPlayers: PieceColor[]
  gameWinner: PieceColor | null
}

export function GameStatus({ currentPlayer, playersInCheck, eliminatedPlayers, gameWinner }: GameStatusProps) {
  const getPlayerName = (color: PieceColor) => {
    return color.charAt(0).toUpperCase() + color.slice(1)
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

  // Display the turn order starting with Red
  const turnOrder = () => {
    const players = ["red", "blue", "yellow", "green"] as PieceColor[]
    const activeOrder = players.filter((player) => !eliminatedPlayers.includes(player))

    return (
      <div className="flex items-center gap-2 text-sm mt-2">
        <span>Turn Order:</span>
        {activeOrder.map((player, index) => (
          <span key={player} className={`${getPlayerColor(player)} ${player === currentPlayer ? "font-bold" : ""}`}>
            {getPlayerName(player)}
            {index < activeOrder.length - 1 ? " → " : ""}
          </span>
        ))}
      </div>
    )
  }

  if (gameWinner) {
    return (
      <div className="text-center mb-4">
        <div className={`text-2xl font-bold ${getPlayerColor(gameWinner)}`}>{getPlayerName(gameWinner)} Wins!</div>
        <div className="text-sm text-gray-600 mt-2">All other players have been eliminated</div>
      </div>
    )
  }

  return (
    <div className="text-center mb-4 space-y-2">
      <div className={`text-xl font-bold ${getPlayerColor(currentPlayer)}`}>{getPlayerName(currentPlayer)}'s Turn</div>

      {playersInCheck.length > 0 && (
        <div className="text-red-600 font-semibold">
          Players in Check: {playersInCheck.map(getPlayerName).join(", ")}
        </div>
      )}

      {eliminatedPlayers.length > 0 && (
        <div className="text-red-500 font-semibold">
          💀 Eliminated (Checkmated): {eliminatedPlayers.map(getPlayerName).join(", ")}
        </div>
      )}

      {turnOrder()}
    </div>
  )
}
