import fs from "fs";
import path from "path";

const TEMP_DIR = path.join(process.cwd(), "temp");

export function ensureTempDirectory() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

export function clearTempDirectory(sessionId = "system") {
  try {
    ensureTempDirectory();

    for (const entry of fs.readdirSync(TEMP_DIR)) {
      const entryPath = path.join(TEMP_DIR, entry);
      fs.rmSync(entryPath, { recursive: true, force: true });
    }

    console.log(`[${sessionId}] Cleared temp directory before new search`);
  } catch (err) {
    console.error(`[${sessionId}] Failed to clear temp directory:`, err);
  }
}

export { TEMP_DIR };
