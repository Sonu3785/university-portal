import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../api/axios"
import toast from "react-hot-toast"
import { Upload, UserPlus, BookOpen, Trash2 } from "lucide-react"

const TABS = ["Faculty", "Subjects", "Timetable Upload", "Student Upload"]

export default function AdminPage() {
  const [tab, setTab] = useState("Faculty")
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Admin Panel</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage faculty, subjects and timetable</p>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={"px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors " + (tab === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Faculty" && <FacultyTab />}
      {tab === "Subjects" && <SubjectsTab />}
      {tab === "Timetable Upload" && <TimetableUploadTab />}
      {tab === "Student Upload" && <StudentUploadTab />}
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-slate-800 mb-2">Confirm Delete</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600">Delete</button>
        </div>
      </div>
    </div>
  )
}

function FacultyTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "", phone: "" })
  const { data: faculty = [], isLoading } = useQuery({ queryKey: ["all-faculty"], queryFn: () => api.get("/admin/faculty").then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: () => api.post("/admin/faculty", form),
    onSuccess: () => { toast.success("Faculty created!"); qc.invalidateQueries(["all-faculty"]); setShowForm(false); setForm({ name: "", email: "", password: "", department: "", phone: "" }) },
    onError: (err) => toast.error(err.response?.data?.error || "Failed")
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete("/admin/faculty/" + id),
    onSuccess: (_, id) => {
      toast.success("Faculty and their subjects deleted!")
      qc.invalidateQueries(["all-faculty"])
      qc.invalidateQueries(["all-subjects"])
      setConfirmDelete(null)
    },
    onError: (err) => { toast.error(err.response?.data?.error || "Delete failed"); setConfirmDelete(null) }
  })

  return (
    <div>
      {confirmDelete && (
        <ConfirmModal
          message={"Delete " + confirmDelete.name + "? This will also delete all their subjects, timetable slots and attendance records."}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-slate-700">Faculty Members ({faculty.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <UserPlus size={15} /> Add Faculty
        </button>
      </div>
      {showForm && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{label:"Full Name",key:"name",type:"text"},{label:"Email",key:"email",type:"email"},{label:"Password",key:"password",type:"password"},{label:"Department",key:"department",type:"text"},{label:"Phone",key:"phone",type:"text"}].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
              <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div className="col-span-2">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm">
              {createMutation.isPending ? "Creating..." : "Create Faculty"}
            </button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        {isLoading ? <p className="p-5 text-slate-400 text-sm">Loading...</p> : faculty.length === 0 ? <p className="p-5 text-slate-400 text-sm">No faculty added yet.</p> : (
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Name","Email","Department","Phone","Status","Action"].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {faculty.map(f => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{f.name}</td>
                  <td className="px-5 py-3 text-slate-500">{f.email}</td>
                  <td className="px-5 py-3 text-slate-500">{f.department || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{f.phone || "—"}</td>
                  <td className="px-5 py-3"><span className={"text-xs font-semibold px-2 py-0.5 rounded-full " + (f.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{f.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3">
                    <button onClick={() => setConfirmDelete(f)} className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition-colors font-semibold">
                      <Trash2 size={13} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SubjectsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ name: "", code: "", faculty_id: "", semester: "", branch: "" })
  const { data: subjects = [], isLoading } = useQuery({ queryKey: ["all-subjects"], queryFn: () => api.get("/admin/subjects").then(r => r.data) })
  const { data: faculty = [] } = useQuery({ queryKey: ["all-faculty"], queryFn: () => api.get("/admin/faculty").then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: () => api.post("/admin/subjects", { ...form, semester: parseInt(form.semester) || null }),
    onSuccess: () => { toast.success("Subject created!"); qc.invalidateQueries(["all-subjects"]); setShowForm(false); setForm({ name: "", code: "", faculty_id: "", semester: "", branch: "" }) },
    onError: (err) => toast.error(err.response?.data?.error || "Failed")
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete("/admin/subjects/" + id),
    onSuccess: () => { toast.success("Subject deleted!"); qc.invalidateQueries(["all-subjects"]); setConfirmDelete(null) },
    onError: (err) => { toast.error(err.response?.data?.error || "Delete failed"); setConfirmDelete(null) }
  })

  return (
    <div>
      {confirmDelete && (
        <ConfirmModal
          message={"Delete subject " + confirmDelete.name + " (" + confirmDelete.code + ")? All attendance records for this subject will also be deleted."}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-slate-700">Subjects ({subjects.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <BookOpen size={15} /> Add Subject
        </button>
      </div>
      {showForm && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{label:"Subject Name",key:"name",type:"text"},{label:"Subject Code",key:"code",type:"text"},{label:"Semester",key:"semester",type:"number"},{label:"Branch",key:"branch",type:"text"}].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
              <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Assign Faculty</label>
            <select value={form.faculty_id} onChange={e => setForm({ ...form, faculty_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select faculty</option>
              {faculty.map(f => <option key={f.id} value={f.id}>{f.name} — {f.department}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm">
              {createMutation.isPending ? "Creating..." : "Create Subject"}
            </button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        {isLoading ? <p className="p-5 text-slate-400 text-sm">Loading...</p> : subjects.length === 0 ? <p className="p-5 text-slate-400 text-sm">No subjects added yet.</p> : (
          <table className="w-full text-sm min-w-[550px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Code","Name","Semester","Branch","Faculty","Action"].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {subjects.map(s => {
                const f = faculty.find(f => f.id === s.faculty_id)
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-indigo-600 font-semibold">{s.code}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{s.name}</td>
                    <td className="px-5 py-3 text-slate-500">{s.semester || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{s.branch || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{f?.name || "—"}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setConfirmDelete(s)} className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition-colors font-semibold">
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function UploadTab({ title, description, endpoint, templateCols, sampleRows }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const downloadSample = () => {
    const header = templateCols.join(",")
    const rows = sampleRows.map(r => r.join(",")).join("\n")
    const csv = header + "\n" + rows
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = title.toLowerCase().replace(/ /g, "_") + "_sample.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpload = async () => {
    if (!file) return toast.error("Please select a file")
    const formData = new FormData()
    formData.append("file", file)
    setLoading(true)
    setResult(null)
    try {
      const res = await api.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } })
      setResult(res.data)
      toast.success(res.data.message)
    } catch (err) {
      const msg = err.response?.data?.error || "Upload failed"
      toast.error(msg)
      setResult({ message: msg, errors: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-slate-700">{title}</h2>
        <button onClick={downloadSample} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
          Download Sample CSV
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-5">{description}</p>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-xl">
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Required Columns</p>
          <div className="flex flex-wrap gap-2">
            {templateCols.map(c => <span key={c} className="text-xs bg-indigo-50 text-indigo-600 font-mono px-2 py-1 rounded-lg">{c}</span>)}
          </div>
        </div>
        <label className="block border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 transition-colors mb-4">
          <Upload size={24} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">{file ? file.name : "Click to select CSV or Excel file"}</p>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={e => { setFile(e.target.files[0]); setResult(null) }} className="hidden" />
        </label>
        <button onClick={handleUpload} disabled={loading || !file} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
          {loading ? "Uploading..." : "Upload File"}
        </button>
        {result && (
          <div className={"mt-4 p-4 rounded-xl text-sm " + (result.errors?.length > 0 ? "bg-amber-50 border border-amber-100" : "bg-emerald-50 border border-emerald-100")}>
            <p className="font-semibold text-slate-700">{result.message}</p>
            {result.errors?.length > 0 && (
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i} className="text-xs text-rose-600">• {e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TimetableUploadTab() {
  return (
    <UploadTab
      title="Upload Timetable"
      description="Upload CSV/Excel. Faculty email and subject code must already exist in the system."
      endpoint="/admin/timetable/upload"
      templateCols={["faculty_email","subject_code","day","start_time","end_time","room"]}
      sampleRows={[
        ["faculty@university.edu","CS301","Monday","09:00","10:00","Room 101"],
        ["faculty@university.edu","CS302","Tuesday","10:00","11:00","Room 102"]
      ]}
    />
  )
}

function StudentUploadTab() {
  return (
    <UploadTab
      title="Upload Students"
      description="Upload CSV/Excel. Use subject_codes column (comma-separated) to auto-enroll students in subjects."
      endpoint="/admin/students/upload"
      templateCols={["name","roll_number","email","phone","semester","branch","subject_codes"]}
      sampleRows={[
        ["Aarav Sharma","CS2024001","aarav@student.edu","9000000001","3","CSE","CS301,CS302"],
        ["Priya Patel","CS2024002","priya@student.edu","9000000002","3","CSE","CS301,CS302,CS303"]
      ]}
    />
  )
}

