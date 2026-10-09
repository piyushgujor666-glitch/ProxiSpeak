import "./App.css";

const recordings = [
  {
    title: "Morning on Campus",
    location: "College Campus",
    distance: "120 m away",
    duration: "0:42",
    icon: "🎓",
  },
  {
    title: "City Sounds",
    location: "City Centre",
    distance: "350 m away",
    duration: "1:15",
    icon: "🌆",
  },
  {
    title: "Nature's Calm",
    location: "Green Park",
    distance: "600 m away",
    duration: "0:58",
    icon: "🌿",
  },
];

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="brand">◉ ProxiSpeak</h2>

        <p className="menu-label">WORKSPACE</p>

        <nav>
          <a className="active" href="#dashboard">
            ◫ Dashboard
          </a>
          <a href="#explore">⌖ Explore Map</a>
          <a href="#upload">＋ Upload Audio</a>
          <a href="#profile">♙ My Profile</a>
        </nav>

        <div className="sidebar-bottom">
          <p>Discover sounds around you.</p>
          <span>ProxiSpeak · Development</span>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR SOUND COMMUNITY</p>
            <h1>Discover nearby audio.</h1>
          </div>

          <button className="primary-button">
            + Upload audio
          </button>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">WELCOME TO PROXISPEAK</p>
            <h2>Every place has a story.</h2>
            <p>
              Explore sounds, stories and voices connected to places.
            </p>
          </div>

          <div className="welcome-icon">♫</div>
        </section>

        <section className="section">
          <div className="section-heading">
            <div>
              <h2>Nearby recordings</h2>
              <p>Sample content for your first UI build</p>
            </div>
            <span className="count">{recordings.length} samples</span>
          </div>

          <div className="recording-grid">
            {recordings.map((audio) => (
              <article className="audio-card" key={audio.title}>
                <div className="audio-art">
                  <span>{audio.icon}</span>
                  <span className="duration">{audio.duration}</span>
                </div>

                <div className="audio-details">
                  <h3>{audio.title}</h3>
                  <p>{audio.location}</p>
                  <span className="distance">
                    ⌖ {audio.distance}
                  </span>
                  <button
                    className="play-button"
                    onClick={() =>
                      alert("Audio playback will be implemented next.")
                    }
                  >
                    ▶ Preview
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="map-placeholder" id="explore">
          <div>
            <span className="map-symbol">⌖</span>
            <h2>Your audio map goes here</h2>
            <p>
              An interactive map will be added in the next stage.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;