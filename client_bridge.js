const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const axios = require("axios");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const BACKEND_URL = "http://127.0.0.1:5000";

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 25000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});

// Create sessions directory if not exists
const SESSIONS_DIR = "./sessions";
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// Ask user which linking method
function askLinkingMethod() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n╔══════════════════════════════════════╗");
    console.log("   🦈 SHARK BOT - HENRY TECH V5.0 🦈   ");
    console.log("╚══════════════════════════════════════╝\n");
    console.log("1️⃣  QR Code - Scan with WhatsApp camera");
    console.log("2️⃣  Pairing Code - Enter code in WhatsApp\n");
    rl.question("Choose method (1 or 2): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Ask for phone number
function askPhoneNumber() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Enter phone number with country code (e.g. 2547XXXXXXXX): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Ask for session ID (for multi-user support)
function askSessionId() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // List existing sessions
    const existing = fs.readdirSync(SESSIONS_DIR);
    if (existing.length > 0) {
      console.log("\n📂 Existing sessions:");
      existing.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
    }

    rl.question("\nEnter session name (e.g. user1 or your name): ", (answer) => {
      rl.close();
      resolve(answer.trim() || "default");
    });
  });
}

async function startSession(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  let usePairingCode = false;
  let phoneNumber = "";

  if (!state.creds.registered) {
    const method = await askLinkingMethod();
    if (method === "2") {
      usePairingCode = true;
      phoneNumber = await askPhoneNumber();
    }
  }

  const socket = makeWASocket({
    auth: state,
    printQRInTerminal: !usePairingCode,
    logger: require("pino")({ level: "silent" }),
    markOnlineOnConnect: true
  });

  // Generate pairing code
  if (usePairingCode && !state.creds.registered) {
    await delay(2000);
    try {
      const code = await socket.requestPairingCode(phoneNumber);
      console.log("\n╔══════════════════════════════════════╗");
      console.log(`   🔑 PAIRING CODE: ${code}            `);
      console.log("╚══════════════════════════════════════╝");
      console.log("\n📱 Steps:");
      console.log("1. Open WhatsApp");
      console.log("2. Go to Linked Devices");
      console.log("3. Tap Link a Device");
      console.log("4. Tap 'Link with phone number instead'");
      console.log("5. Enter the code above\n");
    } catch (e) {
      console.error("❌ Pairing code error:", e.message);
    }
  }

  socket.ev.on("creds.update", saveCreds);

  // Feature: Anti-Call
  socket.ev.on("call", async (inboundCall) => {
    for (let call of inboundCall) {
      if (call.status === "offer") {
        await socket.rejectCall(call.id, call.from);
        console.log(`🚫 [${sessionId}] AntiCall: ${call.from} dropped.`);
      }
    }
  });

  socket.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const msg = chatUpdate.messages[0];
      if (!msg || !msg.message) return;

      const sender = msg.key.remoteJid;
      const isStatus = sender === "status@broadcast";
      const name = msg.pushName || "User";
      const msgId = msg.key.id;
      const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      // Feature: Auto View & Like Status
      if (isStatus) {
        await socket.readMessages([msg.key]);
        await socket.sendMessage(sender, { react: { text: "❤️", key: msg.key } }, { statusJidList: [msg.key.participant] });
        return;
      }

      if (msg.key.fromMe) return;

      // Feature: Auto Read Messages
      await socket.readMessages([msg.key]);

      if (body) {
        await apiClient.post(`/log-message`, { msg_id: msgId, sender, name, body }).catch(() => {});
      }

      // Feature: Save View Once Media
      const viewOnceModel = msg.message.viewOnceMessage?.message || msg.message.viewOnceMessageV2?.message;
      if (viewOnceModel) {
        await socket.sendMessage(socket.user.id, { text: `📸 *View Once From ${name} (${sender}):*` });
        await socket.forwardMessage(socket.user.id, msg);
      }

      // Feature: Auto Save Contacts & Welcome Message
      const registry = await apiClient.post(`/auto-save`, { sender, name }).catch(() => null);
      if (registry && registry.data.status === "new_user_registered") {
        await socket.sendMessage(sender, { text: registry.data.welcome_message });
        return;
      }

      // Feature: Auto React
      if (body) {
        const sentiment = await apiClient.post(`/react`, { body }).catch(() => null);
        if (sentiment && sentiment.data.emoji) {
          await socket.sendMessage(sender, { react: { text: sentiment.data.emoji, key: msg.key } });
        }
      }

      // Core Command Handler
      if (body.startsWith("/")) {
        // Feature: Anti-Ban Mode
        await delay(Math.floor(Math.random() * (2600 - 1100 + 1)) + 1100);

        // Feature: Fake Typing / Recording
        const simulatedPresenceState = body.startsWith("/download_song") ? "recording" : "composing";
        await socket.sendPresenceUpdate(simulatedPresenceState, sender);

        const response = await apiClient.post(`/webhook`, { body, sender }).catch((e) => ({
          data: { reply: `❌ Error: ${e.message}` }
        }));

        await socket.sendPresenceUpdate("paused", sender);

        if (response.data.reply) {
          await socket.sendMessage(sender, { text: response.data.reply });
        }
      }
    } catch (error) {
      console.error(`❌ [${sessionId}] Exception:`, error.message);
    }
  });

  // Feature: Auto Bio Update
  setInterval(async () => {
    try {
      const bioResponse = await apiClient.get(`/get-bio`);
      await socket.updateProfileStatus(bioResponse.data.bio);
    } catch (e) {}
  }, 60000);

  // Auto Reconnect
  socket.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect.error instanceof Boom) ?
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
      if (shouldReconnect) {
        console.log(`🔄 [${sessionId}] Reconnecting...`);
        startSession(sessionId);
      } else {
        console.log(`🚪 [${sessionId}] Logged out. Restart to relink.`);
      }
    } else if (connection === "open") {
      console.log(`🚀 [${sessionId}] SHARK BOT ONLINE AND READY.`);
    }
  });
}

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("   🦈 SHARK BOT - HENRY TECH V5.0 🦈   ");
  console.log("╚══════════════════════════════════════╝\n");

  const sessionId = await askSessionId();
  console.log(`\n✅ Starting session: ${sessionId}`);
  await startSession(sessionId);
}

main();
