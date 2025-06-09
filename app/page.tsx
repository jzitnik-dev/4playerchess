import { MultiplayerChessLobby } from "@/components/multiplayer-chess-lobby"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <h1 className="text-3xl font-bold mb-8">4-Player Chess Multiplayer</h1>
      <MultiplayerChessLobby />
    </main>
  )
}
