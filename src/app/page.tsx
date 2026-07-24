'use client'

import React, { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { CallOverlay } from '@/components/CallOverlay'
import { useAppStore } from '@/store/useAppStore'
import { useWebRTC } from '@/hooks/useWebRTC'

export default function Home() {
  const { currentUser, activeConversation } = useAppStore()
  
  // We use WebRTC hook with current User ID
  const webrtc = useWebRTC(currentUser?.id || null, activeConversation?.id || null)

  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || !currentUser) return null

  const handleStartCall = (video: boolean) => {
    // Determine the target user from active conversation
    const activeConversation = useAppStore.getState().activeConversation
    const partner = activeConversation?.participants.find(p => p.user.id !== currentUser.id)?.user
    if (partner) {
      webrtc.callUser(partner.id, video)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden antialiased bg-white dark:bg-[#11100f] text-gray-900 dark:text-white">
      
      {/* Skype Sidebar */}
      <Sidebar />
      
      {/* Main Chat Area */}
      <ChatArea onStartCall={handleStartCall} />

      {/* WebRTC Call Overlay */}
      <CallOverlay 
        localVideoRef={webrtc.localVideoRef}
        remoteVideoRef={webrtc.remoteVideoRef}
        isCalling={webrtc.isCalling}
        isReceivingCall={webrtc.isReceivingCall}
        callAccepted={webrtc.callAccepted}
        isVideoCall={webrtc.isVideoCall}
        callerId={webrtc.callerId}
        answerCall={webrtc.answerCall}
        rejectCall={webrtc.rejectCall}
        endCall={webrtc.endCall}
        toggleMute={webrtc.toggleMute}
        toggleVideo={webrtc.toggleVideo}
      />
    </div>
  )
}
