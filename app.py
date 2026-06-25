import os
import time
import asyncio
import httpx
import logging
from quart import Quart, request, jsonify
from groq import AsyncGroq
import aiosqlite

# Setup logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("HenryTechCore")

app = Quart(__name__)

GROQ_CLIENT = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY", "your-fallback-key"))
DB_FILE = "henry_tech_v5.db"

async def init_db():
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                sender TEXT PRIMARY KEY, name TEXT, timestamp REAL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS blacklist (sender TEXT PRIMARY KEY)
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                msg_id TEXT PRIMARY KEY, sender TEXT, name TEXT, body TEXT, timestamp REAL
            )
        """)
        await db.commit()
        logger.info("⚡ V5.0 Master Database Synchronized.")

@app.before_serving
async def startup_configuration_lifecycle():
    await init_db()

WELCOME_TEXT = (
    "╔═══════════════════════════════════════╗\n"
    "  █░█ █▀▀ █▄░█ █▀█ █▄█   ▀█▀ █▀▀ █▀▀ █░█\n"
    "  █▀█ ██▄ █░▀█ █▀▄ ░█░   ░█░ ██▄ █▄▄ █▀█\n"
    "╚═══════════════════════════════════════╝\n\n"
    "✨ 𝖧𝖤𝖭𝖱𝖸 𝖳𝖤𝖢𝖧 𝖠𝖴𝖳𝖮𝖬𝖠𝖳𝖨𝖮𝖭 𝖵𝖤𝖱𝖲𝖨𝖮𝖭 5.0 ✨\n\n"
    "Your profile node is securely authenticated. All 19 Automation Core Modules are currently online. 🌐\n\n"
    "⚡ ENGINE COMMAND MATRIX ⚡\n"
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    "🧠 /ask [query] ➔ Chat with Llama-3 AI\n"
    "🎨 /paint [text] ➔ Generate text image\n"
    "📥 /download_video [URL] ➔ Download Videos\n"
    "🎧 /download_song [URL] ➔ Extract MP3\n"
    "🗑️ /recover [number] ➔ Recover deleted messages\n"
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    "🛡️ Anti-Ban, Fake Typing, Auto Status & Auto React running in background."
)

async def check_db_blacklist(sender: str) -> bool:
    if not sender: return False
    async with aiosqlite.connect(DB_FILE) as db:
        async with db.execute("SELECT 1 FROM blacklist WHERE sender = ?", (sender,)) as c:
            return (await c.fetchone()) is not None

@app.route("/auto-save", methods=["POST"])
async def register_profile():
    data = await request.get_json() or {}
    sender = data.get("sender", "").strip()
    name = data.get("name", "User").strip()
    if not sender:
        return jsonify({"status": "error", "message": "Missing sender"}), 400
    if await check_db_blacklist(sender):
        return jsonify({"status": "blacklisted"})
    async with aiosqlite.connect(DB_FILE) as db:
        try:
            await db.execute("INSERT INTO contacts VALUES (?, ?, ?)", (sender, name, time.time()))
            await db.commit()
            return jsonify({"status": "new_user_registered", "welcome_message": WELCOME_TEXT})
        except aiosqlite.IntegrityError:
            return jsonify({"status": "already_indexed"})

@app.route("/log-message", methods=["POST"])
async def log_message():
    data = await request.get_json() or {}
    msg_id = data.get("msg_id")
    sender = data.get("sender")
    name = data.get("name", "User")
    body = data.get("body", "")
    if not msg_id or not sender:
        return jsonify({"status": "ignored"}), 400
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?)",
                         (msg_id, sender, name, body, time.time()))
        await db.commit()
    return jsonify({"status": "logged"})

@app.route("/react", methods=["POST"])
async def process_sentiment():
    data = await request.get_json() or {}
    p = data.get("body", "").lower().strip()
    if any(w in p for w in ["love", "heart", "perfect", "amazing", "beautiful"]): return jsonify({"emoji": "❤️"})
    if any(w in p for w in ["lol", "haha", "lmao", "funny", "😂"]): return jsonify({"emoji": "😂"})
    if any(w in p for w in ["sad", "cry", "miss", "sorry"]): return jsonify({"emoji": "🥺"})
    if any(w in p for w in ["fire", "lit", "banger", "🔥"]): return jsonify({"emoji": "🔥"})
    return jsonify({"emoji": "👍"})

@app.route("/get-bio", methods=["GET"])
async def generate_auto_bio():
    t_str = time.strftime("%H:%M:%S")
    return jsonify({"bio": f"🤖 Henry Tech V5.0 Active | Sync: {t_str} | Operating Always 🌐"})

@app.route("/webhook", methods=["POST"])
async def process_command_pipeline():
    data = await request.get_json() or {}
    incoming_text = data.get("body", "").strip()
    sender = data.get("sender", "").strip()

    if await check_db_blacklist(sender):
        return jsonify({"reply": "❌ Access Denied. Your profile node remains blacklisted."})

    # 1. AI Command
    if incoming_text.startswith("/ask "):
        prompt = incoming_text[5:].strip()
        if not prompt:
            return jsonify({"reply": "⚠️ Please provide a query after /ask"})
        try:
            res = await GROQ_CLIENT.chat.completions.create(
                model="llama3-8b-8192",
                messages=[{"role": "user", "content": prompt}]
            )
            return jsonify({"reply": res.choices[0].message.content})
        except Exception as e:
            return jsonify({"reply": f"❌ AI Error: {str(e)}"})

    # 2. Paint / Text Image Command
    elif incoming_text.startswith("/paint "):
        prompt = incoming_text[7:].strip()
        if not prompt:
            return jsonify({"reply": "⚠️ Please provide text after /paint"})
        encoded = prompt.replace(' ', '+')
        url = f"https://placehold.co/1200x630/0f172a/38bdf8?text={encoded}"
        return jsonify({"reply": f"🎨 *Text Image Generated*\n\n🖼️ Link:\n{url}"})

    # 3. Video Download Command
    elif incoming_text.startswith("/download_video "):
        url = incoming_text[16:].strip()
        if not url:
            return jsonify({"reply": "⚠️ Please provide a URL after /download_video"})
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://co.wuk.sh/api/json",
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    json={"url": url, "vCodec": "h264", "vQuality": "720"}
                )
                res_data = res.json()
                if "url" in res_data:
                    return jsonify({"reply": f"⬇️ *Video Ready*\n\n📦 Download Link:\n{res_data['url']}"})
                elif "text" in res_data:
                    return jsonify({"reply": f"❌ {res_data['text']}"})
                return jsonify({"reply": "❌ Could not extract video. Check the URL."})
        except Exception as e:
            return jsonify({"reply": f"❌ Video Error: {str(e)}"})

    # 4. Song/MP3 Download Command
    elif incoming_text.startswith("/download_song "):
        url = incoming_text[15:].strip()
        if not url:
            return jsonify({"reply": "⚠️ Please provide a URL after /download_song"})
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://co.wuk.sh/api/json",
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    json={"url": url, "isAudioOnly": True, "audioFormat": "mp3"}
                )
                res_data = res.json()
                if "url" in res_data:
                    return jsonify({"reply": f"🎧 *MP3 Ready*\n\n🎵 Download Link:\n{res_data['url']}"})
                elif "text" in res_data:
                    return jsonify({"reply": f"❌ {res_data['text']}"})
                return jsonify({"reply": "❌ Could not extract audio. Check the URL."})
        except Exception as e:
            return jsonify({"reply": f"❌ Audio Error: {str(e)}"})

    # 5. Recover Deleted Messages Command
    elif incoming_text.startswith("/recover "):
        target_jid = incoming_text[9:].strip()
        if not target_jid:
            return jsonify({"reply": "⚠️ Please provide a contact number after /recover"})
        async with aiosqlite.connect(DB_FILE) as db:
            async with db.execute(
                "SELECT name, body FROM messages WHERE sender LIKE ? ORDER BY timestamp DESC LIMIT 5",
                (f"%{target_jid}%",)
            ) as cursor:
                rows = await cursor.fetchall()
                if not rows:
                    return jsonify({"reply": f"❌ No cached messages found for {target_jid}"})
                reply_text = f"🗑️ *Recovered Messages for {target_jid}:*\n\n" + \
                             "\n".join([f"👤 *{row[0]}*: {row[1]}" for row in rows])
                return jsonify({"reply": reply_text})

    return jsonify({"reply": "ℹ️ Unknown command. Type /ask, /paint, /download_video, /download_song or /recover"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
