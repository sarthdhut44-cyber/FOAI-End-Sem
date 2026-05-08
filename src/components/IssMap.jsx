import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

const issIcon = L.divIcon({
  className: "iss-marker",
  html: "<span>ISS</span>",
  iconSize: [52, 52],
  iconAnchor: [26, 26]
});

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lon], map.getZoom(), { animate: true });
  }, [map, position]);
  return null;
}

export default function IssMap({ current, path, speed }) {
  const center = current ? [current.lat, current.lon] : [0, 0];
  const line = path.map((point) => [point.lat, point.lon]);

  return (
    <MapContainer center={center} zoom={3} minZoom={2} scrollWheelZoom className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {current && (
        <Marker position={[current.lat, current.lon]} icon={issIcon}>
          <Tooltip direction="top" offset={[0, -18]} permanent={false}>
            <strong>ISS Live Position</strong>
            <br />
            {current.lat.toFixed(4)}, {current.lon.toFixed(4)}
            <br />
            {Math.round(speed).toLocaleString()} km/h
          </Tooltip>
        </Marker>
      )}
      {line.length > 1 && <Polyline positions={line} color="#f59e0b" weight={4} opacity={0.9} />}
      <Recenter position={current} />
    </MapContainer>
  );
}
