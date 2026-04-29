import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { Users, BookOpen, AlertTriangle, CalendarCheck } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data)
  })

  const { data: timetable = {} } = useQuery({
    queryKey: ['timetable-my'],
    queryFn: () => api.get('/timetable/my').then(r => r.data)
  })

  const totalSubjects = summary.length
  const totalStudents = summary.reduce((a, s) => a + s.total_students, 0)
  const totalDefaulters = summary.reduce((a, s) => a + s.defaulters, 0)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todaySlots = timetable[today] || []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 mt-1">Here's what's happening today — {new Date().toDateString()}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard icon={BookOpen} label="My Subjects" value={isLoading ? '...' : totalSubjects} color="bg-indigo-500" />
        <StatCard icon={Users} label="Total Students" value={isLoading ? '...' : totalStudents} color="bg-emerald-500" />
        <StatCard icon={AlertTriangle} label="Defaulters" value={isLoading ? '...' : totalDefaulters} color="bg-rose-500" />
        <StatCard icon={CalendarCheck} label="Today's Lectures" value={todaySlots.length} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Today's Schedule — {today}</h2>
          {todaySlots.length === 0 ? (
            <p className="text-slate-400 text-sm">No lectures scheduled today.</p>
          ) : (
            <div className="space-y-3">
              {todaySlots.map((slot) => (
                <div key={slot.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-center min-w-[60px]">
                    <p className="text-xs font-semibold text-indigo-600">{slot.start_time?.slice(0, 5)}</p>
                    <p className="text-xs text-slate-400">{slot.end_time?.slice(0, 5)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{slot.subject_name}</p>
                    <p className="text-xs text-slate-400">{slot.subject_code} · {slot.room || 'Room TBD'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subject Overview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Subject Overview</h2>
          {isLoading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : summary.length === 0 ? (
            <p className="text-slate-400 text-sm">No subjects assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.map((s) => (
                <div key={s.subject_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{s.subject_name}</p>
                    <p className="text-xs text-slate-400">{s.subject_code} · {s.total_students} students</p>
                  </div>
                  {s.defaulters > 0 && (
                    <span className="text-xs bg-rose-100 text-rose-600 font-semibold px-2 py-1 rounded-full">
                      {s.defaulters} defaulters
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}
