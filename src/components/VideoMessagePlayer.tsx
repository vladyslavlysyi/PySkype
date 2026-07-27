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
      className="w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-4 border-transparent hover:border-[#0078d4]/50 transition-colors shadow-md bg-black relative group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
      
      {/* Speed Control Button */}
      <div 
        className={`absolute top-4 right-4 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'} hover:bg-black/80`}
        onClick={toggleSpeed}
      >
        {playbackRate}x
      </div>

      {/* Mute/Unmute Indicator */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        {isMuted ? 'Tap to unmute' : 'Tap to mute'}
      </div>
    </div>
  )
}
