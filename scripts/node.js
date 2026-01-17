const { generateKeyPairSync } = require("crypto")
const fs = require("fs")
const path = require("path")

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
})

// where to save
const outDir = path.join(__dirname, "keys")
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)

fs.writeFileSync(path.join(outDir, "public.pem"), publicKey)
fs.writeFileSync(path.join(outDir, "private.pem"), privateKey)

console.log("✅ RSA keys generated")
console.log("📄 keys/public.pem  (safe for frontend)")
console.log("🔐 keys/private.pem (KEEP SECRET)")
