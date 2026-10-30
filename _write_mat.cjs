const fs = require('fs')
const out = process.argv[2]
const content = String.raw`
REPLACE_ME
`
fs.writeFileSync(out, content.trimStart().replace(/\n/g, '\r\n'))
console.log('wrote', out, content.length)
