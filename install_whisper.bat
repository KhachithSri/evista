@echo off
echo ========================================
echo Installing Whisper Dependencies
echo ========================================
echo.

echo Checking Python installation...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)
echo.

echo Installing Python packages...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python packages
    pause
    exit /b 1
)
echo.

echo Checking yt-dlp installation...
yt-dlp --version
if %errorlevel% neq 0 (
    echo yt-dlp not found. Installing...
    pip install yt-dlp
)
echo.

echo Checking FFmpeg installation...
ffmpeg -version
if %errorlevel% neq 0 (
    echo WARNING: FFmpeg is not installed or not in PATH
    echo Please install FFmpeg from https://ffmpeg.org/
    echo Or use chocolatey: choco install ffmpeg
    pause
)
echo.

echo ========================================
echo Downloading Whisper Model
echo ========================================
echo.
echo This will download the Whisper large model (~3GB)
echo This is a ONE-TIME download that takes 10-30 minutes
echo.
set /p DOWNLOAD_NOW="Download now? (Y/n): "
if /i "%DOWNLOAD_NOW%"=="n" goto skip_download

echo.
echo Starting download... Please be patient.
echo.
python download_whisper_model.py large
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Model download failed or was cancelled
    echo You can download it later by running:
    echo   cd backend
    echo   python download_whisper_model.py
    echo.
)

:skip_download
echo.

echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Start backend: cd backend ^&^& npm run dev
echo 2. Start frontend: cd frontend ^&^& npm run dev
echo 3. Open http://localhost:5173 in your browser
echo.
if /i "%DOWNLOAD_NOW%"=="n" (
    echo Note: First transcription will download the Whisper model (~3GB)
) else (
    echo Note: Whisper model is ready! Transcriptions will be fast.
)
echo.
pause
