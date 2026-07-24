'use client'

import React from 'react'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

interface CallOverlayProps {
  localVideoRef: React.RefObject<HTMLVideoElement>
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  isCalling: boolean
  isReceivingCall: boolean
  callAccepted: boolean
  isVideoCall: boolean
  callerId: string | null
  answerCall: () => void
  rejectCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleVideo: () => void
}

export const CallOverlay = ({
  localVideoRef,
  remoteVideoRef,
  isCalling,
  isReceivingCall,
  callAccepted,
  isVideoCall,
  callerId,
  answerCall,
  rejectCall,
  endCall,
  toggleMute,
  toggleVideo
}: CallOverlayProps) => {
  const { currentUser, searchResults, conversations } = useAppStore()
  const [isMuted, setIsMuted] = React.useState(false)
  const [isVideoOff, setIsVideoOff] = React.useState(!isVideoCall)

  // Find caller name if possible
  let callerName = 'Unknown Caller'
  if (callerId) {
    const fromSearch = searchResults.find(u => u.id === callerId)
    const fromConvs = conversations.flatMap(c => c.participants).find(p => p.user.id === callerId)?.user
    if (fromSearch) callerName = fromSearch.username
    else if (fromConvs) callerName = fromConvs.username
  }

  const handleMute = () => {
    toggleMute()
    setIsMuted(!isMuted)
  }

  const handleVideo = () => {
    toggleVideo()
    setIsVideoOff(!isVideoOff)
  }

  if (isReceivingCall && !callAccepted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-[#201f1e] p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-gray-700 rounded-full mb-6 flex items-center justify-center">
            <span className="text-4xl text-white font-bold">{callerName.charAt(0)}</span>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">{callerName}</h2>
          <p className="text-gray-400 mb-8">{isVideoCall ? 'Incoming Video Call...' : 'Incoming Audio Call...'}</p>
          
          <div className="flex gap-6">
            <button 
              onClick={rejectCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
            <button 
              onClick={answerCall}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition shadow-lg shadow-green-500/20"
            >
              {isVideoCall ? <Video className="w-8 h-8 text-white" /> : <Phone className="w-8 h-8 text-white" />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isCalling || callAccepted) {
    return (
      <div className="fixed inset-0 z-50 bg-[#11100f] flex flex-col">
        {/* Main Video Area */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {/* We must always render the video element to play incoming audio, just hide it if video is off */}
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover ${(!isVideoCall || isVideoOff || !callAccepted) ? 'hidden' : ''}`}
          />
          
          {(!isVideoCall || isVideoOff || !callAccepted) && (
            <div className="w-40 h-40 bg-gray-800 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-6xl text-white font-bold">{callAccepted ? callerName.charAt(0).toUpperCase() : '...'}</span>
            </div>
          )}

          {/* PIP Local Video */}
          {(isVideoCall && !isVideoOff) && (
            <div className="absolute bottom-6 right-6 w-48 h-72 bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 z-10 transition-transform hover:scale-105">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            </div>
          )}

          {/* Calling State Overlay */}
          {!callAccepted && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <h2 className="text-2xl font-semibold text-white shadow-sm">Calling...</h2>
            </div>
          )}
        </div>

        {/* Control Bar */}
        <div className="h-24 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 w-full flex items-center justify-center gap-6 pb-6">
          <button 
            onClick={handleMute}
            className={`p-4 rounded-full transition shadow-lg ${isMuted ? 'bg-white text-black' : 'bg-gray-800/80 text-white hover:bg-gray-700'}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button 
            onClick={handleVideo}
            className={`p-4 rounded-full transition shadow-lg ${isVideoOff ? 'bg-white text-black' : 'bg-gray-800/80 text-white hover:bg-gray-700'}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>

          <button 
            onClick={endCall}
            className="p-4 px-8 rounded-full bg-red-500 hover:bg-red-600 transition shadow-lg shadow-red-500/20 text-white flex items-center gap-2"
          >
            <PhoneOff className="w-6 h-6" />
            <span className="font-medium">Leave</span>
          </button>
        </div>
      </div>
    )
  }

  return null
}
