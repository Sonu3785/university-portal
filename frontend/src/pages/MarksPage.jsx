import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../api/axios"
import toast from "react-hot-toast"
import { Save, Award, TrendingUp } from "lucide-react"
import { useAuth } from "../context/AuthContext"

export default function MarksPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [selectedSubject, setSelectedSubject] = useState("")
  const [marks, setMarks] = useState({})
  const [finalMarks, setFinalMarks] = useState({})

  const { data: subjects = [] } = useQuery({
    queryKey: ["my-subjects"],
    queryFn: () => api.get("/reports/dashboard").then(r => r.data)
  })

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["marks", selectedSubject],
    queryFn: () => api.get("/marks/subject/" + selectedSubject).then(r => r.data),
    enabled: !!selectedSubject,
  })

  const { data: summary } = useQuery({
    queryKey: ["marks-summary", selectedSubject],
    queryFn: () => api.get("/marks/summary/" + selectedSubject).then(r => r.data),
    enabled: !!selectedSubject,
  })

  useEffect(() => {
    if (students.length > 0) {
      const init = {}
      const finit = {}
      students.forEach(s => {
        init[s.student_id] = {
          assignment1: s.assignment1 || 0,
          assignment2: s.assignment2 || 0,
          mcq_test: s.mcq_test || 0,
          ta1: s.ta1 || 0,
          ta2: s.ta2 || 0,
        }
        finit[s.student_id] = s.final_marks != null ? s.final_marks : ""
      })
      setMarks(init)
      setFinalMarks(finit)
    }
  }, [students])

  const saveMutation = useMutation({
    mutationFn: () => api.post("/marks/save", {
      subject_id: selectedSubject,
      records: Object.entries(marks).map(([student_id, data]) => ({
        student_id: parseInt(student_id), ...data
      }))
    }),
    onSuccess: () => {
      toast.success("Marks saved!")
      qc.invalidateQueries(["marks", selectedSubject])
      qc.invalidateQueries(["marks-summary", selectedSubject])
    },
    onError: (err) => toast.error(err.response?.data?.error || "Failed")
  })

  const saveFinalMutation = useMutation({
    mutationFn: () => api.post("/marks/final/save", {
      subject_id: selectedSubject,
      records: Object.entries(finalMarks).map(([student_id, val]) => ({
        student_id: parseInt(student_id),
        final_marks: val === "" ? 0 : parseFloat(val)
      }))
    }),
    onSuccess: () => {
      toast.success("Final marks saved!")
      qc.invalidateQueries(["marks", selectedSubject])
    },
    onError: (err) => toast.error(err.response?.data?.error || "Failed")
  })

  const updateMark = (studentId, field, value) => {
    setMarks(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">CA / TA Marks Entry</h1>
        <p className="text-slate-500 mt-1 text-sm">Continuous Assessment + Term Assessment + Final Exam</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Select Subject</label>
        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
          className="w-full max-w-md border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Select subject</option>
          {subjects.map(s => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name} ({s.subject_code})</option>
          ))}
        </select>
      </div>

      {selectedSubject && (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-xs opacity-80 mb-1">Class Avg (Internal)</p>
                <p className="text-3xl font-bold">{summary.avg_total}<span className="text-lg opacity-80">/50</span></p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-xs opacity-80 mb-1">Avg CA</p>
                <p className="text-3xl font-bold">{summary.avg_ca}<span className="text-lg opacity-80">/24</span></p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-xs opacity-80 mb-1">Avg TA</p>
                <p className="text-3xl font-bold">{summary.avg_ta}<span className="text-lg opacity-80">/26</span></p>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg">
                <Award size={16} className="mb-1 opacity-80" />
                <p className="text-xs opacity-80">Topper</p>
                <p className="text-sm font-bold truncate">{summary.topper?.student_name || "—"}</p>
                <p className="text-xs opacity-80">{summary.topper?.grand_total || 0}/50</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            {isLoading ? (
              <p className="p-6 text-slate-400 text-sm">Loading students...</p>
            ) : students.length === 0 ? (
              <p className="p-6 text-slate-400 text-sm">No students enrolled in this subject.</p>
            ) : (
              <>
                <table className="w-full border-collapse text-xs min-w-[1300px]">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th rowSpan={2} className="border border-slate-200 px-3 py-2 font-bold text-slate-600 w-8">#</th>
                      <th rowSpan={2} className="border border-slate-200 px-3 py-2 font-bold text-slate-600 text-left">Roll No.</th>
                      <th rowSpan={2} className="border border-slate-200 px-3 py-2 font-bold text-slate-600 text-left">Name</th>
                      <th colSpan={5} className="border border-slate-200 px-3 py-2 font-bold text-indigo-600 bg-indigo-50">CA — 24 Marks</th>
                      <th colSpan={3} className="border border-slate-200 px-3 py-2 font-bold text-emerald-600 bg-emerald-50">TA — 26 Marks</th>
                      <th rowSpan={2} className="border border-slate-200 px-3 py-2 font-bold text-violet-600 bg-violet-50">Internal /50</th>
                      <th rowSpan={2} className={"border border-slate-200 px-3 py-2 font-bold bg-rose-50 " + (isAdmin ? "text-rose-600" : "text-slate-400")}>
                        Final /50 {isAdmin ? "✏️" : "🔒"}
                      </th>
                      <th rowSpan={2} className="border border-slate-200 px-3 py-2 font-bold text-slate-700 bg-slate-100">Total /100</th>
                    </tr>
                    <tr>
                      <th className="border border-slate-200 px-2 py-1 text-slate-500 bg-indigo-50">Assgn 1 /10→6</th>
                      <th className="border border-slate-200 px-2 py-1 text-slate-500 bg-indigo-50">Assgn 2 /10→6</th>
                      <th className="border border-slate-200 px-2 py-1 text-slate-500 bg-indigo-50">MCQ /10→6</th>
                      <th className="border border-slate-200 px-2 py-1 text-slate-500 bg-indigo-50">Attend →6</th>
                      <th className="border border-slate-200 px-2 py-1 text-indigo-600 font-bold bg-indigo-100">Total /24</th>
                      <th className="border border-slate-200 px-2 py-1 text-slate-500 bg-emerald-50">TA 1 /20→13</th>
                      <th className="border border-slate-200 px-2 py-1 text-slate-500 bg-emerald-50">TA 2 /20→13</th>
                      <th className="border border-slate-200 px-2 py-1 text-emerald-600 font-bold bg-emerald-100">Total /26</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const m = marks[student.student_id] || {}
                      const fm = finalMarks[student.student_id]
                      const internal = student.grand_total || 0
                      const fVal = fm !== "" && fm != null ? parseFloat(fm) : null
                      const overall = fVal != null ? Math.round((internal + fVal) * 100) / 100 : "—"
                      return (
                        <tr key={student.student_id} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="border border-slate-200 px-3 py-2 font-mono text-slate-600 font-semibold">{student.roll_number}</td>
                          <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">{student.student_name}</td>
                          {["assignment1", "assignment2", "mcq_test"].map(field => (
                            <td key={field} className="border border-slate-200 px-1 py-1">
                              <input type="number" min={0} max={10} step={0.5} value={m[field] || 0}
                                onChange={e => updateMark(student.student_id, field, e.target.value)}
                                className="w-full px-2 py-1 text-center border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                            </td>
                          ))}
                          <td className="border border-slate-200 px-2 py-2 text-center bg-slate-50">
                            <span className="text-slate-500 font-semibold">{student.attendance_pct?.toFixed(1)}%</span>
                            <p className="text-xs text-indigo-600 font-bold">→{student.attendance_converted}</p>
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center bg-indigo-100 font-bold text-indigo-700">{student.ca_total}</td>
                          {["ta1", "ta2"].map(field => (
                            <td key={field} className="border border-slate-200 px-1 py-1">
                              <input type="number" min={0} max={20} step={0.5} value={m[field] || 0}
                                onChange={e => updateMark(student.student_id, field, e.target.value)}
                                className="w-full px-2 py-1 text-center border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                            </td>
                          ))}
                          <td className="border border-slate-200 px-2 py-2 text-center bg-emerald-100 font-bold text-emerald-700">{student.ta_total}</td>
                          <td className="border border-slate-200 px-2 py-2 text-center bg-violet-100 font-bold text-violet-700">{student.grand_total}</td>
                          <td className="border border-slate-200 px-1 py-1 bg-rose-50">
                            {isAdmin ? (
                              <input type="number" min={0} max={50} step={0.5}
                                value={fm === null || fm === undefined ? "" : fm}
                                onChange={e => setFinalMarks(prev => ({ ...prev, [student.student_id]: e.target.value }))}
                                placeholder="—"
                                className="w-full px-2 py-1 text-center border border-rose-200 rounded focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white" />
                            ) : (
                              <span className="block text-center text-slate-500 font-semibold">{fm != null && fm !== "" ? fm : "—"}</span>
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center bg-slate-100 font-bold text-slate-700 text-sm">{overall}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 flex-wrap">
                  <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                    <Save size={15} /> {saveMutation.isPending ? "Saving..." : "Save CA/TA Marks"}
                  </button>
                  {isAdmin && (
                    <button onClick={() => saveFinalMutation.mutate()} disabled={saveFinalMutation.isPending}
                      className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                      <Save size={15} /> {saveFinalMutation.isPending ? "Saving..." : "Save Final Marks (Admin)"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-6 bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-2xl border border-indigo-100 p-5">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><TrendingUp size={16} /> Marks Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="font-bold text-indigo-600 mb-2">CA (24 Marks)</p>
                <ul className="space-y-1 text-slate-600">
                  <li>Assignment 1: /10 to 6</li>
                  <li>Assignment 2: /10 to 6</li>
                  <li>MCQ Test: /10 to 6</li>
                  <li>Attendance: % to 6 (auto)</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-emerald-600 mb-2">TA (26 Marks)</p>
                <ul className="space-y-1 text-slate-600">
                  <li>TA 1: /20 to 13</li>
                  <li>TA 2: /20 to 13</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-rose-600 mb-2">Final Exam (50 Marks) Admin Only</p>
                <ul className="space-y-1 text-slate-600">
                  <li>End Semester Exam: /50</li>
                  <li className="font-bold">Total = Internal(50) + Final(50) = 100</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedSubject && (
        <div className="text-center py-16 text-slate-400">
          <Award size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm">Select a subject to enter marks</p>
        </div>
      )}
    </div>
  )
}
