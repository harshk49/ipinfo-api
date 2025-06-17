const express = require("express");
const maxmind = require("maxmind");
const path = require("path");
const fs = require("fs");
const net = require("net");

const app = express();
const PORT = 3000;
let reader;

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

// POST /api/ip
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
  console.log("Server is running on port:", PORT);
});
