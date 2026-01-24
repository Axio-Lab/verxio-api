# Remotion Render Server

A server for rendering Remotion videos on-demand.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Start the production server:

```bash
npm start
```

## API

### POST /render

Renders a Remotion video from provided code.

**Request Body:**

```json
{
  "code": {
    "entryFile": "...",
    "rootFile": "...",
    "compositionFile": "..."
  },
  "compositionId": "MyComp" // optional, defaults to "MyComp"
}
```

**Response:**

```json
{
  "success": true,
  "videoUrl": "http://localhost:3001/videos/project-1234567890.mp4",
  "message": "Video rendered successfully"
}
```

## Server

The server runs on `http://localhost:3001` by default.

- Videos are served from `/videos` endpoint
- Rendered videos are stored in `outputs/` directory
- Temporary projects are stored in `temp-projects/` directory
