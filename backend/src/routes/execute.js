// src/routes/execute.js
const express = require("express");
const router = express.Router();
const runCode = require("../utils/dockerRunner"); // ✅ generic runner

router.post("/", async (req, res) => {
  const { code, lang } = req.body;
  const userId = req.user?.id || "guest"; // use auth ID or fallback

  if (!code) return res.status(400).json({ error: "No code provided." });

  try {
    const result = await runCode(lang, code, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;
