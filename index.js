const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const ytdl = require("ytdl-core")
const yts = require("yt-search")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    auth: state,
    version
  })

  sock.ev.on("creds.update", saveCreds)

  // ===== PAIRING =====
  if (!sock.authState?.creds?.registered) {
    rl.question("📱 Masukkan nomor WA (628xxx): ", async (number) => {
      number = number.replace(/[^0-9]/g, "")
      const code = await sock.requestPairingCode(number)
      console.log(`\n🔗 Pairing Code: ${code}\n`)
    })
  }

  // ===== MESSAGE =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0]
      if (!msg.message) return

      const from = msg.key.remoteJid
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ""

      // ===== .play =====
      if (text.startsWith(".play ")) {
        const query = text.slice(6)

        await sock.sendMessage(from, { text: "🔎 Mencari lagu..." })

        const search = await yts(query)
        const video = search.videos[0]

        if (!video) {
          return sock.sendMessage(from, {
            text: "❌ Lagu tidak ditemukan"
          })
        }

        const filePath = path.join(__dirname, "audio.mp3")

        await sock.sendMessage(from, {
          text: `⬇️ Download...\n🎵 ${video.title}`
        })

        await new Promise((resolve, reject) => {
          ytdl(video.url, {
            filter: "audioonly",
            quality: "highestaudio"
          })
            .pipe(fs.createWriteStream(filePath))
            .on("finish", resolve)
            .on("error", reject)
        })

        await sock.sendMessage(from, {
          audio: fs.readFileSync(filePath),
          mimetype: "audio/mpeg"
        })

        fs.unlinkSync(filePath)
      }
    } catch (err) {
      console.log(err)
    }
  })
}

startBot()
