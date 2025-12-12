#!/usr/bin/env python3
"""
Simple Whisper Service - GPU Accelerated Transcription
"""
import sys
import json
from faster_whisper import WhisperModel
import os
from pathlib import Path

# Model cache directory
MODEL_DIR = Path(__file__).parent / "whisper_models"
MODEL_DIR.mkdir(exist_ok=True)

def detect_device():
    """Detect available hardware acceleration"""
    try:
        import torch
        
        # Check for CUDA (NVIDIA GPU)
        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"  # Use float16 for faster computation on GPU
            device_name = f"CUDA ({torch.cuda.get_device_name(0)})"
            print(json.dumps({
                "status": "info",
                "message": f"GPU detected: {device_name}"
            }), flush=True)
            return device, compute_type
        
        # Check for MPS (Apple Silicon)
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            device = "mps"
            compute_type = "float16"
            device_name = "Apple Metal Performance Shaders (MPS)"
            print(json.dumps({
                "status": "info",
                "message": f"GPU detected: {device_name}"
            }), flush=True)
            return device, compute_type
        
        # Fallback to CPU with int8 quantization
        else:
            device = "cpu"
            compute_type = "int8"
            print(json.dumps({
                "status": "info",
                "message": "No GPU detected. Using CPU with int8 quantization."
            }), flush=True)
            return device, compute_type
            
    except Exception as e:
        print(json.dumps({
            "status": "warning",
            "message": f"Could not detect GPU: {str(e)}. Falling back to CPU."
        }), flush=True)
        return "cpu", "int8"

def load_model():
    """Load Whisper model with GPU acceleration if available"""
    print(json.dumps({"status": "loading", "message": "Detecting hardware acceleration..."}), flush=True)
    
    device, compute_type = detect_device()
    
    print(json.dumps({
        "status": "loading",
        "message": f"Loading Whisper model on {device} with {compute_type}..."
    }), flush=True)
    
    try:
        # Use base model for GPU with limited VRAM (RTX 3050, etc.)
        # Large model requires 10GB+ VRAM, base requires ~2GB
        model = WhisperModel(
            "base",  # Use base model for better GPU compatibility
            device=device,
            compute_type=compute_type,
            download_root=str(MODEL_DIR),
            num_workers=2,  # Reduce workers for lower memory usage
            cpu_threads=4   # Reduce CPU threads for lower memory usage
        )
        print(json.dumps({
            "status": "ready",
            "message": f"Model loaded successfully on {device} ({compute_type})"
        }), flush=True)
        return model
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Failed to load model: {str(e)}"}), flush=True)
        sys.exit(1)

def transcribe_audio(audio_path, model, language="english"):
    """Transcribe audio file with minimal configuration"""
    
    # ONLY allow these 5 languages - reject all others
    SUPPORTED_LANGUAGES = {
        'tamil': 'ta',
        'telugu': 'te',
        'kannada': 'kn',
        'hindi': 'hi',
        'english': 'en'
    }
    
    # Validate language is supported
    if language.lower() not in SUPPORTED_LANGUAGES:
        error_msg = f"Unsupported language: '{language}'. Only Tamil, Telugu, Kannada, Hindi, and English are supported."
        print(json.dumps({"status": "error", "message": error_msg}), flush=True)
        raise ValueError(error_msg)
    
    whisper_lang = SUPPORTED_LANGUAGES[language.lower()]
    print(json.dumps({"status": "transcribing", "message": f"Transcribing audio in {language}..."}), flush=True)
    
    try:
        # GPU-optimized transcription - balanced speed and accuracy
        # CRITICAL: Force language detection to use specified language, not auto-detect
        segments, info = model.transcribe(
            audio_path,
            language=whisper_lang,  # Force this language - do NOT auto-detect
            beam_size=5,  # Balance between speed and accuracy (GPU can handle this)
            vad_filter=True,  # Skip silence - 2x faster
            vad_parameters=dict(min_silence_duration_ms=500),
            word_timestamps=False,
            condition_on_previous_text=False,
            temperature=0.0,  # Deterministic output
            best_of=1,  # Use single pass (GPU optimized)
            patience=1.0,  # Early stopping for faster inference
            length_penalty=1.0,  # No length penalty
            initial_prompt=f"This audio is in {language}. Transcribe it in {language}."  # Force language context
        )
        
        # Collect all segments
        transcript_text = ""
        total_duration = info.duration
        segment_count = 0
        
        print(json.dumps({
            "status": "info",
            "message": f"Audio duration: {total_duration:.2f} seconds"
        }), flush=True)
        
        for segment in segments:
            transcript_text += segment.text + " "
            segment_count += 1
            
            # Calculate progress
            if total_duration > 0:
                progress = int((segment.end / total_duration) * 100)
                print(json.dumps({
                    "status": "progress",
                    "message": f"Processing: {progress}% complete",
                    "percent": progress
                }), flush=True)
        
        print(json.dumps({
            "status": "info",
            "message": f"Processed {segment_count} segments"
        }), flush=True)
        
        if not transcript_text.strip():
            print(json.dumps({
                "status": "warning",
                "message": "No speech detected in audio. The video might be silent or in a different language."
            }), flush=True)
        
        return transcript_text.strip()
        
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Transcription failed: {str(e)}"}), flush=True)
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No audio file provided"}), flush=True)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "english"
    
    if not os.path.exists(audio_path):
        print(json.dumps({"status": "error", "message": f"Audio file not found: {audio_path}"}), flush=True)
        sys.exit(1)
    
    # Load model
    model = load_model()
    
    # Transcribe with specified language
    transcript = transcribe_audio(audio_path, model, language)
    
    # Output final result
    print(json.dumps({
        "status": "complete",
        "transcript": transcript if transcript else "No speech detected in the audio."
    }), flush=True)

if __name__ == "__main__":
    main()
