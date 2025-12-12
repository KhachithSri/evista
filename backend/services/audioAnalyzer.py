#!/usr/bin/env python3
"""
Audio Speech Detection Script
Analyzes audio files to detect if they contain speech content
"""

import sys
import json
import librosa
import numpy as np
from scipy import signal
import warnings
warnings.filterwarnings('ignore')

def analyze_audio_for_speech(audio_path):
    """
    Analyze audio file to detect speech content
    Returns confidence score and detection result
    """
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=16000, duration=30)  # Analyze first 30 seconds
        
        if len(y) == 0:
            return {
                "success": False,
                "has_speech": False,
                "confidence": 0.0,
                "error": "Empty audio file",
                "reasons": ["No audio data found"]
            }
        
        # Calculate various audio features
        features = {}
        
        # 1. Zero Crossing Rate (speech has moderate ZCR)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        features['zcr_mean'] = np.mean(zcr)
        features['zcr_std'] = np.std(zcr)
        
        # 2. Spectral Centroid (speech has characteristic frequency distribution)
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        features['spectral_centroid_mean'] = np.mean(spectral_centroids)
        
        # 3. MFCC features (speech-specific)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        features['mfcc_mean'] = np.mean(mfccs)
        features['mfcc_std'] = np.std(mfccs)
        
        # 4. RMS Energy (speech has variable energy)
        rms = librosa.feature.rms(y=y)[0]
        features['rms_mean'] = np.mean(rms)
        features['rms_std'] = np.std(rms)
        
        # 5. Spectral Rolloff
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        features['rolloff_mean'] = np.mean(rolloff)
        
        # Simple heuristic-based speech detection
        speech_indicators = []
        confidence_factors = []
        
        # Check ZCR (speech typically has moderate ZCR)
        if 0.01 < features['zcr_mean'] < 0.3:
            speech_indicators.append("moderate_zcr")
            confidence_factors.append(0.2)
        
        # Check spectral centroid (speech typically 1000-4000 Hz)
        if 1000 < features['spectral_centroid_mean'] < 4000:
            speech_indicators.append("speech_frequency_range")
            confidence_factors.append(0.25)
        
        # Check RMS energy variation (speech has variable energy)
        if features['rms_std'] > 0.01:
            speech_indicators.append("energy_variation")
            confidence_factors.append(0.2)
        
        # Check if audio has sufficient energy
        if features['rms_mean'] > 0.005:
            speech_indicators.append("sufficient_energy")
            confidence_factors.append(0.15)
        
        # Check MFCC characteristics
        if -20 < features['mfcc_mean'] < 20:
            speech_indicators.append("mfcc_speech_range")
            confidence_factors.append(0.2)
        
        # Calculate confidence
        confidence = sum(confidence_factors)
        has_speech = confidence > 0.5
        
        # Additional checks for music/noise
        reasons = speech_indicators.copy()
        
        # Very low ZCR might indicate music or silence
        if features['zcr_mean'] < 0.005:
            reasons.append("very_low_zcr_music_like")
            confidence *= 0.5
            
        # Very high spectral centroid might indicate noise
        if features['spectral_centroid_mean'] > 6000:
            reasons.append("high_frequency_noise_like")
            confidence *= 0.7
        
        # Very low energy indicates silence
        if features['rms_mean'] < 0.001:
            reasons.append("very_low_energy_silence")
            confidence = 0.1
            has_speech = False
        
        return {
            "success": True,
            "has_speech": has_speech,
            "confidence": min(confidence, 1.0),
            "reasons": reasons,
            "features": {
                "zcr_mean": float(features['zcr_mean']),
                "spectral_centroid_mean": float(features['spectral_centroid_mean']),
                "rms_mean": float(features['rms_mean']),
                "duration_analyzed": min(30, len(y) / sr)
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "has_speech": None,
            "confidence": 0.0,
            "error": str(e),
            "reasons": ["analysis_failed"]
        }

def main():
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python audioAnalyzer.py <audio_file_path>",
            "has_speech": None,
            "confidence": 0.0
        }))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    result = analyze_audio_for_speech(audio_path)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
