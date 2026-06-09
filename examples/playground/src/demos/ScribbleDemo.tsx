import { useState, useRef, useEffect, useCallback } from 'react'
import { PipWrapper, PipTrigger } from '@pip-it-up/react'


interface Point {
  x: number
  y: number
}

interface Stroke {
  points: Point[]
  color: string
  width: number
}

export default function ScribbleDemo() {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [undoStack, setUndoStack] = useState<Stroke[][]>([])
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])

  const [strokeColor, setStrokeColor] = useState('#6366f1') // Indigo
  const [strokeWidth, setStrokeWidth] = useState(4)

  const strokeColorRef = useRef(strokeColor)
  const strokeWidthRef = useRef(strokeWidth)

  useEffect(() => {
    strokeColorRef.current = strokeColor
  }, [strokeColor])

  useEffect(() => {
    strokeWidthRef.current = strokeWidth
  }, [strokeWidth])

  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<Stroke | null>(null)

  // Convert client coordinates to canvas-space coordinates (800x500 logical resolution)
  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!canvasElement) return null
      const rect = canvasElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * canvasElement.width
      const y = ((e.clientY - rect.top) / rect.height) * canvasElement.height
      return { x, y }
    },
    [canvasElement]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only draw with primary button click (left click / touch / pen tip)
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)

    const coords = getCanvasCoords(e)
    if (!coords) return

    isDrawingRef.current = true
    const newStroke: Stroke = {
      points: [coords],
      color: strokeColorRef.current,
      width: strokeWidthRef.current,
    }
    currentStrokeRef.current = newStroke

    // Draw active dot immediately
    const ctx = canvasElement?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = strokeColorRef.current
      ctx.lineWidth = strokeWidthRef.current
      ctx.moveTo(coords.x, coords.y)
      ctx.lineTo(coords.x, coords.y)
      ctx.stroke()
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return
    e.preventDefault()

    const coords = getCanvasCoords(e)
    if (!coords) return

    const ctx = canvasElement?.getContext('2d')
    if (ctx) {
      const points = currentStrokeRef.current.points
      const lastPoint = points[points.length - 1]

      ctx.beginPath()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = currentStrokeRef.current.color
      ctx.lineWidth = currentStrokeRef.current.width
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(coords.x, coords.y)
      ctx.stroke()
    }

    currentStrokeRef.current.points.push(coords)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    e.preventDefault()

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Pointer capture may already be released if the pointer left the element
    }

    isDrawingRef.current = false

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      const completedStroke = currentStrokeRef.current
      currentStrokeRef.current = null

      setStrokes((prev) => {
        const next = [...prev, completedStroke]
        setUndoStack((prevUndo) => [...prevUndo, prev])
        setRedoStack([])
        return next
      })
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    handlePointerUp(e)
  }

  const undoCanvas = () => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((prevRedo) => [...prevRedo, strokes])
    setUndoStack((prevUndo) => prevUndo.slice(0, -1))
    setStrokes(previous)
  }

  const redoCanvas = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((prevUndo) => [...prevUndo, strokes])
    setRedoStack((prevRedo) => prevRedo.slice(0, -1))
    setStrokes(next)
  }

  const clearCanvas = () => {
    setUndoStack((prevUndo) => [...prevUndo, strokes])
    setRedoStack([])
    setStrokes([])
  }

  const drawCanvas = useCallback((canvas: HTMLCanvasElement, strokesList: Stroke[]) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    strokesList.forEach((stroke) => {
      if (stroke.points.length === 0) return
      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
    })
  }, [])

  useEffect(() => {
    if (canvasElement) {
      drawCanvas(canvasElement, strokes)
    }
  }, [canvasElement, strokes, drawCanvas])

  return (
    <PipWrapper>
      <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Scribble Pad</h3>
          <PipTrigger className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Canvas Board</span>
            <div className="flex gap-2">
              <button
                onClick={undoCanvas}
                disabled={undoStack.length === 0}
                className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Undo
              </button>
              <button
                onClick={redoCanvas}
                disabled={redoStack.length === 0}
                className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Redo
              </button>
              <button
                onClick={clearCanvas}
                disabled={strokes.length === 0}
                className="px-2.5 py-1 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-inner aspect-[16/10] w-full">
            <canvas
              ref={setCanvasElement}
              width={800}
              height={500}
              className="w-full h-full block touch-none cursor-crosshair bg-transparent"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            />
          </div>

          <div className="flex gap-4 items-center mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Color:</span>
              <div className="flex gap-1">
                {['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#111827', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setStrokeColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${
                      strokeColor === c
                        ? 'scale-125 border-gray-400 dark:border-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-gray-400">Size:</span>
              <input
                type="range"
                min="1"
                max="15"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer h-1.5 rounded bg-gray-200 dark:bg-gray-700"
              />
            </div>
          </div>
        </div>
      </div>
    </PipWrapper>
  )
}
