const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const DOCKER_BIN =
  process.platform === "win32"
    ? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
    : "docker";

module.exports = function runCode(code, lang = "python") {
  return new Promise((resolve, reject) => {
    // 1️⃣ Unique temp dir per execution
    const sessionId = uuidv4();
    const tmpDir = path.join("/tmp", sessionId);
    fs.mkdirSync(tmpDir, { recursive: true });

    // 2️⃣ Write code file
    const fileName = lang === "c" ? "code.c" : "code.py";
    const filePath = path.join(tmpDir, fileName);
    fs.writeFileSync(filePath, code);

    // 3️⃣ Select Docker image + command
    let dockerArgs;
    if (lang === "python") {
      dockerArgs = [
        "run",
        "--rm",
        "--network",
        "none",
        "-m",
        "128m",
        "--cpus=0.5",
        "-v",
        `${tmpDir}:/app`,
        "python:3",
        "python",
        "/app/code.py",
      ];
    } else if (lang === "c") {
      dockerArgs = [
        "run",
        "--rm",
        "--network",
        "none",
        "-m",
        "128m",
        "--cpus=0.5",
        "-v",
        `${tmpDir}:/app`,
        "codeguard-c",
        "sh",
        "-c",
        "gcc /app/code.c -o /app/a.out && chmod +x /app/a.out && timeout 5 /app/a.out",
      ];
    } else {
      return reject(new Error(`Unsupported language: ${lang}`));
    }

    console.log("🔹 Running command:", DOCKER_BIN, dockerArgs.join(" "));

    // 4️⃣ Spawn docker process
    const docker = spawn(DOCKER_BIN, dockerArgs, { shell: false });

    let stdout = "";
    let stderr = "";

    docker.stdout.on("data", (data) => (stdout += data.toString()));
    docker.stderr.on("data", (data) => (stderr += data.toString()));

    docker.on("close", (code) => {
      console.log("🔹 Docker exited with code:", code);
      console.log("🔹 STDOUT:", stdout);
      console.log("🔹 STDERR:", stderr);

      // 5️⃣ Cleanup temp folder
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.error("⚠️ Cleanup failed:", e);
      }

      if (code !== 0) {
        return reject(new Error(stderr || "Execution failed"));
      }
      resolve({ output: stdout, error: stderr });
    });

    docker.on("error", (err) => {
      console.error("❌ Failed to run Docker:", err);
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
      reject(new Error(`Failed to run Docker: ${err.message}`));
    });
  });
};
