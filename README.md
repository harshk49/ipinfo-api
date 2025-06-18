# IP Info API

A simple API built with Express.js and MaxMind's GeoLite2 database to provide country information for IP addresses.

## Features

- Get country information for a specific IP address
- Automatically detect client IP and return country information
- Handles local/private IP addresses gracefully
- Ready for deployment on Render.com

## API Endpoints

### GET /

Health check endpoint that returns a status message.

### GET /api/ip

Detects the client's IP address and returns the country information.

Example response:

```json
{
  "country": "United States",
  "detectedIp": "203.0.113.1"
}
```

For local/private IP addresses:

```json
{
  "country": "Local Network",
  "message": "This is a private/local IP address and won't be found in the GeoLite database",
  "detectedIp": "192.168.1.1"
}
```

### POST /api/ip

Looks up country information for a specific IP address.

Request body:

```json
{
  "ip": "8.8.8.8"
}
```

Response:

```json
{
  "country": "United States"
}
```

## Deployment to Render

### One-Click Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Deployment

1. Create a new Web Service on Render
2. Connect your GitHub/GitLab repository
3. Use the following settings:

   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: Add `NODE_ENV=production`

4. Click "Create Web Service"

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
4. Access the API at http://localhost:3000

## Requirements

- Node.js 18 or higher
- MaxMind GeoLite2-Country.mmdb file in the project root
