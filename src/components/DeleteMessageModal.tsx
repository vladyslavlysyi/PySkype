import React, { useState } from 'react'
import { X, Trash2 } from 'lucide-react'

interface DeleteMessageModalProps {
  count: number
  hasOwnMessages: boolean
  onClose: () => void
  onConfirm: (forEveryone: boolean) => void
}

export const DeleteMessageModal = ({ count, hasOwnMessages, onClose, onConfirm }: DeleteMessageModalProps) => {
  const [forEveryone, setForEveryone] = useState(false)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#201f1e] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Delete {count} {count === 1 ? 'Message' : 'Messages'}
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to delete {count === 1 ? 'this message' : 'these messages'}? This action cannot be undone.
          </p>

          {hasOwnMessages && (
            <label className="flex items-center gap-3 p-3 mb-6 bg-gray-50 dark:bg-black/20 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-black/40 transition">
              <input
                type="checkbox"
                checked={forEveryone}
                onChange={(e) => setForEveryone(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white select-none">
                Also delete for everyone
              </span>
            </label>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(forEveryone)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
