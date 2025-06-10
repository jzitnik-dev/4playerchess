"use client"

import { useState, useEffect } from "react"
import { useSocket } from "@/hooks/use-socket"
import { MultiplayerChessGame } from "./multiplayer-chess-game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Room } from "@/types/multiplayer"

export function MultiplayerChessLobby() {
  const { socket, isConnected } = useSocket()
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [playerName, setPlayerName] = useState("")
  const [roomName, setRoomName] = useState("")
  const [error, setError] = useState("")

  const joinRoomAgain = (roomId: string, playerId: string) => {
    if (!socket) {
      return;
    }
    socket.emit("joinRoomAgain", roomId, playerId)
  }

  useEffect(() => {
    if (!socket) return

    socket.on("roomCreated", (room, player) => {
      setCurrentRoom(room)
      localStorage.setItem("roomId", room.id);
      localStorage.setItem("playerId", player.id);
      setError("")
    })

    socket.on("roomJoined", (room, player) => {
      setCurrentRoom(room)
      localStorage.setItem("roomId", room.id);
      localStorage.setItem("playerId", player.id);
      setError("")
    })

    socket.on("roomLeft", () => {
      setCurrentRoom(null)
    })

    socket.on("error", (message) => {
      setError(message)
    })

    socket.on("roomsList", (rooms) => {
      setAvailableRooms(rooms)
    })

    socket.on("playerJoined", (player) => {
      if (currentRoom) {
        const updatedRoom = {
          ...currentRoom,
          players: [...currentRoom.players, player],
        };
        setCurrentRoom(updatedRoom);
      }
    })

    socket.on("playerLeft", (playerId) => {
      if (currentRoom) {
        setCurrentRoom({
          ...currentRoom,
          players: currentRoom.players.filter((p) => p.id !== playerId),
        })
      }
    })

    // Get available rooms on connect
    if (isConnected) {
      socket.emit("getRooms")
    }

    return () => {
      socket.off("roomCreated")
      socket.off("roomJoined")
      socket.off("roomLeft")
      socket.off("error")
      socket.off("roomsList")
      socket.off("playerJoined")
      socket.off("playerLeft")
    }
  }, [socket, isConnected, currentRoom])

  useEffect(() => {
    if (localStorage.getItem("playerId") && localStorage.getItem("roomId")) {
      joinRoomAgain(localStorage.getItem("roomId") || "", localStorage.getItem("playerId") || "");
    }
  }, [socket, isConnected]);

  const createRoom = () => {
    if (!socket || !playerName.trim() || !roomName.trim()) {
      setError("Please enter both player name and room name")
      return
    }
    socket.emit("createRoom", roomName.trim(), playerName.trim())
  }

  const joinRoom = (roomId: string) => {
    if (!socket || !playerName.trim()) {
      setError("Please enter your player name")
      return
    }
    socket.emit("joinRoom", roomId, playerName.trim())
  }

  const leaveRoom = () => {
    if (!socket) return
    localStorage.removeItem("roomId");
    localStorage.removeItem("playerId");
    socket.emit("leaveRoom")
    setCurrentRoom(null)
  }

  const refreshRooms = () => {
    if (!socket) return
    socket.emit("getRooms")
  }

  if (!isConnected) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Connecting to server...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (currentRoom) {
    return <MultiplayerChessGame room={currentRoom} socket={socket} onLeaveRoom={leaveRoom} />
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Join 4-Player Chess</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Name</label>
            <Input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Create New Room</h3>
              <div className="space-y-3">
                <Input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Room name"
                  maxLength={30}
                />
                <Button onClick={createRoom} className="w-full" disabled={!playerName.trim() || !roomName.trim()}>
                  Create Room
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Available Rooms</h3>
                <Button variant="outline" size="sm" onClick={refreshRooms}>
                  Refresh
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableRooms.length === 0 ? (
                  <p className="text-gray-500 text-sm">No rooms available</p>
                ) : (
                  availableRooms.map((room) => (
                    <Card key={room.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{room.name}</p>
                          <p className="text-sm text-gray-500">
                            {room.players.length}/4 players • Room: {room.id}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => joinRoom(room.id)}
                          disabled={!playerName.trim() || room.players.length >= 4}
                        >
                          Join
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
