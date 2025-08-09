const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const helmet = require("helmet");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));

const usersDir = path.join(__dirname, "users");
if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });

const bots = new Map();

app.post("/start-bot", (req, res) => {
  const { uid, admin, appstate } = req.body;

  if (!uid || !admin || !appstate) {
    return res.status(400).send("❌ Missing UID, Admin or AppState");
  }

  const userDir = path.join(usersDir, uid);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(userDir, "appstate.json"), appstate, "utf-8");
    fs.writeFileSync(path.join(userDir, "admin.txt"), admin, "utf-8");
  } catch (e) {
    return res.status(500).send("❌ Failed to save user files");
  }

  if (bots.has(uid)) {
    try {
      bots.get(uid).kill();
    } catch {}
    bots.delete(uid);
  }

  const botProcess = spawn("node", ["bot.js", uid]);

  bots.set(uid, botProcess);

  botProcess.stdout.on("data", (data) => {
    const logFile = path.join(userDir, "logs.txt");
    fs.appendFileSync(logFile, data.toString());
    console.log(`[BOT ${uid}] ${data.toString()}`);
  });

  botProcess.stderr.on("data", (data) => {
    const logFile = path.join(userDir, "logs.txt");
    fs.appendFileSync(logFile, data.toString());
    console.error(`[BOT ${uid} ERR] ${data.toString()}`);
  });

  botProcess.on("exit", (code) => {
    bots.delete(uid);
    console.log(`[BOT ${uid}] exited with code ${code}`);
  });

  res.send(`✅ Bot started for UID: ${uid}`);
});

app.get("/logs", (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).send("❌ Missing UID");

  const logFile = path.join(usersDir, uid, "logs.txt");
  if (!fs.existsSync(logFile)) return res.send("ℹ️ No logs yet.");

  fs.readFile(logFile, "utf-8", (err, data) => {
    if (err) return res.status(500).send("❌ Error reading logs");
    res.send(data);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
