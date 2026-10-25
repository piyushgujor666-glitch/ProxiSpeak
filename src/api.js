
const API_BASE_URL = "http://localhost:5000/api";

// Fetch all audio posts from the backend
export async function getPosts() {
  const response = await fetch(`${API_BASE_URL}/posts`);

  if (!response.ok) {
    throw new Error("Failed to load posts");
  }

  const data = await response.json();
  return data.posts;
}

// Create a post using JSON metadata
export async function createPost(post) {
  const response = await fetch(`${API_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(post),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create post");
  }

  return data;
}

// Upload an audio file to Cloudinary through the backend
export async function uploadAudioPost(formData) {
  const response = await fetch(`${API_BASE_URL}/posts/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to upload audio");
  }

  return data;
}
