import { useState } from "react"
import api from "../api/axios"
import toast from "react-hot-toast"
import { KeyRound } from "lucide-react"

export default function ProfilePage() {
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm_password: "" })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.old_password || !form.new_password || !form.confirm_password) {
      return toast.error("All fields are required")
    }
    if (form.new_password.length < 6) {
      return toast.error("New password must be at least 6 characters")
    }
    if (form.new_password !== form.confirm_password) {
      return toast.error("New passwords do not match")
    }
    setLoading(true)
    try {
      await api.put("/auth/change-password", {
        old_password: form.old_password,
        new_password: form.new_password,
      })
      toast.success("Password changed successfully!")
      setForm({ old_password: "", new_password: "", confirm_password: "" })
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Profile & Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage your account settings</p>
      </div>

      <div className="max-w-md">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Change Password</h2>
              <p className="text-xs text-slate-400">Update your login password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Current Password *</label>
              <input
                type="password"
                value={form.old_password}
                onChange={e => setForm({ ...form, old_password: e.target.value })}
                placeholder="Enter current password"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">New Password *</label>
              <input
                type="password"
                value={form.new_password}
                onChange={e => setForm({ ...form, new_password: e.target.value })}
                placeholder="Min. 6 characters"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Confirm New Password *</label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={e => setForm({ ...form, confirm_password: e.target.value })}
                placeholder="Re-enter new password"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
