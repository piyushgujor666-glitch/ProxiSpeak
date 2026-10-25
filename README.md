# 🎙️ ProxiSpeak

**Discover the world through sound.**

ProxiSpeak is a location-based audio-sharing web application that lets people discover, listen to, and share audio experiences associated with different places.

From local stories and ambient sounds to hidden gems and travel guides, ProxiSpeak aims to help people explore the world through sound.

## ✨ Features

- 🎧 Audio recording, uploading, and playback
- 📍 Browser geolocation and location-based discovery
- 🔍 Search and category filters
- ❤️ Likes stored locally using `localStorage`
- 🔖 Bookmarks saved in the browser
- 💬 Comments on audio posts
- 🚩 Report inappropriate audio
- ✏️ Edit audio post details
- 🗑️ Delete audio posts
- ☁️ Cloudinary audio storage
- 🗄️ PostgreSQL database integration
- 📱 Responsive React interface

## 🛠️ Tech Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS
- Lucide React

**Backend**
- Node.js
- Express.js
- REST APIs
- PostgreSQL
- Cloudinary
- Multer

**Tools**
- Git and GitHub
- VS Code
- AI-assisted development tools

## 👨‍💻 My Contribution

I developed the **frontend independently**, including the React interface, styling, user interactions, and frontend functionality.

For backend development, I used **AI assistance** to help implement API endpoints, database operations, audio uploads, and server-side features. I also worked on integrating the frontend with the backend and testing the application.

This project has helped me develop practical skills in React, JavaScript, REST API integration, Node.js, Express, PostgreSQL, cloud storage, debugging, and Git workflows.

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL database
- Cloudinary account

### 1. Clone the repository

```bash
git clone https://github.com/piyushgujor666-glitch/ProxiSpeak
cd proxispeak_starter
```

Replace `YOUR_REPOSITORY_URL` with your GitHub repository URL.

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd proxispeak_backend
npm install
```

### 4. Configure environment variables

Create the backend `.env` file with the variable names required by your configuration.

Typical variables include:

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=your_postgresql_connection_string
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Never commit real credentials or `.env` files to GitHub.

### 5. Start the backend

From the backend directory:

```bash
npm run dev
```

### 6. Start the frontend

Open a second terminal:

```bash
cd proxispeak_starter
npm run dev
```

Open the local URL provided by Vite, usually `http://localhost:5173`.

## 🧠 Skills Practiced

- React component development
- JavaScript and state management
- Responsive UI design
- REST API integration
- Node.js and Express fundamentals
- PostgreSQL queries and database integration
- Audio upload and media handling
- Cloudinary integration
- Browser geolocation and local storage
- Debugging and AI-assisted development
- Git and GitHub workflows

## 🔒 Current Limitations

- Likes and bookmarks are browser-specific and are not synchronized across devices.
- User authentication and post ownership controls are not implemented.
- Comments and reports require appropriate moderation and spam protection before public deployment.
- Production deployment, automated tests, and security hardening may still be required.
- Location-based discovery depends on the backend query and available post coordinates.

## 🙌 Acknowledgements

AI tools were used as development assistance, particularly for backend implementation and debugging. The frontend was developed by me, with hands-on integration and testing throughout the project.

---

**ProxiSpeak — Every place has a story. Listen to it.** 🎧
