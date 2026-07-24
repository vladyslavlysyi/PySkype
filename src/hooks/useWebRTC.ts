'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useWebSocket } from '@/contexts/WebSocketContext'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export function useWebRTC(currentUserId: string | null, activeConversationId: string | null = null) {
  const { isConnected, sendMessage, subscribe } = useWebSocket()
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  
  const [isCalling, setIsCalling] = useState(false)
  const [isReceivingCall, setIsReceivingCall] = useState(false)
  const [callerId, setCallerId] = useState<string | null>(null)
  const [callerSignal, setCallerSignal] = useState<any>(null)
  const [callAccepted, setCallAccepted] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [isVideoCall, setIsVideoCall] = useState(true)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)
  const [isCaller, setIsCaller] = useState(false)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  // 1. Listen for incoming calls & WebRTC signaling
  useEffect(() => {
    if (!isConnected || !currentUserId) return

    const unsubIncoming = subscribe('incoming_call', (payload) => {
      setIsReceivingCall(true)
      setCallerId(payload.from)
      setCallerSignal(payload.sdp)
      setIsVideoCall(payload.is_video)
    })

    const unsubAccepted = subscribe('call_accepted', async (payload) => {
      setCallAccepted(true)
      setCallStartTime(Date.now())
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp))
      }
    })

    const unsubIce = subscribe('ice_candidate_received', async (payload) => {
      try {
        if (peerConnectionRef.current && payload.candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
        }
      } catch (e) {
        console.error('Error adding received ice candidate', e)
      }
    })

    const unsubEnded = subscribe('call_ended', () => {
      endCall(false)
    })

    const unsubRejected = subscribe('call_rejected', () => {
      endCall(false)
      alert('Користувач відхилив виклик')
    })

    return () => {
      unsubIncoming()
      unsubAccepted()
      unsubIce()
      unsubEnded()
      unsubRejected()
    }
  }, [isConnected, currentUserId, subscribe])

  // Attach streams to video elements automatically
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

    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0])
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage('ice_candidate', { candidate: event.candidate }, targetUserId)
      }
    }

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
    try {
      setIsVideoCall(video)
      const stream = await getMediaStream(video)
      const pc = createPeerConnection(userToCall, stream)
      
      setIsCalling(true)
      setIsCaller(true)
      setCallerId(userToCall)
      setCallEnded(false)

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      sendMessage('call_offer', {
        sdp: offer,
        is_video: video
      }, userToCall)
      
    } catch (err) {
      alert('Не вдалося отримати доступ до камери або мікрофону')
    }
  }

  // 3. Answer Call
  const answerCall = async () => {
    if (!callerId || !callerSignal) return

    try {
      const stream = await getMediaStream(isVideoCall)
      setCallAccepted(true)
      setCallStartTime(Date.now())
      setIsReceivingCall(false)
      setIsCaller(false)
      setCallEnded(false)

      const pc = createPeerConnection(callerId, stream)

      await pc.setRemoteDescription(new RTCSessionDescription(callerSignal))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      sendMessage('call_answer', { sdp: answer }, callerId)
    } catch (err) {
      alert('Не вдалося отримати доступ до медіа-пристроїв')
    }
  }

  // 4. Reject Call
  const rejectCall = () => {
    if (callerId) {
      sendMessage('reject_call', {}, callerId)
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
    
    let duration = 0
    if (callStartTime) {
      duration = Math.floor((Date.now() - callStartTime) / 1000)
    }

    if (emitSocketEvent && callerId) {
      sendMessage('end_call', {}, callerId)
      
      if (isCaller && duration > 0 && activeConversationId) {
        const m = Math.floor(duration / 60)
        const s = duration % 60
        sendMessage('send_message', {
          conversation_id: activeConversationId,
          content: `📞 Дзвінок завершено. Тривалість: ${m} хв ${s} сек`
        }, callerId)
      }
    }
    
    setCallerId(null)
    setCallerSignal(null)
    setCallStartTime(null)
  }, [callerId, localStream, sendMessage, callStartTime, activeConversationId])

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
