import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Send, Mail } from 'lucide-react'

export default function AttendancePage() {
  const [selectedSubject, setSelectedSubject] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState({}) // { student_id: 'present'|'absent' }
  const rowRefs = useRef([])

  const { data: subjects = [] } = useQuery({
    queryKey: ['my-subjects'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data)
  })

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', selectedSubject],
    queryFn: () => api.get(`/attendance/students/${selectedSubject}`).then(r => r.data),
    enabled: !!selectedSubject,
  })

  // Initialize all students as present when subject changes or students load
  useEffect(() => {
    if (students.length > 0) {
      const init = {}
      students.forEach(s => { init[s.id] = 'present' })
      setAttendance(init)
    }
  }, [JSON.stringify(students)])

  const submitMutation = useMutation({
    mutationFn: () => api.post('/attendance/submit', {
      subject_id: selectedSubject,
      date,
      records: Object.entries(attendance).map(([student_id, status]) => ({
        student_id: parseInt(student_id), status
      }))
    }),
    onSuccess: () => toast.success('Attendance saved successfully!'),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save')
  })

  const mailMutation = useMutation({
    mutationFn: () => api.post(`/admin/send-defaulter-mails/${selectedSubject}`),
    onSuccess: (res) => toast.success(res.data.message),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to send mails')
  })

  const toggle = (id) => {
    setAttendance(prev => ({
      ...prev,
      [id]: prev[id] === 'present' ? 'absent' : 'present'
    }))
  }

  // Tab key navigation between rows
  const handleKeyDown = (e, idx) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const next = rowRefs.current[idx + 1]
      if (next) next.focus()
    }
  }

  const presentCount = Object.values(attendance).filter(v => v === 'present').length
  const absentCount = Object.values(attendance).filter(v => v === 'absent').length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 mt-1">Mark attendance for your classes</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Subject</label>
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s.subject_id} value={s.subject_id}>
                {s.subject_name} ({s.subject_code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Attendance Table */}
      {selectedSubject && (
        <>
          {/* Summary bar */}
          {students.length > 0 && (
            <div className="flex gap-4 mb-4">
              <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                Present: {presentCount}
              </span>
              <span className="text-sm font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg">
                Absent: {absentCount}
              </span>
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                Total: {students.length}
              </span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-5">
            {loadingStudents ? (
              <p className="p-6 text-slate-400 text-sm">Loading students...</p>
            ) : students.length === 0 ? (
              <p className="p-6 text-slate-400 text-sm">No students enrolled in this subject.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Roll No.</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {students.map((student, idx) => {
                    const status = attendance[student.id] || 'present'
                    const isPresent = status === 'present'
                    return (
                      <tr
                        key={student.id}
                        ref={el => rowRefs.current[idx] = el}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault()
                            toggle(student.id)
                          }
                          handleKeyDown(e, idx)
                        }}
                        onClick={() => toggle(student.id)}
                        className={`cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400 ${
                          isPresent ? 'hover:bg-emerald-50' : 'bg-rose-50 hover:bg-rose-100'
                        }`}
                      >
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-600 text-xs">{student.roll_number}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">{student.name}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            isPresent
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {students.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                <Send size={15} />
                {submitMutation.isPending ? 'Saving...' : 'Save Attendance'}
              </button>
              <button
                onClick={() => mailMutation.mutate()}
                disabled={mailMutation.isPending}
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                <Mail size={15} />
                {mailMutation.isPending ? 'Sending...' : 'Mail Defaulters'}
              </button>
            </div>
          )}
        </>
      )}

      {!selectedSubject && (
        <div className="text-center py-16 text-slate-400">
          <ClipboardIcon />
          <p className="mt-3 text-sm">Select a subject to start marking attendance</p>
        </div>
      )}
    </div>
  )
}

function ClipboardIcon() {
  return (
    <svg className="mx-auto w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

