import {Server as WebSocketServer} from 'ws'
import net from 'net'
import nconf from 'nconf'

nconf
  .argv()
  .env('__')
  .defaults({
    port: 4223,
    noDelay: false,
    nats: {
      host: 'localhost',
      port: 4222
    }
  })

const port = nconf.get('port')
const noDelay = nconf.get('noDelay')
const wss = new WebSocketServer({port})

console.log(`Listening on port ${port}`)

// TODO Fix crash bug when user disconnects too early

wss.on('connection', ws => {
  const address = ws._socket.remoteAddress
  console.log(`[${address}] Client connected`)
  ws._socket && ws._socket.setNoDelay && ws._socket.setNoDelay(noDelay)

  // Connect to nats server, forward data to websocket
  const nats = net.connect(nconf.get('nats'))
  nats.setEncoding('utf8')
  nats.setNoDelay(true)
  nats.on('data', data => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data)
    }
  })
  nats.on('connect', () => {
    console.log(`[${address}] Connected to nats`)
  })
  nats.on('close', () => {
    console.log(`[${address}] Disconnected from nats`)
    ws.close()
  })
  nats.on('error', err => {
    console.error(`[${address}] Nats error`, err)
    ws.close()
  })

  // Forward messages from client to nats server
  ws.on('message', message => {
    if (nats.readyState === nats.OPEN) {
      nats.write(message)
    }
  })
  ws.on('close', () => {
    console.log(`[${address}] Client disconnected`)
    nats.end()
  })
  ws.on('error', err => {
    console.error(`[${address}] Client error`, err)
    nats.end()
  })
})
