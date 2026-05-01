import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Plus, X, Clock, CheckCircle, XCircle } from 'lucide-react'

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
}

const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
}

export default function LeavePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ from_date: '', to_date: '', reason: '' })

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => api.get('/leave/my').then(r => r.data)
  })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/leave/apply', form),
    onSuccess: () => {
      toast.success('Leave request submitted!')
      qc.invalidateQueries(['my-leaves'])
      setShowForm(false)
      setForm({ from_date: '', to_date: '', reason: '' })
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to submit')
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Leave Requests</h1>
          <p className="text-slate-500 mt-1 text-sm">Apply and track your leave applications</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus size={16} /> Apply Leave
        </button>
      </div>

      {/* Leave List */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading...</p>
      ) : leaves.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No leave requests yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leaves.map((leave) => {
            const Icon = STATUS_ICONS[leave.status] || Clock
            return (
              <div key={leave.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-700">
                        {leave.from_date} → {leave.to_date}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{leave.reason}</p>
                    {leave.admin_remark && (
                      <p className="text-xs text-slate-400 mt-2 italic">Admin: {leave.admin_remark}</p>
                    )}
                    <p className="text-xs text-slate-300 mt-2">Applied: {new Date(leave.applied_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_STYLES[leave.status]}`}>
                    <Icon size={12} />
                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Apply for Leave</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">From Date</label>
                  <input
                    type="date"
                    value={form.from_date}
                    onChange={e => setForm({ ...form, from_date: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">To Date</label>
                  <input
                    type="date"
                    value={form.to_date}
                    onChange={e => setForm({ ...form, to_date: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  rows={4}
                  placeholder="Describe the reason for leave..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || !form.from_date || !form.to_date || !form.reason}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {applyMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
