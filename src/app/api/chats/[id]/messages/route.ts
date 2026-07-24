import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)

    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const conversationId = params.id

    // Check if user is part of the conversation
    const isParticipant = await prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId: decoded.userId,
          conversationId
        }
      }
    })

    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    
    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: 50,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor }
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true }
        }
      }
    })

    return NextResponse.json({ messages: messages.reverse() })
  } catch (error) {
    console.error('Fetch Messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
