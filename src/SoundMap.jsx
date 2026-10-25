
import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter = [13.0827, 80.2707];

const audioIcon = L.divIcon({
  className: "sound-map-marker",
  html: `<div class="sound-map-pin">♫</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -18],
});

const userIcon = L.divIcon({
  className: "user-map-marker",
  html: `<div class="sound-map-user-pin"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function getCoordinates(post) {
  const lat = post.coords?.lat ?? post.latitude ?? post.lat;
  const lng = post.coords?.lng ?? post.longitude ?? post.lng;

  if (lat === null || lat === undefined || lat === "") return null;
  if (lng === null || lng === undefined || lng === "") return null;

  const latitude = Number(lat);
  const longitude = Number(lng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return [latitude, longitude];
}

function MapViewport({ location, positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const points = [...positions];

      if (location) {
        points.push([Number(location.lat), Number(location.lng)]);
      }

      if (points.length === 1) {
        map.setView(points[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(points), {
          padding: [40, 40],
          maxZoom: 14,
        });
      }
    } else if (location) {
      map.flyTo(
        [Number(location.lat), Number(location.lng)],
        14,
        { duration: 1 }
      );
    }
  }, [map, location?.lat, location?.lng, positions]);

  return null;
}

export default function SoundMap({
  posts = [],
  location,
  onPlay,
  onLocate,
}) {
  const postsWithLocation = posts
    .map((post) => ({
      ...post,
      mapPosition: getCoordinates(post),
    }))
    .filter((post) => post.mapPosition !== null);

  const positions = postsWithLocation.map(
    (post) => post.mapPosition
  );

  const center = location
    ? [Number(location.lat), Number(location.lng)]
    : positions.length > 0
      ? positions[0]
      : defaultCenter;

  return (
    <div className="sound-map-container">
      <div className="sound-map-toolbar">
        <span>
          <span className="sound-map-live-dot"></span>
          REAL-WORLD MAP
        </span>

        <button
          type="button"
          className="sound-map-locate"
          onClick={onLocate}
        >
          Locate me
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className="sound-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewport
          location={location}
          positions={positions}
        />

        {location &&
          Number.isFinite(Number(location.lat)) &&
          Number.isFinite(Number(location.lng)) && (
            <Marker
              position={[
                Number(location.lat),
                Number(location.lng),
              ]}
              icon={userIcon}
            >
              <Popup>
                <strong>Your current location</strong>
              </Popup>
            </Marker>
          )}

        {postsWithLocation.map((post) => (
          <Marker
            key={post.id}
            position={post.mapPosition}
            icon={audioIcon}
          >
            <Popup>
              <div className="sound-popup">
                <div className="sound-popup-label">
                  {post.category || "Audio"}
                </div>

                <h3>{post.title || "Untitled audio"}</h3>

                <p>
                  {post.description ||
                    "Listen to this local moment."}
                </p>

                {post.duration_seconds != null && (
                  <p>
                    Duration: {post.duration_seconds} seconds
                  </p>
                )}

                <button
                  type="button"
                  className="sound-popup-play"
                  onClick={() => onPlay?.(post)}
                  disabled={!post.audio_url}
                >
                  ▶ Play audio
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="sound-map-caption">
        <strong>{postsWithLocation.length}</strong>{" "}
        audio location
        {postsWithLocation.length === 1 ? "" : "s"} found.

        {posts.length !== postsWithLocation.length && (
          <span>
            {" "}
            {posts.length - postsWithLocation.length} post(s)
            have missing or invalid coordinates.
          </span>
        )}
      </div>
    </div>
  );
}
