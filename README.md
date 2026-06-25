# 🤖 Henry Tech Automation V5.0

A powerful WhatsApp bot built with Baileys (Node.js) and Quart (Python), featuring AI chat, media downloading, auto reactions, and much more.

---

## 📋 Requirements

- Node.js v16+
- Python 3.10+
- A WhatsApp account
- Groq API key (free at [console.groq.com](https://console.groq.com))

---

## 📁 File Structure

```
henrytech.ke/
├── app.py               # Python backend (AI, database, commands)
├── client_bridge.js     # WhatsApp bridge (Baileys)
├── requirements.txt     # Python dependencies
├── package.json         # Node.js dependencies
└── README.md            # This file
```

---

## ⚙️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/henrytech.ke
cd henrytech.ke
```

### 2. Install Node.js dependencies
```bash
npm install
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 4. Set your Groq API key
```bash
export GROQ_API_KEY="your_groq_api_key_here"
```

---

## 🔗 Linking WhatsApp

### Method 1 - QR Code (Default)
Run the bot and scan the QR code shown in terminal:
```bash
node client_bridge.js
```
- Open WhatsApp
- Go to **Linked Devices**
- Tap **Link a Device**
- Scan the QR code shown in terminal

### Method 2 - Pairing Code
If you prefer a pairing code instead of QR, edit `client_bridge.js`:

```javascript
// Change this in makeWASocket config:
const socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,  // Set to false
    logger: require("pino")({ level: "silent" }),
    markOnlineOnConnect: true
});

// Add this after socket is created:
if (!socket.authState.creds.registered) {
    const phoneNumber = "2547XXXXXXXX"; // Your number with country code, no +
    const code = await socket.requestPairingCode(phoneNumber);
    console.log("🔑 Pairing Code: " + code);
}
```

Then:
- Open WhatsApp
- Go to **Linked Devices**
- Tap **Link a Device**
- Tap **Link with phone number instead**
- Enter the pairing code shown in terminal

---

## 🚀 Running the Bot

### Start Python backend first:
```bash
python app.py
```

### Then start WhatsApp bridge:
```bash
node client_bridge.js
```

### Run both together (Termux/Linux):
```bash
python app.py & node client_bridge.js
```

---

## 💬 Commands

| Command | Description |
|---------|-------------|
| `/ask [query]` | Chat with Llama-3 AI |
| `/paint [text]` | Generate a text image |
| `/download_video [URL]` | Download video (IG, FB, YT) |
| `/download_song [URL]` | Extract MP3 audio |
| `/recover [number]` | Recover last 5 deleted messages |

---

## 🛡️ Auto Features

| Feature | Status |
|---------|--------|
| Auto Save Contacts | ✅ On |
| Auto Welcome Message | ✅ On |
| Auto Read Messages | ✅ On |
| Auto React to Messages | ✅ On |
| Auto View & Like Status | ✅ On |
| Auto Bio Update (60s) | ✅ On |
| Save View Once Media | ✅ On |
| Anti-Call | ✅ On |
| Always Online | ✅ On |
| Anti-Ban Mode | ✅ On |
| Fake Typing Simulation | ✅ On |
| Fake Recording Simulation | ✅ On |

---

## 📱 Running on Termux (Android)

```bash
# Install dependencies
pkg update && pkg upgrade
pkg install python nodejs git build-essential rust

# Clone repo
git clone https://github.com/yourusername/henrytech.ke
cd henrytech.ke

# Install packages
npm install
pip install -r requirements.txt --prefer-binary

# Set API key
export GROQ_API_KEY="your_key_here"

# Run bot
python app.py &
node client_bridge.js
```

---

## 🗄️ Database

The bot uses SQLite (`henry_tech_v5.db`) to store:
- **contacts** - All saved WhatsApp contacts
- **messages** - All incoming messages (for /recover)
- **blacklist** - Blocked users

---

## ⚠️ Important Notes

- Keep Termux open or use `tmux` to run in background
- Your session is saved in `henry_v5_auth_session/` folder
- If bot disconnects it will auto reconnect
- Never share your `henry_v5_auth_session/` folder

---

## 📞 Support

Built by **Henry Tech** 🚀
