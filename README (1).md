# ConvertBox

A self-hosted, universal file converter. Drop any file, pick any output format, get your converted file back. No sketchy websites. No email hostage. No tracking. Your files never leave your machine.

Built with React + Python Flask + Pillow + FFmpeg.

---

## Why This Exists

Every free online converter follows the same playbook: upload your file to their server, wait, then get ambushed with "create an account to download" or "subscribe for HD quality." Your file is already on their server at that point. ConvertBox fixes this by running entirely on your hardware — either in the browser or on a local Flask server.

---

## What It Does

- **Accepts any file** — images, audio, video, anything. No input restrictions.
- **Shows all 23 output formats** — grouped by type (Image, Audio, Video) with search and tab filters. No gatekeeping based on input type. Want to extract audio from a video as MP3? Just pick MP3.
- **Two conversion modes:**
  - **Browser mode** (no server needed): handles image-to-image conversions (JPG, PNG, WEBP, BMP) via the Canvas API. Files literally never leave the browser tab.
  - **Server mode** (Flask backend): unlocks all 23 formats including cross-type conversions using Pillow for optimized image processing and FFmpeg for everything else.
- **Batch conversion** — drop multiple files, convert them all at once. The server endpoint returns a ZIP.
- **Quality control** — adjustable quality slider for JPG and WEBP output with a live percentage and visual track.

---

## Supported Output Formats (23 total)

| Image | Audio | Video |
|-------|-------|-------|
| JPG | MP3 | MP4 |
| PNG | WAV | WEBM |
| WEBP | OGG | AVI |
| BMP | FLAC | MKV |
| GIF | AAC | MOV |
| TIFF | OPUS | FLV |
| ICO | M4A | WMV |
| | WMA | 3GP |

Input is unrestricted. If FFmpeg can read it, ConvertBox can convert it.

---

## Quick Start

### Option 1: Docker (recommended)

```bash
git clone https://github.com/your-username/convertbox.git
cd convertbox
docker compose up --build
```

Open [http://localhost:5000](http://localhost:5000). That's it. Docker handles the React build, Python dependencies, and FFmpeg installation in a single multi-stage image.

### Option 2: Run Manually

**Prerequisites:**
- Python 3.10+
- Node.js 18+ (for frontend dev/build)
- FFmpeg (for audio/video conversion)

**Install FFmpeg:**
```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows — download from https://ffmpeg.org/download.html and add to PATH
```

**Start the backend:**
```bash
pip install -r requirements.txt
python app.py
```

Server starts at [http://localhost:5000](http://localhost:5000). If the frontend is already built, Flask serves it directly.

**Frontend development (hot reload):**
```bash
cd frontend
npm install
npm start
```

React dev server runs at `http://localhost:3000`, proxied to Flask at `:5000`.

**Frontend production build:**
```bash
cd frontend
npm run build
```

Then run `python app.py` — Flask picks up the built frontend from `frontend/build/` and serves everything from one port.

---

## Project Structure

```
convertbox/
├── app.py                  # Flask backend — API + static serving
├── requirements.txt        # Python deps (Flask, Flask-CORS, Pillow)
├── Dockerfile              # Multi-stage: Node build → Python + FFmpeg
├── docker-compose.yml      # One-command deploy
├── .dockerignore
├── .gitignore
├── README.md
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        └── App.jsx         # Full React application
```

---

## API Reference

The backend exposes three endpoints. All conversion endpoints accept `multipart/form-data`.

### `GET /api/health`

Returns server status, FFmpeg availability, and all supported output formats.

```json
{
  "status": "ok",
  "ffmpeg": true,
  "max_upload_mb": 500,
  "outputs": {
    "Image": [{"ext": "jpg", "label": "JPG"}, ...],
    "Audio": [{"ext": "mp3", "label": "MP3"}, ...],
    "Video": [{"ext": "mp4", "label": "MP4"}, ...]
  }
}
```

### `POST /api/convert`

Convert a single file. Returns the converted file as a binary download.

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The input file |
| `format` | String | Target format extension (e.g., `mp3`, `jpg`, `webm`) |
| `quality` | Int | 1–100, used for JPG/WEBP image output (default: 85) |

```bash
curl -X POST http://localhost:5000/api/convert \
  -F "file=@photo.png" \
  -F "format=jpg" \
  -F "quality=90" \
  --output photo.jpg
```

### `POST /api/batch-convert`

Convert multiple files at once. Returns a ZIP archive.

| Field | Type | Description |
|-------|------|-------------|
| `files` | File[] | Multiple input files |
| `format` | String | Target format extension |
| `quality` | Int | 1–100 (default: 85) |

```bash
curl -X POST http://localhost:5000/api/batch-convert \
  -F "files=@a.png" \
  -F "files=@b.webp" \
  -F "format=jpg" \
  --output converted.zip
```

---

## How Conversion Works

The backend picks the best engine for each job:

1. **Pillow** — used when both input and output are standard image formats (PNG, JPG, WEBP, BMP, GIF, TIFF, ICO). Handles EXIF rotation, transparency compositing, and quality optimization.

2. **FFmpeg** — used for everything else. Audio-to-audio, video-to-video, video-to-audio (extract audio track), video-to-image (grab a frame), and any cross-type conversion FFmpeg supports. Codec selection is per-format: libx264 for MP4, libvpx-vp9 for WEBM, libmp3lame for MP3, etc.

The frontend also has a **client-side fallback** using the HTML5 Canvas API. When the server is offline, it can still convert images to JPG, PNG, WEBP, or BMP directly in the browser. Formats that require the server show a small "S" indicator.

---

## UI Features

- **Dark cinematic design** — Sora + JetBrains Mono typography, animated background orbs, glassmorphism cards, glow effects
- **Image thumbnails** — dropped images get instant previews
- **Animated file type icons** — color-coded rings (orange for images, purple for audio, blue for video)
- **Format search** — type to filter across all 23 formats
- **Group tabs** — quick toggle between All / Image / Audio / Video
- **Live progress** — animated striped progress bar during batch conversion
- **Size comparison** — results show percentage size change with color coding (green = smaller, yellow = larger)
- **Server status indicator** — real-time pill badge showing "Server connected" or "Browser mode"
- **Staggered animations** — file cards, format chips, and sections animate in sequentially

---

## Configuration

| Setting | Default | Location |
|---------|---------|----------|
| Max upload size | 500 MB | `app.py` → `MAX_CONTENT_LENGTH` |
| Server port | 5000 | `app.py` → `app.run(port=...)` |
| FFmpeg timeout | 600s | `app.py` → `subprocess.run(timeout=...)` |
| API base URL | `http://localhost:5000` | `App.jsx` → `const API` |

---

## Deployment Ideas

- **Local use**: just `python app.py` or `docker compose up`
- **Home server / Raspberry Pi**: Docker image runs on ARM too — accessible from any device on your network
- **Cloud VM**: a $5 DigitalOcean or Hetzner box gives you a private converter accessible from anywhere
- **Vercel (frontend only)**: deploy the React build for browser-mode image conversion without a server

---

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React 18, Sora font, JetBrains Mono | UI with client-side image conversion |
| Backend | Flask 3.1, Flask-CORS | API server + static file serving |
| Image engine | Pillow 11 | Optimized image-to-image conversion |
| Media engine | FFmpeg | Universal audio/video/cross-type conversion |
| Container | Docker, multi-stage build, Gunicorn | Production deployment |

---

## License

MIT — do whatever you want with it.
