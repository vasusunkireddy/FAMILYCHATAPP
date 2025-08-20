// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const app = express();

app.set("trust proxy", 1);
app.use(cors());              // permissive; tighten later if you want
app.use(express.json());

app.get("/", (_req, res) => res.send("Backend running ✅"));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
