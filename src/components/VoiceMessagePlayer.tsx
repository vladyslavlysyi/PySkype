'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'

interface VoiceMessagePlayerProps {
  src: string
}

export const VoiceMessagePlayer = ({ src }: VoiceMessagePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [playbackRate, setPlaybackRate] = useState(1)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime
      const total = audioRef.current.duration
      setCurrentTime(formatTime(current))
      setProgress((current / total) * 100)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      if (audioRef.current.duration === Infinity || isNaN(audioRef.current.duration)) {
        // Handle webm duration issue in some browsers
        audioRef.current.currentTime = 1e101
        audioRef.current.addEventListener('timeupdate', function getDuration() {
          if (audioRef.current) {
            audioRef.current.currentTime = 0
            setDuration(formatTime(audioRef.current.duration))
            audioRef.current.removeEventListener('timeupdate', getDuration)
          }
        })
      } else {
        setDuration(formatTime(audioRef.current.duration))
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = (Number(e.target.value) / 100) * audioRef.current.duration
      audioRef.current.currentTime = newTime
      setProgress(Number(e.target.value))
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }

  const toggleSpeed = () => {
    setPlaybackRate(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1)
  }

  return (
    <div className="flex items-center gap-3 w-48 sm:w-60 h-10 select-none">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
      
      <button 
        onClick={togglePlay} 
        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-white text-[#0078d4] rounded-full hover:bg-gray-100 transition-colors shadow-sm"
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        {/* Custom progress slider */}
        <div className="relative w-full h-1.5 bg-white/30 rounded-full mb-1 group cursor-pointer">
          <div 
            className="absolute top-0 left-0 h-full bg-white rounded-full"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Knob indicator on hover */}
          <div 
            className="absolute top-1/2 -mt-1.5 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-white/80 font-medium">
          <span>{currentTime}</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleSpeed}
              className="bg-white/20 hover:bg-white/30 text-white rounded px-1.5 py-0.5 transition-colors"
            >
              {playbackRate}x
            </button>
            <span>{duration}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
