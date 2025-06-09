"use client"

import { Button } from "@/components/ui/button"

interface GameControlsProps {
  onReset: () => void
}

export function GameControls({ onReset }: GameControlsProps) {
  return (
    <div className="flex gap-4 mt-4">
      <Button onClick={onReset}>New Game</Button>
    </div>
  )
}
