import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { BarChart3, TrendingDown, Users } from 'lucide-react'

export default function ReportsPage() {
  const [selectedSubject, setSelectedSubject] = useState(null)

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data)
  })

  const { data: subjectReport, isLoading: loadingReport } = useQuery({
    queryKey: ['subject-report', selectedSubject],
    queryFn: () => api.get(`/reports/subject/${selectedSubject}`).then(r => r.data),
    enabled: !!selectedSubject
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-500 mt-1">Attendance overview across your subjects</p>
      </div>

      {/* Subject Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {isLoading ? (
          <p className="text-slate-400 text-sm col-span-3">Loading...</p>
        ) : summary.map((s) => (
          <button
            key={s.subject_id}
            onClick={() => setSelectedSubject(s.subject_id)}
            className={`text-left bg-white rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md ${
              selectedSubject === s.subject_id
                ? 'border-indigo-400 ring-2 ring-indigo-200'
                : 'border-slate-100'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-700">{s.subject_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.subject_code}</p>
              </div>
              <BarChart3 size={18} className="text-indigo-400 mt-0.5" />
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Students</p>
                <p className="font-bold text-slate-700">{s.total_students}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Defaulters</p>
                <p className={`font-bold ${s.defaulters > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {s.defaulters}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Detailed Report */}
      {selectedSubject && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">
              {subjectReport?.subject?.name} — Detailed Report
            </h2>
            <span className="text-xs text-slate-400">{subjectReport?.subject?.code}</span>
          </div>

          {loadingReport ? (
            <p className="p-6 text-slate-400 text-sm">Loading report...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Roll No.', 'Name', 'Present', 'Absent', 'Total', 'Attendance %', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(subjectReport?.report || []).map((row) => (
                  <tr key={row.id} className={row.is_defaulter ? 'bg-rose-50' : ''}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{row.roll_number}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                    <td className="px-5 py-3 text-emerald-600 font-semibold">{row.present}</td>
                    <td className="px-5 py-3 text-rose-600 font-semibold">{row.absent}</td>
                    <td className="px-5 py-3 text-slate-600">{row.total_classes}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                          <div
                            className={`h-1.5 rounded-full ${row.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(row.percentage, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${row.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {row.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {row.is_defaulter ? (
                        <span className="text-xs bg-rose-100 text-rose-600 font-semibold px-2 py-0.5 rounded-full">Defaulter</span>
                      ) : (
                        <span className="text-xs bg-emerald-100 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!selectedSubject && !isLoading && (
        <div className="text-center py-12 text-slate-400">
          <BarChart3 size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="text-sm">Click a subject card to view detailed report</p>
        </div>
      )}
    </div>
  )
}
