import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key'

interface UserSocket extends Socket {
  userId?: string
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use((socket: UserSocket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication error'))
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      socket.userId = decoded.userId
      next()
    } catch (err) {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', async (socket: UserSocket) => {
    const userId = socket.userId!
    console.log(`User connected: ${userId}`)

    // Join personal room
    socket.join(userId)

    // Update status to ONLINE
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ONLINE' }
    })
    socket.broadcast.emit('user-status-changed', { userId, status: 'ONLINE' })

    // Chat Events
    socket.on('send-message', async (data: { conversationId: string, text: string, receiverIds: string[] }) => {
      try {
        const message = await prisma.message.create({
          data: {
            text: data.text,
            senderId: userId,
            conversationId: data.conversationId
          },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true } }
          }
        })

        // Emit to all receivers and the sender
        const allParticipants = [...data.receiverIds, userId]
        allParticipants.forEach(id => {
          io.to(id).emit('receive-message', message)
        })
      } catch (error) {
        console.error('Socket send-message error:', error)
      }
    })

    socket.on('update-status', async (status: string) => {
      await prisma.user.update({
        where: { id: userId },
        data: { status: status as any }
      })
      io.emit('user-status-changed', { userId, status })
    })

    // WebRTC Signaling Events
    socket.on('call-user', (data: { userToCall: string, signalData: any, isVideo: boolean }) => {
      io.to(data.userToCall).emit('incoming-call', {
        from: userId,
        signal: data.signalData,
        isVideo: data.isVideo
      })
    })

    socket.on('answer-call', (data: { to: string, signal: any }) => {
      io.to(data.to).emit('call-accepted', { signal: data.signal })
    })

    socket.on('ice-candidate', (data: { targetUserId: string, candidate: any }) => {
      io.to(data.targetUserId).emit('ice-candidate-received', {
        candidate: data.candidate,
        from: userId
      })
    })

    socket.on('end-call', (data: { to: string }) => {
      io.to(data.to).emit('call-ended')
    })
    
    socket.on('reject-call', (data: { to: string }) => {
      io.to(data.to).emit('call-rejected')
    })

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`)
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'OFFLINE', updatedAt: new Date() }
      })
      io.emit('user-status-changed', { userId, status: 'OFFLINE' })
    })
  })
}
