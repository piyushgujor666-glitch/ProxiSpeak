import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines, Compass, MapPin, Mic, Navigation, Pause, Play,
  Plus, Radio, Search, ShieldCheck, Sparkles, Trash2, Upload, X
} from "lucide-react";

const STORAGE_KEY = "proxispeak.posts.v1";
const DEMO_POSTS = [
  { id: "demo-1", title: "The quiet courtyard", description: "A calm little spot behind the library.", category: "Hidden gem", distance: 0.3, duration: "0:18", createdAt: Date.now() - 3600000, demo: true },
  { id: "demo-2", title: "Coffee shop ambience", description: "Soft music and cups clinking on a rainy afternoon.", category: "Ambience", distance: 0.7, duration: "0:32", createdAt: Date.now() - 7200000, demo: true },
  { id: "demo-3", title: "A story from this street", description: "A short memory connected to this place.", category: "Story", distance: 1.2, duration: "0:24", createdAt: Date.now() - 86400000, demo: true }
];

function loadPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(saved) ? saved : DEMO_POSTS;
  } catch {
    return DEMO_POSTS;
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function haversineKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export default function App() {
  const [posts, setPosts] = useState(loadPosts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("Demo location mode · sample distances");
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Story");
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [notice, setNotice] = useState("");
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    // Local-only prototype: audio blobs are kept in memory; post metadata is saved locally.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.map(({ audioUrl, ...p }) => p)));
  }, [posts]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const visiblePosts = useMemo(() => posts
    .map(post => {
      if (location && post.coords) return { ...post, distance: haversineKm(location, post.coords) };
      return post;
    })
    .filter(post => `${post.title} ${post.description} ${post.category}`.toLowerCase().includes(query.toLowerCase()))
    .filter(post => category === "All" || post.category === category)
    .sort((a, b) => a.distance - b.distance), [posts, query, category, location]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported by this browser.");
      return;
    }
    setLocationMessage("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationMessage("Location enabled · distances calculated for posts with coordinates");
        setNotice("Location permission granted.");
      },
      err => {
        const messages = {
          1: "Location permission denied. You can still explore sample posts.",
          2: "Your location is currently unavailable.",
          3: "Location request timed out."
        };
        setLocationMessage(messages[err.code] || "Could not get location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice("Recording is not supported in this browser. Try a current Chrome browser over localhost.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setRecordingUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      setNotice("Recording started. Speak clearly, then press Stop.");
    } catch {
      setNotice("Microphone access was blocked or unavailable. Check browser permissions.");
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") mediaRecorder.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  function useAudioFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setNotice("Please choose an audio file.");
      return;
    }
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingBlob(file);
    setRecordingUrl(URL.createObjectURL(file));
    setNotice(`Audio selected: ${file.name}`);
  }

  function publishPost(event) {
    event.preventDefault();
    if (!title.trim()) {
      setNotice("Please add a title for your audio post.");
      return;
    }
    if (!recordingBlob || !recordingUrl) {
      setNotice("Record audio or upload an audio file before publishing.");
      return;
    }
    const post = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: title.trim(),
      description: description.trim() || "A nearby audio moment.",
      category: selectedCategory,
      distance: 0,
      duration: formatTime(recordingTime),
      createdAt: Date.now(),
      audioUrl: recordingUrl,
      audioBlob: recordingBlob,
      coords: location || undefined,
      demo: false
    };
    setPosts(current => [post, ...current]);
    setTitle("");
    setDescription("");
    setSelectedCategory("Story");
    setRecordingBlob(null);
    setRecordingUrl("");
    setRecordingTime(0);
    setShowComposer(false);
    setNotice("Your audio post is published in this browser prototype.");
  }

  function removePost(id) {
    setPosts(current => current.filter(post => post.id !== id));
    if (playingId === id && audioRef.current) audioRef.current.pause();
    setPlayingId(null);
    setNotice("Post removed.");
  }

  function playPost(post) {
    if (!post.audioUrl) {
      setNotice("This is a sample card. Add your own recording to test playback.");
      return;
    }
    if (playingId === post.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = post.audioUrl;
      audioRef.current.play().then(() => setPlayingId(post.id)).catch(() => setNotice("Could not play this audio file."));
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="ProxiSpeak home">
          <span className="brand-mark"><AudioLines size={23} /></span>
          <span>proxi<span className="brand-accent">speak</span><small>sound lives here</small></span>
        </a>
        <nav className="top-links"><a className="active" href="#explore">Explore</a><a href="#how">How it works</a></nav>
        <button className="button button-primary top-cta" onClick={() => setShowComposer(true)}><Plus size={17}/> Share audio</button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow glow-one"></div><div className="hero-glow glow-two"></div>
          <div className="hero-content">
            <div className="eyebrow"><span className="live-dot"></span> AUDIO, CONNECTED TO PLACE</div>
            <h1>Every place has<br/>a <span>voice.</span></h1>
            <p className="hero-copy">Discover the stories, sounds, and little secrets hiding just around the corner.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={requestLocation}><Navigation size={17}/> Find audio near me</button>
              <button className="button button-ghost" onClick={() => setShowComposer(true)}><Mic size={17}/> Record a moment</button>
            </div>
            <div className="privacy-note"><ShieldCheck size={15}/><span>Your location stays in this browser prototype.</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-outer"></div><div className="orbit orbit-inner"></div>
            <div className="map-lines"><span></span><span></span><span></span><span></span><span></span><span></span></div>
            <div className="sound-core"><AudioLines size={54}/></div>
            <div className="sound-ring ring-a"></div><div className="sound-ring ring-b"></div>
            <div className="map-pin pin-a"><MapPin size={19}/></div><div className="map-pin pin-b"><Radio size={18}/></div><div className="map-pin pin-c"><Sparkles size={17}/></div>
            <div className="floating-tag tag-a"><span className="mini-wave">▂▅▃▇▅</span> A story nearby</div>
            <div className="floating-tag tag-b"><span className="tag-dot"></span> 3 sounds around you</div>
          </div>
          <div className="hero-bottom"><span>01 / LISTEN LOCAL</span><span>FIELD NOTES FOR YOUR EARS <span className="arrow-down">↘</span></span></div>
        </section>

        <section className="explore-section" id="explore">
          <div className="section-heading">
            <div><div className="eyebrow muted">YOUR LOCAL SOUND MAP</div><h2>Listen around you<span>.</span></h2><p className="section-copy">Small moments. Real places. Voices worth hearing.</p></div>
            <div className="location-status"><span className="status-dot"></span><span>{locationMessage}</span></div>
          </div>
          <div className="toolbar">
            <label className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sounds, stories, places…" /></label>
            <div className="filter-wrap"><Compass size={17}/><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter category"><option>All</option><option>Story</option><option>Ambience</option><option>Hidden gem</option><option>Guide</option></select></div>
            <button className="button button-outline" onClick={requestLocation}><MapPin size={16}/> Use my location</button>
          </div>

          <div className="content-grid">
            <div className="audio-list">
              <div className="list-label"><span>NEARBY AUDIO</span><span>{visiblePosts.length} MOMENTS</span></div>
              {visiblePosts.length === 0 && <div className="empty-state"><AudioLines size={28}/><h3>No audio found</h3><p>Try another search or category.</p></div>}
              {visiblePosts.map((post, index) => (
                <article className="audio-card" key={post.id}>
                  <div className={`card-art art-${index % 3}`}>
                    {index % 3 === 0 ? <Radio size={29}/> : index % 3 === 1 ? <AudioLines size={29}/> : <Sparkles size={29}/>}
                    <span className="art-number">0{index + 1}</span>
                  </div>
                  <div className="audio-info">
                    <div className="card-meta"><span className="category-pill">{post.category}</span><span>{post.duration}</span></div>
                    <h3>{post.title}</h3><p>{post.description}</p>
                    <div className="card-bottom"><span><MapPin size={13}/> {post.distance < 1 ? `${Math.round(post.distance * 1000)} m away` : `${post.distance.toFixed(1)} km away`}</span><span>{post.demo ? "Sample audio" : "Your post"}</span></div>
                  </div>
                  <div className="card-controls">
                    <button className="play-button" onClick={() => playPost(post)} aria-label={`Play ${post.title}`}>{playingId === post.id ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button>
                    {!post.demo && <button className="icon-button delete-button" onClick={() => removePost(post.id)} aria-label="Delete post"><Trash2 size={16}/></button>}
                  </div>
                </article>
              ))}
              <button className="add-card" onClick={() => setShowComposer(true)}><span><Plus size={19}/></span><div><strong>Add your voice to this place</strong><small>Record or upload a short audio moment</small></div><span className="add-arrow">↗</span></button>
            </div>

            <aside className="side-column">
              <div className="map-card">
                <div className="map-card-head"><div><span className="eyebrow muted">SPATIAL PREVIEW</span><h3>Soundscape</h3></div><span className="map-live"><span className="live-dot"></span> LIVE UI</span></div>
                <div className="illustrated-map">
                  <div className="map-block block-1"></div><div className="map-block block-2"></div><div className="map-block block-3"></div><div className="map-block block-4"></div><div className="map-block block-5"></div><div className="map-block block-6"></div>
                  <div className="map-road road-1"></div><div className="map-road road-2"></div><div className="map-road road-3"></div><div className="map-road road-4"></div>
                  <div className="map-water"></div>
                  <div className="map-marker marker-1"><AudioLines size={14}/></div><div className="map-marker marker-2"><Mic size={14}/></div><div className="map-marker marker-3"><Radio size={14}/></div><div className="you-marker"><span></span></div>
                  <div className="map-label label-1">Library</div><div className="map-label label-2">Market St.</div><div className="map-label label-3">You</div>
                </div>
                <div className="map-legend"><span><i className="legend-you"></i>Your position</span><span><i className="legend-audio"></i>Audio moments</span></div>
                <p className="map-disclaimer">Illustrative map only — not real map tiles. Nearby distances are sample values until posts have coordinates.</p>
              </div>
              <div className="tip-card"><div className="tip-icon"><Sparkles size={19}/></div><div><strong>A little local magic</strong><p>Leave a sound that helps someone see a familiar place differently.</p></div></div>
            </aside>
          </div>
        </section>

        <section className="how-section" id="how"><div className="eyebrow muted">THREE SIMPLE STEPS</div><h2>Listen. Locate. <span>Connect.</span></h2><div className="steps"><div><b>01</b><h3>Find your place</h3><p>Allow location access to explore audio associated with places.</p></div><div><b>02</b><h3>Press play</h3><p>Listen to local stories, guides, and ambient moments.</p></div><div><b>03</b><h3>Leave a voice</h3><p>Record a short clip and share it in this local prototype.</p></div></div></section>
      </main>

      <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><AudioLines size={20}/></span><span>proxi<span className="brand-accent">speak</span><small>sound lives here</small></span></a><span>Built as a learning prototype · ProxiSpeak</span><span>Made for the curious <span className="footer-heart">✳</span></span></footer>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15}/></button></div>}
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} onPause={() => setPlayingId(null)} hidden />

      {showComposer && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowComposer(false); }}>
        <section className="composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
          <div className="modal-header"><div><div className="eyebrow muted">SHARE A LOCAL MOMENT</div><h2 id="composer-title">Give this place a voice.</h2></div><button className="icon-button" onClick={() => setShowComposer(false)} aria-label="Close"><X/></button></div>
          <form onSubmit={publishPost}>
            <label className="field-label">Audio title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rain on the campus roof" maxLength={70} required /></label>
            <label className="field-label">Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What should listeners know?" rows={3} maxLength={220}/></label>
            <label className="field-label">Category<select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option>Story</option><option>Ambience</option><option>Hidden gem</option><option>Guide</option></select></label>
            <div className="record-panel"><div className={`record-symbol ${recording ? "is-recording" : ""}`}><Mic size={22}/></div><div className="record-copy"><strong>{recording ? "Recording in progress…" : recordingUrl ? "Audio ready to publish" : "Record your audio"}</strong><span>{recording ? formatTime(recordingTime) : recordingUrl ? "Your clip is attached." : "Use your microphone or upload an audio file."}</span></div>
              {!recording ? <button type="button" className="button button-outline" onClick={startRecording}><Mic size={16}/> Record</button> : <button type="button" className="button button-danger" onClick={stopRecording}><Pause size={16}/> Stop</button>}
            </div>
            <div className="upload-row"><button type="button" className="text-button" onClick={() => fileInput.current?.click()}><Upload size={16}/> Upload audio instead</button>{recordingUrl && <button type="button" className="text-button" onClick={() => { URL.revokeObjectURL(recordingUrl); setRecordingUrl(""); setRecordingBlob(null); setRecordingTime(0); }}><Trash2 size={15}/> Remove audio</button>}<input ref={fileInput} type="file" accept="audio/*" hidden onChange={useAudioFile}/></div>
            {recordingUrl && <audio className="audio-preview" src={recordingUrl} controls />}
            <div className="location-note"><MapPin size={15}/>{location ? "Your current browser location will be attached to this post." : "Enable location on the main page to attach coordinates. Otherwise this post uses sample-distance display."}</div>
            <button className="button button-primary publish-button" type="submit"><Plus size={17}/> Publish audio moment</button>
            <p className="prototype-note">Prototype note: posts are stored in this browser only. Audio blobs do not persist after a page reload. A production app needs a backend and file storage.</p>
          </form>
        </section>
      </div>}
    </div>
  );
}