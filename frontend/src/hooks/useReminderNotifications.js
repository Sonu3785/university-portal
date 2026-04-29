import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export function useReminderNotifications() {
  const { user } = useAuth()
  const firedRef = useRef(new Set()) // track already-fired reminders

  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-reminders'],
    queryFn: () => api.get('/reminder/upcoming').then(r => r.data),
    enabled: !!user,
    refetchInterval: 60000, // re-check every minute
  })

  useEffect(() => {
    if (!upcoming.length) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const now = new Date()

    upcoming.forEach((lec) => {
      const [h, m, s] = lec.start_time.split(':').map(Number)
      const lectureTime = new Date()
      lectureTime.setHours(h, m, s || 0, 0)

      const diffMs = lectureTime - now
      const diffMin = diffMs / 60000

      const fireKey = `${lec.subject_code}-${lec.start_time}`

      // Fire notification if within [minutes_before - 0.5, minutes_before + 0.5] window
      if (
        diffMin >= lec.minutes_before - 0.5 &&
        diffMin <= lec.minutes_before + 0.5 &&
        !firedRef.current.has(fireKey)
      ) {
        firedRef.current.add(fireKey)

        new Notification(`🔔 Lecture in ${lec.minutes_before} min`, {
          body: `${lec.subject_name} (${lec.subject_code}) — ${lec.room || 'Room TBD'} at ${lec.start_time.slice(0, 5)}`,
          icon: '/logo.png',
          badge: '/logo.png',
        })
      }

      // Schedule future notification using setTimeout
      if (diffMin > lec.minutes_before + 0.5 && !firedRef.current.has(fireKey + '-scheduled')) {
        firedRef.current.add(fireKey + '-scheduled')
        const delay = diffMs - lec.minutes_before * 60000
        if (delay > 0 && delay < 8 * 60 * 60 * 1000) { // only within 8 hours
          setTimeout(() => {
            if (!firedRef.current.has(fireKey)) {
              firedRef.current.add(fireKey)
              new Notification(`🔔 Lecture in ${lec.minutes_before} min`, {
                body: `${lec.subject_name} (${lec.subject_code}) — ${lec.room || 'Room TBD'} at ${lec.start_time.slice(0, 5)}`,
                icon: '/logo.png',
                badge: '/logo.png',
              })
            }
          }, delay)
        }
      }
    })
  }, [upcoming])
}
