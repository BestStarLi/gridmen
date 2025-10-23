import { useEffect, useRef, forwardRef, useState, useCallback } from 'react'
import { create } from 'zustand'
import mapboxgl from 'mapbox-gl'
import ToolPanel from './toolPanel'
import LayerGroup from './layerGroup'
import 'mapbox-gl/dist/mapbox-gl.css'
import MapView, { MapViewContext } from './mapView'
import { VIEW_REGISTRY } from '@/registry/viewRegistry'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

const initialLongitude = 114.051537
const initialLatitude = 22.446937
const initialZoom = 11
const maxZoom = 22

let resizer: ResizeObserver | null = null

interface MapContainerProps {
    onMapLoad?: (map: mapboxgl.Map) => void
}

const debounce = (func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout
    return (...args: any[]) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
            func(...args)
        }, delay)
    }
}

const mapCanvasDebounce = (map: mapboxgl.Map, delay: number, mapRef: HTMLDivElement) => {
    resizer = new ResizeObserver(
        debounce(() => {
            map?.resize()
        }, delay)
    )
    resizer.observe(mapRef)
}

const useMapStore = create<MapViewContext>((set) => ({
    map: null,
    setMap: (map: mapboxgl.Map) => set({ map }),
}))

const MapContainer = forwardRef<HTMLDivElement, MapContainerProps>(({ onMapLoad }, ref) => {

    const initializedRef = useRef(false)
    const mapWrapperRef = useRef<HTMLDivElement>(null)

    const { map, setMap } = useMapStore()

    useEffect(() => {
        mapboxgl.accessToken = import.meta.env.VITE_MAP_TOKEN
        const currentMapWrapper = mapWrapperRef.current

        if (currentMapWrapper && !initializedRef.current) {
            initializedRef.current = true

            const currentMap = useMapStore.getState().map

            if (currentMap) {
                try {
                    const oldContainer = currentMap.getContainer()
                    if (oldContainer && oldContainer.parentNode) {
                        oldContainer.parentNode.removeChild(oldContainer)
                    }
                } catch (e) {
                    console.warn('Failed to remove old container:', e)
                }

                currentMapWrapper.appendChild(currentMap.getContainer())
                currentMap.resize()

                onMapLoad!(currentMap)

                mapCanvasDebounce(currentMap, 100, currentMapWrapper)

            } else {
                const mapInstance = new mapboxgl.Map({
                    container: currentMapWrapper,
                    style: 'mapbox://styles/mapbox/streets-v12',
                    projection: 'globe',
                    center: [initialLongitude, initialLatitude],
                    zoom: initialZoom,
                    maxZoom: maxZoom,
                    attributionControl: false,
                    boxZoom: false,
                })

                mapInstance.on('style.load', () => {
                    mapInstance.setFog({})
                })

                onMapLoad!(mapInstance)

                setMap(mapInstance)

                mapCanvasDebounce(mapInstance, 100, currentMapWrapper)
            }
        }

        return () => {
            initializedRef.current = false

            if (resizer && currentMapWrapper) {
                resizer.unobserve(currentMapWrapper)
                resizer.disconnect()
            }
        }

    }, [onMapLoad, setMap])

    return (
        <div className="flex h-full items-center justify-center">
            <div className='relative w-full h-full' ref={mapWrapperRef} />
        </div>
    )
})




export default function MapViewComponent() {

    const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)

    const viewConfig = VIEW_REGISTRY[MapView.classKey]
    const viewModels = viewConfig?.viewModels || null

    const handleMapLoad = useCallback((map: mapboxgl.Map) => {
        setMapInstance(map)
    }, [])

    return (
        <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full text-white "
        >
            <ResizablePanel defaultSize={13}>
                <LayerGroup />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={63}>
                <MapContainer onMapLoad={handleMapLoad} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24}>
                <ToolPanel
                    viewModels={viewModels}
                    mapContainer={mapInstance}
                />
            </ResizablePanel>
        </ResizablePanelGroup >
    )
}
