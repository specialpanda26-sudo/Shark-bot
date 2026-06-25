const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const axios = require("axios");
const readline = require("readline");

const BACKEND_URL = "http://127.0.0.1:5000";

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 25000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});

// Ask user which linking method to use
function askLinkingMethod() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n╔══════════════════════════════════════╗");
    console.log("   HENRY TECH V5.0 - LINKING METHOD    ");
    console.log("╚══════════════════════════════════════╝\n");
    console.log("1️⃣  QR Code - Scan with WhatsApp camera");
    console.log("2️⃣  Pairing Code - Enter code in WhatsApp\n");
    rl.question("Choose method (1 or 2): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Ask for phone number (for pairing code)
function askPhoneNumber() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Enter your phone number with country code (e.g. 2547XXXXXXXX): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function startHenryTechV5() {
  const { state, saveCreds } = await useMultiFileAuthState("henry_v5_auth_session");

  // Ask linking method only if not already registered
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
    printQRInTerminal: !usePairingCode, // Show QR if not using pairing code
    logger: require("pino")({ level: "silent" }),
    markOnlineOnConnect: true
  });

  // Generate pairing code if chosen
  if (usePairingCode && !state.creds.registered) {
    await delay(2000);
    try {
      const code = await socket.requestPairingCode(phoneNumber);
      console.log("\n╔══════════════════════════════════════╗");
      console.log("   🔑 YOUR PAIRING CODE: " + code + "     ");
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
        console.log(`🚫 AntiCall: ${call.from} intercepted and dropped.`);
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
        await socket.sendMessage(socket.user.id, { text: `📸 *View Once Asset From ${name} (${sender}):*` });
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
        // Feature: Anti-Ban Mode (random delay)
        await delay(Math.floor(Math.random() * (2600 - 1100 + 1)) + 1100);

        // Feature: Fake Typing / Fake Recording
        const simulatedPresenceState = body.startsWith("/download_song") ? "recording" : "composing";
        await socket.sendPresenceUpdate(simulatedPresenceState, sender);

        const response = await apiClient.post(`/webhook`, { body, sender }).catch((e) => ({
          data: { reply: `❌ Core Webhook Error: ${e.message}` }
        }));

        await socket.sendPresenceUpdate("paused", sender);

        if (response.data.reply) {
          await socket.sendMessage(sender, { text: response.data.reply });
        }
      }
    } catch (error) {
      console.error("❌ Critical Exception:", error.message);
    }
  });

  // Feature: Auto Bio Update every 60 seconds
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
        console.log("🔄 Reconnecting...");
        startHenryTechV5();
      } else {
        console.log("🚪 Logged out. Please restart and relink.");
      }
    } else if (connection === "open") {
      console.log("🚀 HENRY TECH V5.0 ONLINE AND READY.");
    }
  });
}

startHenryTechV5();
