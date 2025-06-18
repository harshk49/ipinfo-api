const express = require("express");
const maxmind = require("maxmind");
const path = require("path");
const fs = require("fs");
const net = require("net");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
let reader;

// Trust proxy to make req.ip work correctly behind proxies
app.set("trust proxy", true);

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Load MaxMind DB
try {
  const dbPath = path.resolve(__dirname, "GeoLite2-Country.mmdb");

  if (!fs.existsSync(dbPath)) {
    console.error("Maxmind db file not found at: ", dbPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(dbPath);
  reader = new maxmind.Reader(buffer);
  console.log("Maxmind db loaded");
} catch (error) {
  console.error("Failed to load Maxmind db:", error);
  process.exit(1);
}

// POST /api/ip - For custom IPs
app.post("/api/ip", (req, res) => {
  const { ip } = req.body;

  if (!ip) {
    return res.status(400).json({ error: "IP address is required" });
  }

  if (!net.isIP(ip)) {
    return res.status(400).json({ error: "Invalid IP address format" });
  }

  try {
    const result = reader.get(ip);

    if (!result || !result.country?.names?.en) {
      return res.status(404).json({ error: "Country not found" });
    }

    return res.json({ country: result.country.names.en });
  } catch (error) {
    console.error("Error processing IP:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "IP Info API is running" });
});

// GET /api/ip - Detect client IP and return country
app.get("/api/ip", (req, res) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwardedFor === "string" && forwardedFor.split(",")[0]) || req.ip;

  const cleanIp = ip.replace(/^::ffff:/, "").trim();

  console.log(`Client IP detected: ${cleanIp}`);

  if (!cleanIp || !net.isIP(cleanIp)) {
    return res.status(400).json({ error: "Invalid client IP address" });
  }

  // Check for local/private IPs
  const isPrivateIP =
    /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|127\.|::1|fc00:|fd00:|fe80:)/i.test(
      cleanIp
    );

  if (isPrivateIP) {
    console.log(`Private/local IP detected: ${cleanIp}`);
    return res.json({
      country: "Local Network",
      message:
        "This is a private/local IP address and won't be found in the GeoLite database",
      detectedIp: cleanIp,
    });
  }

  try {
    const result = reader.get(cleanIp);

    if (!result || !result.country?.names?.en) {
      return res.status(404).json({
        error: "Country not found",
        detectedIp: cleanIp,
        tip: "If testing locally, try sending a specific IP via the POST /api/ip endpoint instead",
      });
    }

    return res.json({
      country: result.country.names.en,
      detectedIp: cleanIp,
    });
  } catch (error) {
    console.error("Error processing IP:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", detectedIp: cleanIp });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error: ", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
