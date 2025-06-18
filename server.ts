import express from "express";
import type { Request, Response, NextFunction } from "express";
import * as maxmind from "maxmind";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import cors from "cors";

interface CountryResponse {
  country: string;
  detectedIp?: string;
  message?: string;
  tip?: string;
}

interface ErrorResponse {
  error: string;
  detectedIp?: string;
  tip?: string;
}

interface IPRequestBody {
  ip: string;
}

const app = express();
const PORT = process.env.PORT || 3000;
let reader: maxmind.Reader<maxmind.CountryResponse>;
let readerInitialized = false;

// Trust proxy to make req.ip work correctly behind proxies
app.set("trust proxy", true);

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Load MaxMind DB
async function initializeMaxmind() {
  try {
    const dbPath = path.resolve(__dirname, "GeoLite2-Country.mmdb");

    if (!fs.existsSync(dbPath)) {
      console.error("Maxmind db file not found at: ", dbPath);
      process.exit(1);
    }

    reader = await maxmind.open<maxmind.CountryResponse>(dbPath);
    readerInitialized = true;
    console.log("Maxmind db loaded");
  } catch (error) {
    console.error("Failed to load Maxmind db:", error);
    process.exit(1);
  }
}

// Function to ensure reader is initialized
async function ensureReaderInitialized(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (readerInitialized) {
    next();
    return;
  }

  try {
    await initializeMaxmind();
    next();
  } catch (error) {
    console.error("Error initializing maxmind:", error);
    res
      .status(500)
      .json({ error: "Server initialization failed" } as ErrorResponse);
  }
}

// Apply middleware to routes that need the reader
app.use("/api/ip", ensureReaderInitialized);

// POST /api/ip - For custom IPs
app.post("/api/ip", (req: Request<{}, {}, IPRequestBody>, res: Response) => {
  const { ip } = req.body;

  if (!ip) {
    return res
      .status(400)
      .json({ error: "IP address is required" } as ErrorResponse);
  }

  if (!net.isIP(ip)) {
    return res
      .status(400)
      .json({ error: "Invalid IP address format" } as ErrorResponse);
  }

  try {
    const result = reader.get(ip);

    if (!result || !result.country?.names?.en) {
      return res
        .status(404)
        .json({ error: "Country not found" } as ErrorResponse);
    }

    return res.json({ country: result.country.names.en } as CountryResponse);
  } catch (error) {
    console.error("Error processing IP:", error);
    return res
      .status(500)
      .json({ error: "Internal server error" } as ErrorResponse);
  }
});

// Root route
app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", message: "IP Info API is running" });
});

// GET /api/ip - Detect client IP and return country
app.get("/api/ip", (req: Request, res: Response) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwardedFor === "string" && forwardedFor.split(",")[0]) || req.ip;

  const cleanIp = ip.replace(/^::ffff:/, "").trim();

  console.log(`Client IP detected: ${cleanIp}`);

  if (!cleanIp || !net.isIP(cleanIp)) {
    return res
      .status(400)
      .json({ error: "Invalid client IP address" } as ErrorResponse);
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
    } as CountryResponse);
  }

  try {
    const result = reader.get(cleanIp);

    if (!result || !result.country?.names?.en) {
      return res.status(404).json({
        error: "Country not found",
        detectedIp: cleanIp,
        tip: "If testing locally, try sending a specific IP via the POST /api/ip endpoint instead",
      } as ErrorResponse);
    }

    return res.json({
      country: result.country.names.en,
      detectedIp: cleanIp,
    } as CountryResponse);
  } catch (error) {
    console.error("Error processing IP:", error);
    return res
      .status(500)
      .json({
        error: "Internal server error",
        detectedIp: cleanIp,
      } as ErrorResponse);
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" } as ErrorResponse);
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error: ", err);
  res.status(500).json({ error: "Internal Server Error" } as ErrorResponse);
});

// Initialize and start the server
initializeMaxmind()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
