"""
Frame Extraction Service
Extracts frames from video files at specified intervals
"""
import cv2
import os
import sys
import json
from pathlib import Path

def extract_frames_smart(video_path, output_folder, num_frames=10, min_gap_seconds=10):
    """Extract a small number of frames, evenly distributed across the video.

    This is used for "smart" visual analysis: a limited set of
    representative frames are sampled over the full duration of the
    video, with an upper bound on how many frames are returned.

    Args:
        video_path: Path to video file
        output_folder: Directory to save extracted frames
        num_frames: Maximum number of frames to extract (default: 10)
        min_gap_seconds: Minimum time gap between frames in seconds (best-effort)

    Returns:
        dict: Information about extracted frames
    """
    try:
        # Create output folder if it doesn't exist
        os.makedirs(output_folder, exist_ok=True)

        # Open video file
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            return {
                "success": False,
                "error": "Failed to open video file",
                "frames_extracted": 0
            }

        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        if total_frames == 0 or fps == 0 or duration <= 0:
            return {
                "success": False,
                "error": "Invalid video file (no frames, fps, or duration)",
                "frames_extracted": 0
            }

        # Respect the minimum gap as an upper bound on how many frames
        # we can reasonably sample.
        if min_gap_seconds > 0:
            max_by_gap = max(1, int(duration // min_gap_seconds) + 1)
        else:
            max_by_gap = num_frames

        target_frames = max(1, min(num_frames, max_by_gap))

        # Compute evenly spaced timestamps across the video, avoiding
        # the very beginning and very end by using N+1 segments and
        # sampling the internal points.
        timestamps = []
        if target_frames == 1:
            timestamps = [duration / 2.0]
        else:
            segment = duration / float(target_frames + 1)
            for i in range(1, target_frames + 1):
                timestamps.append(segment * i)

        frame_positions = []
        for t in timestamps:
            frame_idx = int(t * fps)
            frame_idx = max(0, min(frame_idx, total_frames - 1))
            frame_positions.append(frame_idx)

        # Remove any accidental duplicates while preserving order
        seen = set()
        unique_positions = []
        for pos in frame_positions:
            if pos not in seen:
                seen.add(pos)
                unique_positions.append(pos)

        frame_positions = unique_positions

        print(f"Video FPS: {fps}", file=sys.stderr)
        print(f"Total frames: {total_frames}", file=sys.stderr)
        print(f"Duration: {duration:.2f} seconds", file=sys.stderr)
        print(f"Smart frame extraction - requested: {num_frames}, using: {len(frame_positions)}", file=sys.stderr)
        print(f"Minimum gap (seconds): {min_gap_seconds}", file=sys.stderr)
        print(f"Frame positions (indices): {frame_positions}", file=sys.stderr)

        saved = 0
        frame_info = []

        for idx, target_frame in enumerate(frame_positions):
            # Seek to target frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            ret, frame = cap.read()

            if not ret:
                print(f"Failed to read frame at position {target_frame}", file=sys.stderr)
                continue

            timestamp = target_frame / fps
            frame_name = f"frame_{saved:04d}.jpg"
            frame_path = os.path.join(output_folder, frame_name)

            cv2.imwrite(frame_path, frame)

            frame_info.append({
                "frame_number": saved,
                "timestamp": timestamp,
                "filename": frame_name,
                "path": frame_path,
                "video_position": target_frame
            })

            print(f"Saved frame {saved} at {timestamp:.2f}s (position {target_frame}/{total_frames})", file=sys.stderr)
            saved += 1

        cap.release()

        return {
            "success": True,
            "frames_extracted": saved,
            "video_duration": duration,
            "fps": fps,
            "total_video_frames": total_frames,
            "method": "smart_even_distribution",
            "num_frames_requested": num_frames,
            "min_gap_seconds": min_gap_seconds,
            "output_folder": output_folder,
            "frames": frame_info
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "frames_extracted": 0
        }

def extract_frames(video_path, output_folder, interval=3, max_frames=50):
    """
    Extract frames from video at regular intervals
    
    Args:
        video_path: Path to video file
        output_folder: Directory to save extracted frames
        interval: Time interval in seconds between frames
        max_frames: Maximum number of frames to extract
    
    Returns:
        dict: Information about extracted frames
    """
    try:
        # Create output folder if it doesn't exist
        os.makedirs(output_folder, exist_ok=True)
        
        # Open video file
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return {
                "success": False,
                "error": "Failed to open video file",
                "frames_extracted": 0
            }
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        frame_interval = fps * interval
        count = 0
        saved = 0
        frame_info = []
        
        print(f"Video FPS: {fps}", file=sys.stderr)
        print(f"Total frames: {total_frames}", file=sys.stderr)
        print(f"Duration: {duration:.2f} seconds", file=sys.stderr)
        print(f"Extracting frames every {interval} seconds...", file=sys.stderr)
        
        while cap.isOpened() and saved < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Save frame at specified interval
            if count % frame_interval == 0:
                timestamp = count / fps
                frame_name = f"frame_{saved:04d}.jpg"
                frame_path = os.path.join(output_folder, frame_name)
                
                cv2.imwrite(frame_path, frame)
                
                frame_info.append({
                    "frame_number": saved,
                    "timestamp": timestamp,
                    "filename": frame_name,
                    "path": frame_path
                })
                
                print(f"Saved frame {saved} at {timestamp:.2f}s", file=sys.stderr)
                saved += 1
            
            count += 1
        
        cap.release()
        
        return {
            "success": True,
            "frames_extracted": saved,
            "video_duration": duration,
            "fps": fps,
            "interval": interval,
            "output_folder": output_folder,
            "frames": frame_info
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "frames_extracted": 0
        }

def extract_frames_with_scene_detection(video_path, output_folder, threshold=30.0, max_frames=50):
    """
    Extract frames based on scene changes (more intelligent extraction)
    
    Args:
        video_path: Path to video file
        output_folder: Directory to save extracted frames
        threshold: Scene change threshold (higher = less sensitive)
        max_frames: Maximum number of frames to extract
    
    Returns:
        dict: Information about extracted frames
    """
    try:
        os.makedirs(output_folder, exist_ok=True)
        
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return {
                "success": False,
                "error": "Failed to open video file",
                "frames_extracted": 0
            }
        
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        
        ret, prev_frame = cap.read()
        if not ret:
            return {
                "success": False,
                "error": "Failed to read first frame",
                "frames_extracted": 0
            }
        
        prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        
        count = 1
        saved = 0
        frame_info = []
        
        # Save first frame
        frame_name = f"frame_{saved:04d}.jpg"
        frame_path = os.path.join(output_folder, frame_name)
        cv2.imwrite(frame_path, prev_frame)
        frame_info.append({
            "frame_number": saved,
            "timestamp": 0.0,
            "filename": frame_name,
            "path": frame_path,
            "scene_change": True
        })
        saved += 1
        
        print(f"Detecting scene changes (threshold: {threshold})...", file=sys.stderr)
        
        while cap.isOpened() and saved < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Convert to grayscale for comparison
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Calculate frame difference
            frame_diff = cv2.absdiff(prev_gray, gray)
            mean_diff = frame_diff.mean()
            
            # If significant change detected, save frame
            if mean_diff > threshold:
                timestamp = count / fps
                frame_name = f"frame_{saved:04d}.jpg"
                frame_path = os.path.join(output_folder, frame_name)
                
                cv2.imwrite(frame_path, frame)
                
                frame_info.append({
                    "frame_number": saved,
                    "timestamp": timestamp,
                    "filename": frame_name,
                    "path": frame_path,
                    "scene_change": True,
                    "diff_score": float(mean_diff)
                })
                
                print(f"Scene change detected at {timestamp:.2f}s (diff: {mean_diff:.2f})", file=sys.stderr)
                saved += 1
                prev_gray = gray
            
            count += 1
        
        cap.release()
        
        return {
            "success": True,
            "frames_extracted": saved,
            "video_duration": duration,
            "fps": fps,
            "method": "scene_detection",
            "threshold": threshold,
            "output_folder": output_folder,
            "frames": frame_info
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "frames_extracted": 0
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python frame_extractor.py <video_path> <output_folder> [num_frames/interval] [method] [min_gap_seconds]"
        }))
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_folder = sys.argv[2]
    param = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    method = sys.argv[4] if len(sys.argv) > 4 else "smart"
    min_gap_seconds = int(sys.argv[5]) if len(sys.argv) > 5 else 10
    
    if method == "smart":
        result = extract_frames_smart(video_path, output_folder, param, min_gap_seconds)
    elif method == "scene":
        result = extract_frames_with_scene_detection(video_path, output_folder)
    else:
        # interval method
        result = extract_frames(video_path, output_folder, param)
    
    print(json.dumps(result))
