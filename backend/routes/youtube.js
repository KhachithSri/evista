import express from "express";
import fetch from "node-fetch";
import { parseDuration } from "../utils/helpers.js";

const router = express.Router();

// Comprehensive list of famous educational YouTube channels
const EDUCATIONAL_CHANNELS = [
  // Science & Technology
  "Veritasium", "Vsauce", "Kurzgesagt – In a Nutshell", "MinutePhysics", 
  "SmarterEveryDay", "Physics Girl", "Mark Rober", "Numberphile",
  "3Blue1Brown", "Computerphile", "Tom Scott", "Real Engineering",
  "Practical Engineering", "ElectroBOOM", "The Action Lab", "NileRed",
  "Cody'sLab", "Applied Science", "Steve Mould", "Sixty Symbols",
  
  // Basic Science & Fundamentals
  "Bozeman Science", "Amoeba Sisters", "Science Simplified",
  "It's AumSum Time", "Peekaboo Kidz", "Happy Learning English",
  "Free School", "Homeschool Pop", "Smile and Learn - English",
  "The Science Classroom", "Moomoomath and Science", "Science Max",
  
  // Mathematics
  "Khan Academy", "Mathologer", "Numberphile", "3Blue1Brown",
  "Eddie Woo", "blackpenredpen", "The Organic Chemistry Tutor",
  "Professor Leonard", "PatrickJMT", "Math Antics",
  "Mashup Math", "Tecmath", "MathAntics", "Math Meeting",
  
  // Computer Science & Programming
  "freeCodeCamp.org", "CS Dojo", "Traversy Media", "The Net Ninja",
  "Programming with Mosh", "Fireship", "Web Dev Simplified",
  "Academind", "The Coding Train", "Corey Schafer", "Tech With Tim",
  
  // History & Social Sciences
  "CrashCourse", "OverSimplified", "History Matters", "The Great War",
  "Kings and Generals", "Epic History TV", "History Buffs",
  "Biographics", "Geographics", "Timeline - World History Documentaries",
  
  // Biology & Life Sciences
  "Kurzgesagt – In a Nutshell", "CrashCourse", "Osmosis", 
  "Armando Hasudungan", "Ninja Nerd", "Khan Academy",
  "Professor Dave Explains", "Medicosis Perfectionalis",
  "Amoeba Sisters", "Bozeman Science", "Biology Online",
  
  // Botany & Plant Science
  "Plant Abundance", "Crime Pays But Botany Doesn't", 
  "Botany One", "The Botanical Explorer", "Plant Science",
  "In Defense of Plants", "Botany with Dr. Caruso",
  
  // Plant Physiology & Agriculture
  "Agricultural Sciences", "Plant Cell Biology", "Crop Physiology",
  "The Plant Cell", "Botany Lectures", "Plant Molecular Biology",
  "Agriculture & Farming", "Plant Pathology", "Horticulture Studies",
  
  // Chemistry
  "NileRed", "The Organic Chemistry Tutor", "Professor Dave Explains",
  "Tyler DeWitt", "Crash Course", "Khan Academy",
  "Melissa Maribel", "The Chemistry Solution", "Conquer Chemistry",
  
  // Physics - Basic to Advanced
  "Khan Academy", "Physics Wallah", "Michel van Biezen",
  "Doc Schuster", "For the Love of Physics", "Physics Online",
  "The Science Asylum", "Domain of Science",
  
  // Engineering
  "Real Engineering", "Practical Engineering", "Lesics",
  "Engineering Explained", "Branch Education", "The Efficient Engineer",
  
  // Economics & Business
  "Economics Explained", "The Plain Bagel", "Two Cents",
  "ColdFusion", "Wendover Productions", "PolyMatter",
  
  // Language Learning
  "Easy Languages", "Learn English with EnglishClass101.com",
  "SpanishDict", "FrenchPod101", "JapanesePod101",
  
  // Philosophy & Critical Thinking
  "CrashCourse", "The School of Life", "Wireless Philosophy",
  "Academy of Ideas", "Philosophy Tube",
  
  // General Education & Kids Learning
  "TED", "TED-Ed", "TEDx Talks", "National Geographic", "Smithsonian Channel",
  "BBC Earth", "Discovery", "SciShow", "Vox", "AsapSCIENCE",
  "CGP Grey", "It's Okay To Be Smart", "Seeker",
  "Simple Learning Pro", "Learning Junction", "Kids Academy",
  
  // Basic Education for All Ages
  "Crash Course Kids", "SciShow Kids", "National Geographic Kids",
  "Free School", "Homeschool Pop", "Khan Academy Kids",
  "Simple History", "Easy Science", "Learn Bright",
  
  // Environmental Science & Ecology
  "Our Changing Climate", "ClimateAdam", "Hot Mess",
  "Conservation International", "World Wildlife Fund",
  "The Nature Conservancy", "Ecology and Environment",
  
  // Geology & Earth Science
  "IRIS Earthquake Science", "Geology Hub", "GEO GIRL",
  "Nick Zentner", "Earth Science", "Geoscience Videos",
  
  // Space & Astronomy
  "NASA", "European Space Agency, ESA", "Scott Manley",
  "Fraser Cain", "Dr. Becky", "Cool Worlds", "Launch Pad Astronomy",
  
  // Art & Design
  "Proko", "Draw with Jazza", "The Art Assignment",
  "Blender Guru", "Ctrl+Paint",
  
  // Music Theory
  "Adam Neely", "12tone", "Rick Beato", "David Bennett Piano",
  "8-bit Music Theory", "Signals Music Studio",
  
  // Medical & Health Education
  "Osmosis", "Armando Hasudungan", "Dr. Najeeb Lectures",
  "Ninja Nerd", "Lecturio Medical", "OnlineMedEd",
  "Physeo", "Dirty Medicine", "Med School Insiders"
];


router.get("/", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(
      query
    )}&key=${process.env.YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("YouTube API Error:", data.error);
      return res.status(500).json({ error: data.error.message, items: [] });
    }

    // Filter results to only include videos from educational channels
    const allItems = (data.items || []).map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
      description: item.snippet.description || '',
    }));

    const filteredItems = allItems.filter((item) => 
      EDUCATIONAL_CHANNELS.some(channel => 
        item.channelTitle.toLowerCase().includes(channel.toLowerCase()) ||
        channel.toLowerCase().includes(item.channelTitle.toLowerCase())
      )
    );

    console.log(`YouTube API returned ${allItems.length} results, filtered to ${filteredItems.length} educational channel results for query: "${query}"`);
    
    // Fetch video details including duration for filtered items
    let itemsWithDuration = filteredItems;
    if (filteredItems.length > 0) {
      const videoIds = filteredItems.map(item => item.id).join(',');
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`;
      
      try {
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.items) {
          const durationMap = {};
          detailsData.items.forEach(video => {
            durationMap[video.id] = parseDuration(video.contentDetails.duration);
          });
          
          itemsWithDuration = filteredItems.map(item => ({
            ...item,
            duration: durationMap[item.id] || ''
          }));
        }
      } catch (err) {
        console.error("Error fetching video details:", err);
        // Continue without duration if details fetch fails
      }
    }
    
    // Return filtered items with channel name and duration
    const items = itemsWithDuration.map(item => ({
      id: item.id,
      title: `${item.title} [${item.channelTitle}]`,
      url: item.url,
      thumbnail: item.thumbnail,
      description: item.description,
      timestamp: item.duration || '',
    }));

    res.json({ items });
  } catch (err) {
    console.error("YouTube API Error:", err);
    res.status(500).json({ error: "YouTube API error", items: [] });
  }
});

export default router;
