import { API_BASE_URL } from './config.js';

export async function searchVideos(query) {
  const sources = [
    fetch(`${API_BASE_URL}/youtube?q=${encodeURIComponent(query)}`).then(r => r.json()),
    fetch(`${API_BASE_URL}/vimeo?q=${encodeURIComponent(query)}`).then(r => r.json())
  ];

  const results = await Promise.allSettled(sources);

  return results.flatMap((res, idx) => 
    res.status === "fulfilled" && res.value.items
      ? res.value.items.map(item => ({
          id: item.id || item.videoId || Math.random().toString(36).slice(2),
          title: item.title || item.snippet?.title || "Untitled",
          url: item.url || `https://youtube.com/watch?v=${item.videoId}`,
          thumbnail: item.thumbnail || '',
          description: item.description || '',
          timestamp: item.timestamp || '',
          platform: idx === 0 ? "YouTube" : "Vimeo"
        }))
      : []
  );
}
