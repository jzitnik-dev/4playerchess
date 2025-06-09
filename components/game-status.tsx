interface GameStatusProps {
  currentPlayer: "white" | "black"
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
}

export function GameStatus({ currentPlayer, isCheck, isCheckmate, isStalemate }: GameStatusProps) {
  let statusMessage = `${currentPlayer === "white" ? "White" : "Black"}'s turn`

  if (isCheckmate) {
    statusMessage = `Checkmate! ${currentPlayer === "white" ? "Black" : "White"} wins!`
  } else if (isStalemate) {
    statusMessage = "Stalemate! The game is a draw."
  } else if (isCheck) {
    statusMessage = `${currentPlayer === "white" ? "White" : "Black"} is in check!`
  }

  return (
    <div className="text-center mb-4">
      <div className={`text-xl font-bold ${isCheckmate || isStalemate ? "text-red-600" : ""}`}>{statusMessage}</div>
    </div>
  )
}
