import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../api/axios"
import toast from "react-hot-toast"
import { Plus, X } from "lucide-react"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// MIT-ADT University official time slots
const TIME_SLOTS = [
  { label: "08:45 – 09:40", start: "08:45", end: "09:40", isBreak: false },
  { label: "09:40 – 10:35", start: "09:40", end: "10:35", isBreak: false },
  { label: "10:35 – 10:50", start: "10:35", end: "10:50", isBreak: true, breakLabel: "Short Break" },
  { label: "10:50 – 11:45", start: "10:50", end: "11:45", isBreak: false },
  { label: "11:45 – 12:40", start: "11:45", end: "12:40", isBreak: false },
  { label: "12:40 – 01:40", start: "12:40", end: "13:40", isBreak: true, breakLabel: "Lunch Break" },
  { label: "01:40 – 02:35", start: "13:40", end: "14:35", isBreak: false },
  { label: "02:35 – 03:30", start: "14:35", end: "15:30", isBreak: false },
  { label: "03:30 – 03:40", start: "15:30", end: "15:40", isBreak: true, breakLabel: "Short Break" },
  { label: "03:40 – 04:30", start: "15:40", end: "16:30", isBreak: false },
]

function timeToMinutes(t) {
  if (!t) return 0
  const parts = t.split(":")
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function slotMatchesTime(slot, rowStart, rowEnd) {
  const slotStart = timeToMinutes(slot.start_time?.slice(0, 5))
  const rowStartMin = timeToMinutes(rowStart)
  const rowEndMin = timeToMinutes(rowEnd)
  return slotStart >= rowStartMin && slotStart < rowEndMin
}

const SLOT_COLORS = [
  "bg-yellow-50 border-yellow-300 text-yellow-800",
  "bg-indigo-50 border-indigo-300 text-indigo-800",
  "bg-green-50 border-green-300 text-green-800",
  "bg-pink-50 border-pink-300 text-pink-800",
  "bg-blue-50 border-blue-300 text-blue-800",
  "bg-orange-50 border-orange-300 text-orange-800",
]

export default function TimetablePage() {
  const qc = useQueryClient()
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraForm, setExtraForm] = useState({ subject_id: "", date: "", start_time: "", end_time: "", room: "", note: "" })

  const { data: timetable = {}, isLoading } = useQuery({
    queryKey: ["timetable-my"],
    queryFn: () => api.get("/timetable/my").then(r => r.data)
  })

  const { data: extras = [] } = useQuery({
    queryKey: ["extra-lectures"],
    queryFn: () => api.get("/timetable/extra").then(r => r.data)
  })

  const { data: subjects = [] } = useQuery({
    queryKey: ["my-subjects"],
    queryFn: () => api.get("/reports/dashboard").then(r => r.data)
  })

  const addExtra = useMutation({
    mutationFn: (data) => api.post("/admin/extra-lecture", data),
    onSuccess: () => {
      toast.success("Extra lecture added!")
      qc.invalidateQueries(["extra-lectures"])
      setShowExtraForm(false)
      setExtraForm({ subject_id: "", date: "", start_time: "", end_time: "", room: "", note: "" })
    },
    onError: (err) => toast.error(err.response?.data?.error || "Failed to add")
  })

  // Build color map per subject
  const subjectColorMap = {}
  let colorIdx = 0
  DAYS.forEach(day => {
    (timetable[day] || []).forEach(slot => {
      if (!subjectColorMap[slot.subject_code]) {
        subjectColorMap[slot.subject_code] = SLOT_COLORS[colorIdx % SLOT_COLORS.length]
        colorIdx++
      }
    })
  })

  const hasAnySlot = DAYS.some(day => (timetable[day] || []).length > 0)

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Timetable</h1>
          <p className="text-slate-500 mt-1 text-sm">MIT-ADT University — Weekly Schedule</p>
        </div>
        <button onClick={() => setShowExtraForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
          <Plus size={16} /> <span className="hidden sm:inline">Add Extra Lecture</span><span className="sm:hidden">Add Extra</span>
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400">Loading timetable...</p>
      ) : !hasAnySlot ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
          <p className="text-sm">No timetable assigned yet. Contact admin to upload your timetable.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-x-auto">
          {/* Header */}
          <div className="bg-indigo-700 text-white text-center py-2 px-4 rounded-t-2xl">
            <p className="font-bold text-sm tracking-wide">MIT-ADT UNIVERSITY — DEPARTMENTAL TIME TABLE</p>
          </div>

          <table className="w-full border-collapse text-xs min-w-[900px]">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-100 px-3 py-3 font-bold text-slate-700 text-center w-24">
                  Day ↓ Time →
                </th>
                {TIME_SLOTS.map((slot, i) => (
                  <th key={i}
                    className={"border border-slate-300 px-2 py-2 font-bold text-center " + (slot.isBreak ? "bg-slate-200 text-slate-500 w-16" : "bg-slate-100 text-slate-700")}>
                    {slot.isBreak ? (
                      <span className="text-xs font-semibold text-slate-500 writing-mode-vertical">{slot.breakLabel}</span>
                    ) : (
                      <span className="whitespace-nowrap">{slot.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td className={"border border-slate-300 px-3 py-3 font-bold text-center text-slate-700 " + (day === "Saturday" ? "bg-slate-50" : "bg-white")}>
                    {day}
                    {day === "Saturday" && <p className="text-xs font-normal text-slate-400">(Working)</p>}
                  </td>
                  {TIME_SLOTS.map((timeSlot, i) => {
                    if (timeSlot.isBreak) {
                      return (
                        <td key={i} className="border border-slate-300 bg-slate-100 text-center align-middle">
                          <div className="text-slate-400 text-xs font-medium py-1 px-1"
                            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "auto" }}>
                            {timeSlot.breakLabel}
                          </div>
                        </td>
                      )
                    }
                    const slot = (timetable[day] || []).find(s => slotMatchesTime(s, timeSlot.start, timeSlot.end))
                    const colorClass = slot ? (subjectColorMap[slot.subject_code] || SLOT_COLORS[0]) : ""
                    return (
                      <td key={i} className="border border-slate-300 px-1 py-1 text-center align-middle h-16 min-w-[100px]">
                        {slot ? (
                          <div className={"border rounded px-1.5 py-1 h-full flex flex-col justify-center " + colorClass}>
                            <p className="font-bold text-xs leading-tight">{slot.subject_name}</p>
                            <p className="text-xs opacity-70 mt-0.5">{slot.subject_code}</p>
                            {slot.room && <p className="text-xs font-semibold mt-0.5">🏫 {slot.room}</p>}
                          </div>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Extra Lectures */}
      {extras.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Extra Lectures</h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Date", "Subject", "Time", "Room", "Note"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {extras.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700">{e.date}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{e.subject_name} <span className="text-slate-400 font-normal">({e.subject_code})</span></td>
                    <td className="px-5 py-3 text-slate-600">{e.start_time?.slice(0,5)} – {e.end_time?.slice(0,5)}</td>
                    <td className="px-5 py-3 text-slate-500">{e.room || "—"}</td>
                    <td className="px-5 py-3 text-slate-400">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Extra Lecture Modal */}
      {showExtraForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Add Extra Lecture</h3>
              <button onClick={() => setShowExtraForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Subject</label>
                <select value={extraForm.subject_id} onChange={e => setExtraForm({ ...extraForm, subject_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select subject</option>
                  {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name} ({s.subject_code})</option>)}
                </select>
              </div>
              {[
                { label: "Date", key: "date", type: "date" },
                { label: "Start Time", key: "start_time", type: "time" },
                { label: "End Time", key: "end_time", type: "time" },
                { label: "Room", key: "room", type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
                  <input type={type} value={extraForm[key]} onChange={e => setExtraForm({ ...extraForm, [key]: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Note (optional)</label>
                <textarea value={extraForm.note} onChange={e => setExtraForm({ ...extraForm, note: e.target.value })}
                  rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <button onClick={() => addExtra.mutate(extraForm)} disabled={addExtra.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {addExtra.isPending ? "Adding..." : "Add Lecture"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
