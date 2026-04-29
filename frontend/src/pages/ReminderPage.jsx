import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Bell, BellOff, Mail, Monitor } from 'lucide-react'

export default function ReminderPage() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: () => api.get('/reminder/settings').then(r => r.data)
  })

  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-reminders'],
    queryFn: () => api.get('/reminder/upcoming').then(r => r.data)
  })

  const [form, setForm] = useState({ minutes_before: 10, email_enabled: true, browser_enabled: true })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () => api.put('/reminder/settings', form),
    onSuccess: () => {
      toast.success('Reminder settings saved!')
      qc.invalidateQueries(['reminder-settings'])
    },
    onError: () => toast.error('Failed to save settings')
  })

  // Request browser notification permission
  const requestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') toast.success('Browser notifications enabled!')
      else toast.error('Permission denied')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Reminders</h1>
        <p className="text-slate-500 mt-1">Configure lecture reminders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-700 mb-5">Reminder Settings</h2>

          {isLoading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">
                  Remind me before lecture (minutes)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={form.minutes_before}
                    onChange={e => setForm({ ...form, minutes_before: parseInt(e.target.value) })}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="text-lg font-bold text-indigo-600 min-w-[40px] text-right">
                    {form.minutes_before}m
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-600 block">Notification Channels</label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.email_enabled}
                    onChange={e => setForm({ ...form, email_enabled: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <Mail size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-700">Email notifications</span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.browser_enabled}
                    onChange={e => setForm({ ...form, browser_enabled: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <Monitor size={16} className="text-slate-500" />
                  <span className="text-sm text-slate-700">Browser notifications</span>
                </label>
              </div>

              {form.browser_enabled && (
                <button
                  onClick={requestPermission}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Click to enable browser notification permission →
                </button>
              )}

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>

        {/* Today's Upcoming */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-700 mb-5">Today's Upcoming Lectures</h2>
          {upcoming.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BellOff size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm">No lectures scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((lec, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Bell size={16} className="text-indigo-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{lec.subject_name}</p>
                    <p className="text-xs text-slate-400">{lec.subject_code} · {lec.room || 'Room TBD'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-600">{lec.start_time?.slice(0, 5)}</p>
                    <p className="text-xs text-slate-400">-{lec.minutes_before}min</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
