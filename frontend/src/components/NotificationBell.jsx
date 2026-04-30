import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { Bell, BellRing, Check, CheckCheck, Clock, Calendar } from 'lucide-react'

const TYPE_STYLES = {
  reminder: 'bg-indigo-100 text-indigo-600',
  leave: 'bg-emerald-100 text-emerald-600',
  general: 'bg-slate-100 text-slate-600',
}

const TYPE_ICONS = {
  reminder: BellRing,
  leave: Calendar,
  general: Bell,
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const qc = useQueryClient()

  const { data = { notifications: [], unread_count: 0 } } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/').then(r => r.data),
    refetchInterval: 30000, // refresh every 30s
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => api.put(`/notifications/read/${id}`),
    onSuccess: () => qc.invalidateQueries(['notifications'])
  })

  const markAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries(['notifications'])
  })

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { notifications, unread_count } = data

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        {unread_count > 0 ? (
          <BellRing size={20} className="text-indigo-600" />
        ) : (
          <Bell size={20} className="text-slate-500" />
        )}
        {unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {open && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
            {unread_count > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Bell size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                    className={`flex gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                      !n.is_read ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${TYPE_STYLES[n.type]}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold text-slate-800 ${!n.is_read ? 'font-bold' : ''}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
