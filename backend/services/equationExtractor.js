import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract frames from video file
 */
export async function extractFrames(videoPath, outputFolder, options = {}) {
  const {
    interval = 5,
    method = 'interval',
    maxFrames = 50
  } = options;

  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'frame_extractor.py');
    const args = ['-3.10', pythonScript, videoPath, outputFolder, interval.toString(), method];

    console.log(`Extracting frames from video: ${videoPath}`);
    console.log(`Output folder: ${outputFolder}`);
    console.log(`Method: ${method}, Interval: ${interval}s`);

    const pythonProcess = spawn('py', args);
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.log('Frame extraction:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Frame extraction error:', errorData);
        reject(new Error(`Frame extraction failed: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse frame extraction result: ${error.message}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

/**
 * Extract equations from images using OCR
 */
export async function extractEquations(inputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'equation_ocr.py');
    const args = ['-3.10', pythonScript, inputPath];

    console.log(`Extracting equations from: ${inputPath}`);

    const pythonProcess = spawn('py', args);
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.log('Equation OCR:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Equation extraction error:', errorData);
        reject(new Error(`Equation extraction failed: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse equation extraction result: ${error.message}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

/**
 * Merge equations with transcript
 */
export async function mergeEquationsWithTranscript(equationsData, transcriptData, options = {}) {
  const { timeWindow = 10 } = options;

  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'equation_transcript_merger.py');
    
    // Create temporary files for data
    const tempDir = path.join(__dirname, 'temp');
    const equationsFile = path.join(tempDir, `equations_${Date.now()}.json`);
    const transcriptFile = path.join(tempDir, `transcript_${Date.now()}.json`);

    // Ensure temp directory exists
    fs.mkdir(tempDir, { recursive: true })
      .then(() => {
        // Write data to temp files
        return Promise.all([
          fs.writeFile(equationsFile, JSON.stringify(equationsData)),
          fs.writeFile(transcriptFile, JSON.stringify(transcriptData))
        ]);
      })
      .then(() => {
        const args = ['-3.10', pythonScript, equationsFile, transcriptFile, 'json'];

        console.log('Merging equations with transcript...');

        const pythonProcess = spawn('py', args);
        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
          outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorData += data.toString();
          console.log('Merger:', data.toString());
        });

        pythonProcess.on('close', async (code) => {
          // Clean up temp files
          try {
            await fs.unlink(equationsFile);
            await fs.unlink(transcriptFile);
          } catch (err) {
            console.error('Failed to clean up temp files:', err);
          }

          if (code !== 0) {
            console.error('Merge error:', errorData);
            reject(new Error(`Merge failed: ${errorData}`));
            return;
          }

          try {
            const result = JSON.parse(outputData);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse merge result: ${error.message}`));
          }
        });

        pythonProcess.on('error', async (error) => {
          // Clean up temp files on error
          try {
            await fs.unlink(equationsFile);
            await fs.unlink(transcriptFile);
          } catch (err) {
            // Ignore cleanup errors
          }
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });
      })
      .catch(reject);
  });
}

/**
 * Complete pipeline: Extract frames and equations from video
 */
export async function extractEquationsFromVideo(videoPath, options = {}) {
  const {
    interval = 5,
    method = 'interval',
    outputFolder = path.join(__dirname, 'temp', `frames_${Date.now()}`),
    cleanupFrames = true
  } = options;

  try {
    console.log('Starting equation extraction pipeline...');

    // Step 1: Extract frames
    console.log('Step 1: Extracting frames...');
    const frameResult = await extractFrames(videoPath, outputFolder, { interval, method });

    if (!frameResult.success) {
      throw new Error(`Frame extraction failed: ${frameResult.error}`);
    }

    console.log(`Extracted ${frameResult.frames_extracted} frames`);

    // Step 2: Extract equations from frames
    console.log('Step 2: Extracting equations from frames...');
    const equationResult = await extractEquations(outputFolder);

    if (!equationResult.success) {
      throw new Error(`Equation extraction failed: ${equationResult.error}`);
    }

    console.log(`Found ${equationResult.total_equations} equations`);

    // Combine results
    const combinedResult = {
      success: true,
      video_path: videoPath,
      frames_extracted: frameResult.frames_extracted,
      equations_found: equationResult.total_equations,
      video_duration: frameResult.video_duration,
      frames: frameResult.frames,
      equations: equationResult.results,
      output_folder: outputFolder
    };

    // Step 3: Cleanup frames if requested
    if (cleanupFrames) {
      console.log('Cleaning up extracted frames...');
      try {
        await fs.rm(outputFolder, { recursive: true, force: true });
        console.log('Frames cleaned up successfully');
      } catch (err) {
        console.error('Failed to cleanup frames:', err);
      }
    }

    return combinedResult;

  } catch (error) {
    console.error('Equation extraction pipeline error:', error);
    throw error;
  }
}
