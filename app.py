"""
ConvertBox Backend — Universal File Converter
Accepts ANY file. Shows ALL output formats. Let the engine figure it out.
Uses Pillow for image-to-image optimization, FFmpeg as universal fallback.
Serves the React frontend build when available.

Quick start:
    pip install -r requirements.txt
    python app.py          # http://localhost:5000

Docker:
    docker compose up --build
"""

import uuid
import subprocess
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent / "frontend" / "build"
app = Flask(__name__, static_folder=str(STATIC_DIR) if STATIC_DIR.exists() else None)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB

UPLOAD_DIR = Path(tempfile.gettempdir()) / "convertbox"
UPLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Every output format we support — no category gating
# ---------------------------------------------------------------------------
ALL_OUTPUTS = {
    # Images
    "jpg":  {"group": "Image", "label": "JPG",  "pillow": True},
    "png":  {"group": "Image", "label": "PNG",  "pillow": True},
    "webp": {"group": "Image", "label": "WEBP", "pillow": True},
    "bmp":  {"group": "Image", "label": "BMP",  "pillow": True},
    "gif":  {"group": "Image", "label": "GIF",  "pillow": True},
    "tiff": {"group": "Image", "label": "TIFF", "pillow": True},
    "ico":  {"group": "Image", "label": "ICO",  "pillow": True},
    # Audio
    "mp3":  {"group": "Audio", "label": "MP3",  "pillow": False},
    "wav":  {"group": "Audio", "label": "WAV",  "pillow": False},
    "ogg":  {"group": "Audio", "label": "OGG",  "pillow": False},
    "flac": {"group": "Audio", "label": "FLAC", "pillow": False},
    "aac":  {"group": "Audio", "label": "AAC",  "pillow": False},
    "opus": {"group": "Audio", "label": "OPUS", "pillow": False},
    "m4a":  {"group": "Audio", "label": "M4A",  "pillow": False},
    "wma":  {"group": "Audio", "label": "WMA",  "pillow": False},
    # Video
    "mp4":  {"group": "Video", "label": "MP4",  "pillow": False},
    "webm": {"group": "Video", "label": "WEBM", "pillow": False},
    "avi":  {"group": "Video", "label": "AVI",  "pillow": False},
    "mkv":  {"group": "Video", "label": "MKV",  "pillow": False},
    "mov":  {"group": "Video", "label": "MOV",  "pillow": False},
    "flv":  {"group": "Video", "label": "FLV",  "pillow": False},
    "wmv":  {"group": "Video", "label": "WMV",  "pillow": False},
    "3gp":  {"group": "Video", "label": "3GP",  "pillow": False},
}

PILLOW_INPUT_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif",
                     ".tiff", ".tif", ".ico"}
PILLOW_OUTPUT_EXTS = {k for k, v in ALL_OUTPUTS.items() if v["pillow"]}


def use_pillow(in_ext: str, out_ext: str) -> bool:
    return in_ext.lower() in PILLOW_INPUT_EXTS and out_ext in PILLOW_OUTPUT_EXTS


# ---------------------------------------------------------------------------
# Conversion engines
# ---------------------------------------------------------------------------
def convert_pillow(inp: Path, outp: Path, fmt: str, quality: int = 85):
    img = Image.open(inp)
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    no_alpha = ("jpg", "jpeg", "bmp", "ico")
    if fmt in no_alpha and img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        if "A" in img.getbands():
            bg.paste(img, mask=img.split()[-1])
        else:
            bg.paste(img)
        img = bg
    elif img.mode == "P":
        img = img.convert("RGBA")

    kw = {}
    if fmt in ("jpg", "jpeg"):
        kw.update(quality=quality, optimize=True)
        if img.mode != "RGB":
            img = img.convert("RGB")
    elif fmt == "webp":
        kw["quality"] = quality
    elif fmt == "png":
        kw["optimize"] = True

    img.save(outp, **kw)


def convert_ffmpeg(inp: Path, outp: Path):
    ext = outp.suffix.lower().lstrip(".")
    cmd = ["ffmpeg", "-y", "-i", str(inp), "-threads", "0"]

    codec_map = {
        "mp3":  ["-codec:a", "libmp3lame", "-q:a", "2"],
        "aac":  ["-codec:a", "aac", "-b:a", "192k"],
        "m4a":  ["-codec:a", "aac", "-b:a", "192k"],
        "opus": ["-codec:a", "libopus", "-b:a", "128k"],
        "flac": ["-codec:a", "flac"],
        "wav":  ["-codec:a", "pcm_s16le"],
        "ogg":  ["-codec:a", "libvorbis", "-q:a", "5"],
        "wma":  ["-codec:a", "wmav2", "-b:a", "192k"],
        "mp4":  ["-codec:v", "libx264", "-preset", "medium", "-crf", "23",
                 "-codec:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
        "webm": ["-codec:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
                 "-codec:a", "libopus", "-b:a", "128k"],
        "avi":  ["-codec:v", "mpeg4", "-q:v", "3", "-codec:a", "mp3", "-q:a", "2"],
        "mkv":  ["-codec:v", "libx264", "-preset", "medium", "-crf", "23",
                 "-codec:a", "aac", "-b:a", "192k"],
        "mov":  ["-codec:v", "libx264", "-preset", "medium", "-crf", "23",
                 "-codec:a", "aac", "-b:a", "192k", "-f", "mov"],
        "flv":  ["-codec:v", "flv", "-q:v", "3", "-codec:a", "mp3", "-q:a", "2"],
        "wmv":  ["-codec:v", "wmv2", "-q:v", "3", "-codec:a", "wmav2", "-b:a", "192k"],
        "3gp":  ["-codec:v", "h263", "-s", "352x288", "-codec:a", "aac", "-b:a", "64k"],
    }

    if ext in ("jpg", "jpeg", "png", "bmp", "webp", "tiff", "gif", "ico"):
        cmd += ["-frames:v", "1"]
    elif ext in codec_map:
        cmd += codec_map[ext]
    else:
        cmd += ["-q:a", "2", "-q:v", "2"]

    cmd.append(str(outp))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{(result.stderr or 'Unknown')[-800:]}")


def ffmpeg_ok() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    groups = {}
    for ext, info in ALL_OUTPUTS.items():
        g = info["group"]
        groups.setdefault(g, []).append({"ext": ext, "label": info["label"]})
    return jsonify({"status": "ok", "ffmpeg": ffmpeg_ok(),
                    "max_upload_mb": 500, "outputs": groups})


@app.route("/api/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    fmt = request.form.get("format", "").lower().strip(".")
    quality = min(100, max(1, int(request.form.get("quality", 85))))

    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    if fmt not in ALL_OUTPUTS:
        return jsonify({"error": f"Unsupported output: .{fmt}"}), 400

    in_ext = Path(file.filename).suffix.lower()
    jid = uuid.uuid4().hex[:12]
    inp = UPLOAD_DIR / f"{jid}_in{in_ext}"
    stem = Path(file.filename).stem
    outp = UPLOAD_DIR / f"{jid}_{stem}.{fmt}"
    file.save(inp)

    try:
        if use_pillow(in_ext, fmt):
            convert_pillow(inp, outp, fmt, quality)
        else:
            if not ffmpeg_ok():
                raise RuntimeError("This conversion needs FFmpeg. Install it or use Docker.")
            convert_ffmpeg(inp, outp)

        if not outp.exists() or outp.stat().st_size == 0:
            raise RuntimeError("Conversion produced empty output. This combo may not be supported.")

        return send_file(outp, as_attachment=True, download_name=f"{stem}.{fmt}")
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        for p in (inp, outp):
            try:
                p.exists() and p.unlink()
            except OSError:
                pass


@app.route("/api/batch-convert", methods=["POST"])
def batch_convert():
    import zipfile, io
    files = request.files.getlist("files")
    fmt = request.form.get("format", "").lower().strip(".")
    quality = min(100, max(1, int(request.form.get("quality", 85))))
    if not files:
        return jsonify({"error": "No files"}), 400
    if fmt not in ALL_OUTPUTS:
        return jsonify({"error": f"Unsupported: .{fmt}"}), 400

    buf = io.BytesIO()
    errs = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in files:
            jid = uuid.uuid4().hex[:8]
            in_ext = Path(file.filename).suffix.lower()
            inp = UPLOAD_DIR / f"{jid}_in{in_ext}"
            stem = Path(file.filename).stem
            outp = UPLOAD_DIR / f"{jid}_{stem}.{fmt}"
            file.save(inp)
            try:
                if use_pillow(in_ext, fmt):
                    convert_pillow(inp, outp, fmt, quality)
                else:
                    convert_ffmpeg(inp, outp)
                if outp.exists() and outp.stat().st_size > 0:
                    zf.write(outp, f"{stem}.{fmt}")
                else:
                    errs.append(f"{file.filename}: empty output")
            except Exception as e:
                errs.append(f"{file.filename}: {e}")
            finally:
                for p in (inp, outp):
                    try:
                        p.exists() and p.unlink()
                    except OSError:
                        pass

    buf.seek(0)
    resp = send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name="convertbox_output.zip")
    if errs:
        resp.headers["X-Conversion-Errors"] = "; ".join(errs)
    return resp


# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if STATIC_DIR.exists():
        fp = STATIC_DIR / path
        if fp.is_file():
            return send_from_directory(str(STATIC_DIR), path)
        return send_from_directory(str(STATIC_DIR), "index.html")
    return jsonify({"message": "ConvertBox API running", "hint": "Build frontend or use Docker"})


if __name__ == "__main__":
    ff = ffmpeg_ok()
    fe = STATIC_DIR.exists()
    print(f"\n  ConvertBox Server")
    print(f"  http://localhost:5000")
    print(f"  FFmpeg: {'yes' if ff else 'no'} | Frontend: {'yes' if fe else 'no'}")
    print(f"  {len(ALL_OUTPUTS)} output formats\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
