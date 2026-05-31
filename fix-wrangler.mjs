import fs from "node:fs"

const path = "dist/server/wrangler.json"
const accountId = "39d64384d3fff54c939db0e86573000d"

if (!fs.existsSync(path)) {
  console.error(`File tidak ditemukan: ${path}`)
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(path, "utf8"))

config.account_id = accountId

fs.writeFileSync(path, JSON.stringify(config, null, 2))

console.log(`Account ID berhasil ditambahkan ke ${path}`)