import React, { useRef, useState } from 'react'

export const VideoMessagePlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isHovered, setIsHovered] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1
    videoRef.current.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    const nextMuted = !isMuted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
  }

  return (
    <div 
      className="relative group cursor-pointer inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video Container */}
      <div 
        className="w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-4 border-transparent hover:border-[#0078d4]/50 transition-colors shadow-md bg-black relative"
        onClick={toggleMute}
      >
        <video 
          ref={videoRef}
          src={src} 
          className="w-full h-full object-cover" 
          autoPlay 
          loop 
          muted={isMuted} 
          playsInline 
        />
        
        {/* Mute/Unmute Indicator */}
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          {isMuted ? 'Tap to unmute' : 'Tap to mute'}
        </div>
      </div>
      
      {/* Speed Control Button - Placed outside the overflow-hidden container */}
      <div 
        className={`absolute top-0 right-0 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-bold w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} hover:bg-black hover:scale-110 shadow-xl border border-white/10 z-10`}
        onClick={toggleSpeed}
      >
        {playbackRate}x
      </div>
    </div>
  )
}
