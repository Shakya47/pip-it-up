import { useRef, useEffect } from 'react'
import { PipWrapper, PipTrigger, usePipContext } from '@pip-it-up/react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Module-level persistent state to survive React component unmount/remount transitions
const persistentMapState = {
  center: [51.505, -0.09] as [number, number],
  zoom: 13,
  marker: [51.505, -0.09] as [number, number],
}

export default function MapDemo() {
  return (
    <PipWrapper>
      <MapContent />
    </PipWrapper>
  )
}

function MapContent() {
  const { state } = usePipContext()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    // Initialize map
    const map = L.map(container).setView(persistentMapState.center, persistentMapState.zoom)
    mapRef.current = map

    // Add Tile Layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    // Custom inline SVG marker to avoid Leaflet path asset loading errors
    const customIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center -translate-x-1/2 -translate-y-full">
          <svg class="w-8 h-8 text-red-500 filter drop-shadow-md cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })

    // Add Draggable Marker
    const marker = L.marker(persistentMapState.marker, {
      draggable: true,
      icon: customIcon,
    }).addTo(map)
    markerRef.current = marker

    // Event handlers to update saved state in real-time
    const handleMove = () => {
      const center = map.getCenter()
      persistentMapState.center = [center.lat, center.lng]
      persistentMapState.zoom = map.getZoom()
    }

    const handleDrag = () => {
      const pos = marker.getLatLng()
      persistentMapState.marker = [pos.lat, pos.lng]
    }

    map.on('moveend', handleMove)
    map.on('zoomend', handleMove)
    marker.on('dragend', handleDrag)

    // Force map to layout properly in a newly opened PiP window
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)

    return () => {
      clearTimeout(timer)
      map.off('moveend', handleMove)
      map.off('zoomend', handleMove)
      marker.off('dragend', handleDrag)
      try {
        map.remove()
      } catch (err) {
        console.warn('Leaflet cleanup error:', err)
      }
      mapRef.current = null
      markerRef.current = null
    }
  }, [state.isOpen])

  return (
    <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl shadow-md bg-white dark:bg-gray-800 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
        <div className="text-left">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Interactive Map</h3>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-150 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1 inline-block">
            Status: {state.isOpen ? '📺 Floating in PiP' : '📱 In Main Window'}
          </span>
        </div>
        <PipTrigger className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium rounded-lg text-sm transition-all duration-200 shadow-sm cursor-pointer" />
      </div>

      <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 shadow-inner h-[320px] z-10">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  )
}
