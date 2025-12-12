"""
Equation OCR Service
Extracts mathematical equations from images and converts to LaTeX
"""
import os
import sys
import json
from pathlib import Path
from PIL import Image

# Try to import pix2tex, fallback to basic OCR if not available
try:
    from pix2tex.cli import LatexOCR
    PIX2TEX_AVAILABLE = True
except ImportError:
    PIX2TEX_AVAILABLE = False
    print("Warning: pix2tex not installed. Install with: pip install pix2tex", file=sys.stderr)

# Fallback to pytesseract for basic text detection
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False
    print("Warning: pytesseract not installed. Install with: pip install pytesseract", file=sys.stderr)

class EquationExtractor:
    """Extract mathematical equations from images"""
    
    def __init__(self):
        self.latex_model = None
        if PIX2TEX_AVAILABLE:
            try:
                print("Initializing LaTeX OCR model...", file=sys.stderr)
                self.latex_model = LatexOCR()
                print("LaTeX OCR model loaded successfully", file=sys.stderr)
            except Exception as e:
                print(f"Failed to load LaTeX OCR model: {e}", file=sys.stderr)
                self.latex_model = None
    
    def extract_from_image(self, image_path):
        """
        Extract equations from a single image
        
        Args:
            image_path: Path to image file
        
        Returns:
            dict: Extracted equation information
        """
        try:
            img = Image.open(image_path)
            
            result = {
                "image": image_path,
                "success": True,
                "equations": []
            }
            
            # Try LaTeX OCR first (best for equations)
            if self.latex_model:
                try:
                    latex_code = self.latex_model(img)
                    if latex_code and latex_code.strip():
                        result["equations"].append({
                            "latex": latex_code,
                            "method": "pix2tex",
                            "confidence": "high"
                        })
                        print(f"Extracted LaTeX: {latex_code}", file=sys.stderr)
                except Exception as e:
                    print(f"LaTeX OCR failed: {e}", file=sys.stderr)
            
            # Fallback to basic text OCR
            if not result["equations"] and PYTESSERACT_AVAILABLE:
                try:
                    text = pytesseract.image_to_string(img)
                    if text and text.strip():
                        result["equations"].append({
                            "text": text.strip(),
                            "method": "pytesseract",
                            "confidence": "medium"
                        })
                        print(f"Extracted text: {text.strip()[:100]}", file=sys.stderr)
                except Exception as e:
                    print(f"Text OCR failed: {e}", file=sys.stderr)
            
            if not result["equations"]:
                result["success"] = False
                result["error"] = "No equations detected"
            
            return result
            
        except Exception as e:
            return {
                "image": image_path,
                "success": False,
                "error": str(e),
                "equations": []
            }
    
    def extract_from_folder(self, folder_path, file_pattern="*.jpg"):
        """
        Extract equations from all images in a folder
        
        Args:
            folder_path: Path to folder containing images
            file_pattern: File pattern to match (default: *.jpg)
        
        Returns:
            dict: Results for all images
        """
        try:
            folder = Path(folder_path)
            image_files = sorted(folder.glob(file_pattern))
            
            if not image_files:
                return {
                    "success": False,
                    "error": f"No images found matching {file_pattern}",
                    "results": []
                }
            
            results = []
            total_equations = 0
            
            print(f"Processing {len(image_files)} images...", file=sys.stderr)
            
            for i, img_path in enumerate(image_files):
                print(f"Processing {i+1}/{len(image_files)}: {img_path.name}", file=sys.stderr)
                result = self.extract_from_image(str(img_path))
                results.append(result)
                
                if result["success"]:
                    total_equations += len(result["equations"])
            
            return {
                "success": True,
                "folder": folder_path,
                "images_processed": len(image_files),
                "total_equations": total_equations,
                "results": results
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "results": []
            }

def detect_equation_regions(image_path):
    """
    Detect regions in image that likely contain equations
    Uses basic image processing to find text/equation regions
    
    Args:
        image_path: Path to image file
    
    Returns:
        list: Bounding boxes of detected regions
    """
    try:
        import cv2
        import numpy as np
        
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply threshold to get binary image
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        regions = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            # Filter small regions
            if w > 50 and h > 20:
                regions.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h)
                })
        
        return regions
        
    except Exception as e:
        print(f"Region detection failed: {e}", file=sys.stderr)
        return []

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python equation_ocr.py <image_path_or_folder> [mode]"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "auto"
    
    extractor = EquationExtractor()
    
    # Check if input is a file or folder
    path = Path(input_path)
    
    if path.is_file():
        result = extractor.extract_from_image(input_path)
    elif path.is_dir():
        result = extractor.extract_from_folder(input_path)
    else:
        result = {
            "success": False,
            "error": f"Path not found: {input_path}"
        }
    
    print(json.dumps(result, indent=2))
