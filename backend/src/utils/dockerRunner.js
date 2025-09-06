const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const DOCKER_BIN = process.platform === "win32"
  ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
  : "docker";

/**
 * Run code inside Docker
 * @param {string} lang - "python" | "c"
 * @param {string} code - user code
 * @param {string} userId - unique user/session ID
 */
module.exports = function runCode(lang, code, userId = "anonymous") {
  return new Promise((resolve, reject) => {
    // ✅ user-isolated temp folder
    const uniqueDir = path.join("/app/tmp", userId, uuidv4());
    fs.mkdirSync(uniqueDir, { recursive: true });

    const filename = lang === "c" ? "code.c" : "code.py";
    const codeFile = path.join(uniqueDir, filename);
    fs.writeFileSync(codeFile, code, { encoding: "utf8" });
    fs.chmodSync(codeFile, 0o644);

    let runCmd;
    if (lang === "python") {
      runCmd = [
        "run", "--rm",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "-v", `${uniqueDir}:/tmp`,
        "codeguard-python",
        "python", "/tmp/code.py"
      ];
    } else if (lang === "c") {
      runCmd = [
        "run", "--rm",
        "--network", "none",
        "-m", "128m",
        "--cpus=0.5",
        "-v", `${uniqueDir}:/tmp`,
        "codeguard-c",
        "sh", "-c", "gcc /tmp/code.c -o /tmp/a.out && timeout 5 /tmp/a.out"
      ];
    }

    console.log("🔹 Running command:", DOCKER_BIN, runCmd.join(" "));

    const docker = spawn(DOCKER_BIN, runCmd, { shell: false });
    let stdout = "", stderr = "";

    docker.stdout.on("data", (d) => (stdout += d.toString()));
    docker.stderr.on("data", (d) => (stderr += d.toString()));

    docker.on("close", (code) => {
      // setTimeout(() => {
      //   try {
      //     fs.rmSync(uniqueDir, { recursive: true, force: true });
      //     console.log(`🧹 Cleaned up: ${uniqueDir}`);
      //   } catch (err) {
      //     console.error("⚠️ Cleanup failed:", err.message);
      //   }
      // }, 20000); // ✅ small delay before cleanup
    
      if (code !== 0) return reject(new Error(stderr || "Execution failed"));
      resolve({ output: stdout, error: stderr });
    });
    

    docker.on("error", (err) => {
      try {
        fs.rmSync(uniqueDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up after error: ${uniqueDir}`);
      } catch {}

      reject(new Error(`Docker failed: ${err.message}`));
    });
  });
};
