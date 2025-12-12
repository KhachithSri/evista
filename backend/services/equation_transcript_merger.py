"""
Equation and Transcript Merger
Combines extracted equations with video transcripts
"""
import json
import sys
from pathlib import Path

def parse_timestamp(timestamp_str):
    """
    Convert timestamp string to seconds
    Supports formats: "00:03:12", "3:12", "192"
    """
    if isinstance(timestamp_str, (int, float)):
        return float(timestamp_str)
    
    parts = str(timestamp_str).split(':')
    
    if len(parts) == 3:  # HH:MM:SS
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    elif len(parts) == 2:  # MM:SS
        return int(parts[0]) * 60 + float(parts[1])
    else:  # Seconds
        return float(parts[0])

def format_timestamp(seconds):
    """Convert seconds to HH:MM:SS format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"

def merge_equations_with_transcript(equations_data, transcript_data, time_window=10):
    """
    Merge equations with transcript based on timestamps
    
    Args:
        equations_data: List of equation results with timestamps
        transcript_data: Transcript with timestamps (Whisper format or custom)
        time_window: Time window in seconds to match equations with speech
    
    Returns:
        dict: Merged timeline with equations and speech
    """
    try:
        merged_timeline = []
        
        # Process equations
        for eq_item in equations_data:
            if not eq_item.get("success"):
                continue
            
            timestamp = eq_item.get("timestamp", 0)
            equations = eq_item.get("equations", [])
            
            if not equations:
                continue
            
            # Find matching transcript segment
            matching_speech = find_matching_transcript(
                timestamp, 
                transcript_data, 
                time_window
            )
            
            for eq in equations:
                entry = {
                    "timestamp": timestamp,
                    "formatted_time": format_timestamp(timestamp),
                    "type": "equation",
                    "equation": eq.get("latex") or eq.get("text", ""),
                    "method": eq.get("method", "unknown"),
                    "confidence": eq.get("confidence", "unknown"),
                    "speech": matching_speech,
                    "frame": eq_item.get("frame_number")
                }
                merged_timeline.append(entry)
        
        # Add transcript-only segments
        if isinstance(transcript_data, list):
            for segment in transcript_data:
                timestamp = segment.get("start", segment.get("timestamp", 0))
                text = segment.get("text", "")
                
                # Check if this timestamp already has an equation
                has_equation = any(
                    abs(item["timestamp"] - timestamp) < 1 
                    for item in merged_timeline
                )
                
                if not has_equation and text.strip():
                    entry = {
                        "timestamp": timestamp,
                        "formatted_time": format_timestamp(timestamp),
                        "type": "speech",
                        "speech": text.strip(),
                        "equation": None
                    }
                    merged_timeline.append(entry)
        
        # Sort by timestamp
        merged_timeline.sort(key=lambda x: x["timestamp"])
        
        return {
            "success": True,
            "total_entries": len(merged_timeline),
            "timeline": merged_timeline
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timeline": []
        }

def find_matching_transcript(timestamp, transcript_data, time_window):
    """
    Find transcript segment that matches the given timestamp
    
    Args:
        timestamp: Time in seconds
        transcript_data: Transcript data
        time_window: Time window for matching
    
    Returns:
        str: Matching transcript text or empty string
    """
    if not transcript_data:
        return ""
    
    # Handle different transcript formats
    if isinstance(transcript_data, str):
        return transcript_data
    
    if isinstance(transcript_data, list):
        for segment in transcript_data:
            seg_start = segment.get("start", segment.get("timestamp", 0))
            seg_end = segment.get("end", seg_start + 5)
            
            # Check if timestamp falls within segment
            if seg_start - time_window <= timestamp <= seg_end + time_window:
                return segment.get("text", "")
    
    return ""

def generate_markdown_summary(merged_data, include_timestamps=True):
    """
    Generate a markdown summary from merged data
    
    Args:
        merged_data: Merged timeline data
        include_timestamps: Whether to include timestamps
    
    Returns:
        str: Markdown formatted summary
    """
    if not merged_data.get("success"):
        return "# Error\n\nFailed to generate summary."
    
    timeline = merged_data.get("timeline", [])
    
    markdown = "# Video Summary with Equations\n\n"
    markdown += f"**Total Entries:** {len(timeline)}\n\n"
    markdown += "---\n\n"
    
    for item in timeline:
        if include_timestamps:
            markdown += f"## 🕒 {item['formatted_time']}\n\n"
        
        if item.get("equation"):
            markdown += f"**Equation:** `{item['equation']}`\n\n"
            if item.get("speech"):
                markdown += f"**Context:** {item['speech']}\n\n"
        else:
            markdown += f"{item.get('speech', '')}\n\n"
        
        markdown += "---\n\n"
    
    return markdown

def generate_json_summary(merged_data):
    """
    Generate a structured JSON summary
    
    Args:
        merged_data: Merged timeline data
    
    Returns:
        dict: Structured summary
    """
    timeline = merged_data.get("timeline", [])
    
    equations = [
        {
            "time": item["formatted_time"],
            "equation": item["equation"],
            "context": item.get("speech", "")
        }
        for item in timeline if item.get("equation")
    ]
    
    transcript_segments = [
        {
            "time": item["formatted_time"],
            "text": item["speech"]
        }
        for item in timeline if item.get("speech") and not item.get("equation")
    ]
    
    return {
        "summary": {
            "total_equations": len(equations),
            "total_segments": len(timeline),
            "equations": equations,
            "transcript": transcript_segments
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python equation_transcript_merger.py <equations_json> <transcript_json> [output_format]"
        }))
        sys.exit(1)
    
    equations_file = sys.argv[1]
    transcript_file = sys.argv[2]
    output_format = sys.argv[3] if len(sys.argv) > 3 else "json"
    
    # Load data
    with open(equations_file, 'r') as f:
        equations_data = json.load(f)
    
    with open(transcript_file, 'r') as f:
        transcript_data = json.load(f)
    
    # Merge data
    merged = merge_equations_with_transcript(
        equations_data.get("results", []),
        transcript_data
    )
    
    # Output in requested format
    if output_format == "markdown":
        print(generate_markdown_summary(merged))
    else:
        print(json.dumps(merged, indent=2))
