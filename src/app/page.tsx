'use client'

import React, { useEffect, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { CallOverlay } from '@/components/CallOverlay'
import { useAppStore } from '@/store/useAppStore'
import { useWebRTC } from '@/hooks/useWebRTC'

export default function Home() {
  const { currentUser } = useAppStore()
  
  // We use WebRTC hook with current User ID
  const webrtc = useWebRTC(currentUser?.id || null)

  // A very basic Auth mock for the UI demo purposes before connecting the real login screen.
  // Normally you'd wrap this in an AuthGuard.
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f2f1] dark:bg-[#201f1e]">
        <div className="p-8 bg-white dark:bg-[#323130] rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto bg-[#0078d4] text-white rounded-full flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M23.993 12.446c-.035-1.127-.247-2.224-.627-3.265-.187-.512-.39-1.02-.622-1.517-.552-1.182-1.23-2.277-2.023-3.268-1.066-1.332-2.35-2.433-3.816-3.267-1.472-.84-3.08-1.378-4.78-1.597-1.745-.224-3.528-.088-5.234.394-1.637.462-3.176 1.184-4.57 2.143-1.458 1.002-2.73 2.257-3.766 3.73-1.01 1.436-1.765 3.056-2.235 4.802-.455 1.69-.597 3.447-.417 5.17.18 1.732.697 3.407 1.53 4.975.818 1.537 1.884 2.912 3.167 4.073 1.258 1.14 2.71 2.052 4.3 2.702 1.564.64 3.228 1.006 4.945 1.085 1.758.08 3.515-.125 5.21-.607 1.637-.466 3.17-1.196 4.554-2.164 1.442-.998 2.705-2.247 3.733-3.712.982-1.4 1.716-2.97 2.176-4.665.443-1.635.586-3.342.475-5.01zm-13.435 6.096c-2.825.04-5.367-1.04-7.143-3.06-1.68-1.91-2.486-4.48-2.26-7.234.198-2.42 1.34-4.663 3.224-6.31 1.847-1.615 4.316-2.432 6.945-2.302 2.723.134 5.253 1.353 7.122 3.433 1.763 1.96 2.553 4.588 2.222 7.4-.306 2.6-1.583 4.965-3.593 6.657-1.897 1.597-4.417 2.37-7.16 2.365z"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in to Skype</h1>
          <p className="text-gray-500 mb-6">You need to connect to the backend first.</p>
          {/* Note: This is a placeholder. In Phase 5 you would use the actual login form. */}
          <button onClick={() => window.location.href = '/login'} className="w-full py-2 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-full font-medium transition">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

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
