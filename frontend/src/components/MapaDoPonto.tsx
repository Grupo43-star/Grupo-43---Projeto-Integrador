import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'

interface Props {
  latitude: number
  longitude: number
  nome: string
}

const ZOOM = 16

// Mapa só para ver onde fica o ponto de coleta (carregado sob demanda, como o do endereço).
// O pino fica fixo no centro e o mapa não arrasta: o zoom (botões, dois dedos ou duplo
// clique) é sempre pelo centro, então o pino continua certo. Roda do mouse não dá zoom,
// para não prender a rolagem da página. As classes visuais são as do mapa do endereço.
export default function MapaDoPonto({ latitude, longitude, nome }: Props) {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!divRef.current) return
    const mapa = L.map(divRef.current, {
      dragging: false,
      keyboard: false,
      boxZoom: false,
      scrollWheelZoom: false,
      touchZoom: 'center',
      doubleClickZoom: 'center',
      zoomControl: true,
    })
    mapa.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)
    mapa.setView([latitude, longitude], ZOOM, { animate: false })
    return () => {
      mapa.remove()
    }
  }, [latitude, longitude])

  return (
    <div className="mapa-endereco__moldura">
      <div
        ref={divRef}
        className="mapa-endereco__mapa"
        role="region"
        aria-label={`Mapa com a localização de ${nome}`}
      />
      <span className="mapa-endereco__pino" aria-hidden="true">
        <MapPin size={34} strokeWidth={2} />
      </span>
    </div>
  )
}
