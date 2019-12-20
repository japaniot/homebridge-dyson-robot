const crypto = require('crypto')
const https = require('https')
const fetch = require('node-fetch')

module.exports = {getDevices}

async function getDevices(email, password, country = 'US') {
  const DYSON_API_URL = country === 'CN' ? 'appapi.cp.dyson.cn'
                                         : 'appapi.cp.dyson.com'
  const agent = new https.Agent({rejectUnauthorized: false})
  let res = await fetch(`https://${DYSON_API_URL}/v1/userregistration/authenticate?country=${country}`, {
    agent,
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({Email: email, Password: password}),
  })
  const credentials = await res.json()

  res = await fetch(`https://${DYSON_API_URL}/v2/provisioningservice/manifest`, {
    agent,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Basic ' + Buffer.from(credentials.Account + ':' + credentials.Password).toString('base64')
    },
  })
  const devices = await res.json()
  return devices.map((device) => {
    if (device.LocalCredentials)
      device.Password = JSON.parse(decryptPassword(device.LocalCredentials)).apPasswordHash
    return device
  })
}

// Adapted from: https://github.com/CharlesBlonde/libpurecoollink/blob/master/libpurecoollink/utils.py
function decryptPassword(encryptedPassword) {
  let key = Uint8Array.from(Array(32), (val, index) => index + 1)
  let init_vector = new Uint8Array(16)
  var decipher = crypto.createDecipheriv('aes-256-cbc', key, init_vector)
  var decryptedPassword = decipher.update(encryptedPassword, 'base64', 'utf8')
  decryptedPassword = decryptedPassword + decipher.final('utf8')
  return decryptedPassword
}
