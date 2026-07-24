'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSocket } from '@/contexts/SocketContext'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
    // TURN servers should be added here for production
  ]
}

export function useWebRTC(currentUserId: string | null) {
  const { socket } = useSocket()
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  
  const [isCalling, setIsCalling] = useState(false)
  const [isReceivingCall, setIsReceivingCall] = useState(false)
  const [callerId, setCallerId] = useState<string | null>(null)
  const [callerSignal, setCallerSignal] = useState<any>(null)
  const [callAccepted, setCallAccepted] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [isVideoCall, setIsVideoCall] = useState(true)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  // 1. Listen for incoming calls & WebRTC signaling from Socket
  useEffect(() => {
    if (!socket || !currentUserId) return

    socket.on('incoming-call', ({ from, signal, isVideo }) => {
      setIsReceivingCall(true)
      setCallerId(from)
      setCallerSignal(signal)
      setIsVideoCall(isVideo)
    })

    socket.on('call-accepted', async ({ signal }) => {
      setCallAccepted(true)
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal))
      }
    })

    socket.on('ice-candidate-received', async ({ candidate }) => {
      try {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
        }
      } catch (e) {
        console.error('Error adding received ice candidate', e)
      }
    })

    socket.on('call-ended', () => {
      endCall(false) // false because it was ended remotely
    })

    socket.on('call-rejected', () => {
      endCall(false)
      alert('Користувач відхилив виклик')
    })

    return () => {
      socket.off('incoming-call')
      socket.off('call-accepted')
      socket.off('ice-candidate-received')
      socket.off('call-ended')
      socket.off('call-rejected')
    }
  }, [socket, currentUserId])

  // Attach streams to video elements automatically when they change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // Helper: Get User Media (Camera/Mic)
  const getMediaStream = async (video: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true })
      setLocalStream(stream)
      return stream
    } catch (err) {
      console.error('Failed to get local stream', err)
      throw err
    }
  }

  // Helper: Create RTCPeerConnection and attach events
  const createPeerConnection = (targetUserId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)

    // Add local tracks to PeerConnection
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    // Listen for remote tracks
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0])
    }

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          targetUserId,
          candidate: event.candidate
        })
      }
    }

    // Connection state changes
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall(false)
      }
    }

    peerConnectionRef.current = pc
    return pc
  }

  // 2. Initiate Call
  const callUser = async (userToCall: string, video: boolean = true) => {
    if (!socket) return

    try {
      setIsVideoCall(video)
      const stream = await getMediaStream(video)
      const pc = createPeerConnection(userToCall, stream)
      
      setIsCalling(true)
      setCallEnded(false)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      socket.emit('call-user', {
        userToCall,
        signalData: offer,
        isVideo: video
      })
    } catch (err) {
      alert('Не вдалося отримати доступ до камери або мікрофону')
    }
  }

  // 3. Answer Call
  const answerCall = async () => {
    if (!socket || !callerId || !callerSignal) return

    try {
      const stream = await getMediaStream(isVideoCall)
      setCallAccepted(true)
      setIsReceivingCall(false)
      setCallEnded(false)

      const pc = createPeerConnection(callerId, stream)

      await pc.setRemoteDescription(new RTCSessionDescription(callerSignal))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socket.emit('answer-call', {
        to: callerId,
        signal: answer
      })
    } catch (err) {
      alert('Не вдалося отримати доступ до медіа-пристроїв')
    }
  }

  // 4. Reject Call
  const rejectCall = () => {
    if (socket && callerId) {
      socket.emit('reject-call', { to: callerId })
    }
    setIsReceivingCall(false)
    setCallerId(null)
    setCallerSignal(null)
  }

  // 5. End Call
  const endCall = useCallback((emitSocketEvent = true) => {
    setCallEnded(true)
    setIsCalling(false)
    setIsReceivingCall(false)
    setCallAccepted(false)

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    setRemoteStream(null)

    if (emitSocketEvent && socket) {
      // Find the remote user we are talking to
      const targetUserId = callerId // Simplification: we might need exact target depending on who called
      if (targetUserId) {
        socket.emit('end-call', { to: targetUserId })
      }
    }
    
    setCallerId(null)
    setCallerSignal(null)
  }, [socket, callerId, localStream])

  // Call Controls
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
      }
    }
  }

  return {
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    isCalling,
    isReceivingCall,
    callerId,
    callAccepted,
    callEnded,
    isVideoCall,
    callUser,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo
  }
}
