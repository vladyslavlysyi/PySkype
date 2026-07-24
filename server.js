const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Setup Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  // We need to use typescript compiled version or ts-node for socket handler
  // Since server.js is plain node, we can import the transpiled socketHandler
  // But for development with Next.js, it's easier to write the logic here or use a bundler.
  // We'll keep it inline for simplicity in server.js or require it if compiled.
  // Let's implement basic socket logic here if transpilation is complex, 
  // or use ts-node register (not recommended for prod).
  
  // To keep it simple and production ready, let's just initialize the handler using standard CommonJS.
  // Note: in a real Next app, `src/socket/socketHandler.ts` should be compiled to `.js`.
  // Here we use a dynamic import workaround or just write it natively if needed.
  // Assuming tsx or ts-node is used for custom server, but let's just use plain node if possible.
  
  // Because we run `node server.js`, we need to make sure Prisma and JWT work.
  // Actually, since Next.js compiles the app but not server.js, let's keep socket logic separate.
  // For this generated code, we will mock the import of setupSocketHandlers:
  // (In production, you'd run `tsc` on socketHandler.ts first, or run `ts-node server.ts`)
  
  // Here is the JS version of Socket Handler to guarantee it runs out of the box with `node server.js`:
  const jwt = require('jsonwebtoken')
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key'

  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('Authentication error'))
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      socket.userId = decoded.userId
      next()
    } catch (err) {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.userId
    console.log(`[Socket] User connected: ${userId}`)
    socket.join(userId)
    
    await prisma.user.update({ where: { id: userId }, data: { status: 'ONLINE' } })
    socket.broadcast.emit('user-status-changed', { userId, status: 'ONLINE' })

    socket.on('send-message', async (data) => {
      try {
        const message = await prisma.message.create({
          data: { text: data.text, senderId: userId, conversationId: data.conversationId },
          include: { sender: { select: { id: true, username: true, avatarUrl: true } } }
        })
        const allParticipants = [...data.receiverIds, userId]
        allParticipants.forEach(id => io.to(id).emit('receive-message', message))
      } catch (error) {
        console.error('Socket send-message error:', error)
      }
    })

    socket.on('update-status', async (status) => {
      await prisma.user.update({ where: { id: userId }, data: { status } })
      io.emit('user-status-changed', { userId, status })
    })

    socket.on('call-user', (data) => {
      io.to(data.userToCall).emit('incoming-call', { from: userId, signal: data.signalData, isVideo: data.isVideo })
    })

    socket.on('answer-call', (data) => io.to(data.to).emit('call-accepted', { signal: data.signal }))
    socket.on('ice-candidate', (data) => io.to(data.targetUserId).emit('ice-candidate-received', { candidate: data.candidate, from: userId }))
    socket.on('end-call', (data) => io.to(data.to).emit('call-ended'))
    socket.on('reject-call', (data) => io.to(data.to).emit('call-rejected'))

    socket.on('disconnect', async () => {
      console.log(`[Socket] User disconnected: ${userId}`)
      await prisma.user.update({ where: { id: userId }, data: { status: 'OFFLINE', updatedAt: new Date() } })
      io.emit('user-status-changed', { userId, status: 'OFFLINE' })
    })
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
