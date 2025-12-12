#!/usr/bin/env python3
"""
Pre-download Whisper model before first use
Run this script to download the model in advance
"""
import sys
import os
from pathlib import Path
import whisper

# Model cache directory
MODEL_DIR = Path(__file__).parent / "services" / "whisper_models"
MODEL_DIR.mkdir(exist_ok=True)

def download_model(model_name="large"):
    """Download Whisper model with progress indication"""
    
    print("=" * 70)
    print(f"WHISPER MODEL DOWNLOADER")
    print("=" * 70)
    print(f"\nModel: {model_name}")
    print(f"Target directory: {MODEL_DIR}")
    print("\nModel sizes:")
    print("  - tiny:   ~75 MB   (fastest, lowest accuracy)")
    print("  - base:   ~150 MB  (fast, basic accuracy)")
    print("  - small:  ~500 MB  (good speed, decent accuracy)")
    print("  - medium: ~1.5 GB  (slower, good accuracy)")
    print("  - large:  ~3 GB    (slowest, best accuracy) ⭐ RECOMMENDED")
    print("\n" + "=" * 70)
    
    # Check if model already exists
    existing_models = list(MODEL_DIR.glob(f"{model_name}*.pt"))
    if existing_models:
        model_file = existing_models[0]
        size_mb = model_file.stat().st_size / (1024 * 1024)
        size_gb = size_mb / 1024
        
        print(f"\n✓ Model already exists: {model_file.name}")
        print(f"  Size: {size_gb:.2f} GB ({size_mb:.1f} MB)")
        
        response = input("\nDo you want to re-download? (y/N): ").strip().lower()
        if response != 'y':
            print("\n✓ Using existing model. Download cancelled.")
            return True
        
        print("\nRe-downloading model...")
    
    print(f"\n⏳ Downloading Whisper '{model_name}' model...")
    print("This may take 5-30 minutes depending on your internet speed.")
    print("Please be patient...\n")
    
    try:
        # Set cache directory
        os.environ['WHISPER_CACHE_DIR'] = str(MODEL_DIR)
        
        # Download model (this will show progress bar)
        print(f"Loading model '{model_name}'...")
        model = whisper.load_model(model_name, download_root=str(MODEL_DIR))
        
        print("\n" + "=" * 70)
        print("✅ MODEL DOWNLOADED SUCCESSFULLY!")
        print("=" * 70)
        
        # Show model details
        print(f"\nModel Details:")
        print(f"  Device: {model.device}")
        print(f"  Type: {type(model).__name__}")
        
        # Show downloaded file
        downloaded_files = list(MODEL_DIR.glob(f"{model_name}*.pt"))
        if downloaded_files:
            for file in downloaded_files:
                size_mb = file.stat().st_size / (1024 * 1024)
                size_gb = size_mb / 1024
                print(f"\nDownloaded file:")
                print(f"  Name: {file.name}")
                print(f"  Size: {size_gb:.2f} GB ({size_mb:.1f} MB)")
                print(f"  Location: {file}")
        
        print("\n" + "=" * 70)
        print("🎉 READY TO USE!")
        print("=" * 70)
        print("\nYou can now:")
        print("  1. Start the backend server: npm run dev")
        print("  2. Use transcription without waiting for download")
        print("  3. Transcriptions will be fast (2-5 minutes per video)")
        print("\n" + "=" * 70)
        
        return True
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Download cancelled by user.")
        print("You can run this script again later to complete the download.")
        return False
        
    except Exception as e:
        print("\n" + "=" * 70)
        print("❌ ERROR DOWNLOADING MODEL")
        print("=" * 70)
        print(f"\nError: {e}")
        print("\nTroubleshooting:")
        print("  1. Check your internet connection")
        print("  2. Ensure you have enough disk space (~5 GB free)")
        print("  3. Try again later if server is busy")
        print("  4. Try a smaller model: python download_whisper_model.py medium")
        return False

def main():
    """Main function"""
    
    # Get model name from command line or use default
    model_name = "large"
    if len(sys.argv) > 1:
        model_name = sys.argv[1].lower()
        
        valid_models = ["tiny", "base", "small", "medium", "large"]
        if model_name not in valid_models:
            print(f"❌ Invalid model name: {model_name}")
            print(f"Valid options: {', '.join(valid_models)}")
            print(f"\nUsage: python download_whisper_model.py [model_name]")
            print(f"Example: python download_whisper_model.py large")
            sys.exit(1)
    
    success = download_model(model_name)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
