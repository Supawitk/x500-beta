import { spawn } from "child_process";
import { resolve } from "path";

const SCRIPTS_DIR = resolve(import.meta.dir, "../r-scripts");
const TIMEOUT_MS = 30_000;

export async function runRScript(
  scriptName: string,
  input: unknown
): Promise<any> {
  const scriptPath = resolve(SCRIPTS_DIR, scriptName);

  return new Promise((resolveP, reject) => {
    const proc = spawn("Rscript", ["--vanilla", scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        const msg = stderr.includes("there is no package")
          ? "R package not installed. Run the setup script."
          : stderr.slice(0, 200) || `R exited with code ${code}`;
        reject(new Error(msg));
        return;
      }
      try {
        resolveP(JSON.parse(stdout));
      } catch {
        reject(new Error("Failed to parse R output"));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`R not available: ${err.message}`));
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}
