import express from "express";
import fetch from "node-fetch";
import { parseDuration } from "../utils/helpers.js";

const router = express.Router();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * POST /api/search
 * Unified search endpoint for videos (YouTube only for now)
 */
router.post("/", async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter" });
  }

  try {
    console.log(`Searching for: ${query}`);
    
    // Enhanced search with educational keywords
    const educationalQuery = `${query} tutorial lecture course education`;
    
    // Search YouTube with educational focus
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(educationalQuery)}&type=video&maxResults=20&videoCategoryId=27&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(youtubeUrl);
    const data = await response.json();

    if (data.error) {
      console.error("YouTube API error:", data.error);
      return res.status(500).json({ 
        error: "YouTube API error", 
        details: data.error.message 
      });
    }

    // Get video IDs for duration lookup
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    
    // Fetch video details including duration
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    // Create a map of video durations
    const durationMap = {};
    detailsData.items?.forEach(item => {
      durationMap[item.id] = parseDuration(item.contentDetails.duration);
    });

    // Format results
    const videos = data.items.map(item => ({
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration: durationMap[item.id.videoId] || 'N/A',
      source: 'youtube'
    }));

    console.log(`Found ${videos.length} videos`);
    res.json({ videos });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ 
      error: "Failed to search videos", 
      details: error.message 
    });
  }
});


export default router;
