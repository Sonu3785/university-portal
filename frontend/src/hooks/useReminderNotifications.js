import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export function useReminderNotifications() {
  const { user } = useAuth()
  const firedRef = useRef(new Set())
  const qc = useQueryClient()

  // Request browser notification permission on mount
  useEffect(() => {
    if (!user) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [user])

  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-reminders'],
    queryFn: () => api.get('/reminder/upcoming').then(r => r.data),
    enabled: !!user,
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (!upcoming.length || !user) return

    const now = new Date()

    upcoming.forEach((lec) => {
      const [h, m] = lec.start_time.split(':').map(Number)
      const lectureTime = new Date()
      lectureTime.setHours(h, m, 0, 0)

      const diffMs = lectureTime - now
      const diffMin = diffMs / 60000
      const fireKey = `${lec.subject_code}-${lec.start_time}`

      const fireNotification = () => {
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🔔 Lecture in ${lec.minutes_before} min`, {
            body: `${lec.subject_name} (${lec.subject_code}) — ${lec.room || 'Room TBD'} at ${lec.start_time.slice(0, 5)}`,
            icon: '/logo.png',
          })
        }
        // Refresh in-app notifications
        qc.invalidateQueries(['notifications'])
        firedRef.current.add(fireKey)
      }

      // Already in the window — fire immediately
      if (
        diffMin >= lec.minutes_before - 0.5 &&
        diffMin <= lec.minutes_before + 0.5 &&
        !firedRef.current.has(fireKey)
      ) {
        fireNotification()
      }

      // Schedule for future
      if (diffMin > lec.minutes_before + 0.5 && !firedRef.current.has(fireKey + '-scheduled')) {
        firedRef.current.add(fireKey + '-scheduled')
        const delay = diffMs - lec.minutes_before * 60000
        if (delay > 0 && delay < 8 * 60 * 60 * 1000) {
          setTimeout(fireNotification, delay)
        }
      }
    })
  }, [upcoming, user, qc])
}
