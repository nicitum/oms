"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Calendar, ChevronDown, ChevronUp, Edit, Loader2, LogOut, Trash2, ArrowLeft } from "lucide-react"

function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState({
    client_id: null,
    license_no: "",
    issue_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    duration: "1",
    duration_unit: "years",
    status: "Active",
  })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  // Format date to yyyy-MM-dd
  const formatDate = useCallback((date) => {
    if (!date) return ""
    const d = new Date(date)
    return d.toISOString().split("T")[0]
  }, [])

  // Update expiry date based on duration and unit
  const updateExpiryFromDuration = useCallback(
    (duration, unit, issueDate) => {
      if (!duration || !unit || !issueDate) return ""
      const start = new Date(issueDate)
      const durationNum = Number.parseInt(duration)
      const end = new Date(start)

      switch (unit) {
        case "seconds":
          end.setSeconds(start.getSeconds() + durationNum)
          break
        case "minutes":
          end.setMinutes(start.getMinutes() + durationNum)
          break
        case "hours":
          end.setHours(start.getHours() + durationNum)
          break
        case "days":
          end.setDate(start.getDate() + durationNum)
          break
        case "months":
          end.setMonth(start.getMonth() + durationNum)
          break
        case "years":
          end.setFullYear(start.getFullYear() + durationNum)
          break
        default:
          return ""
      }
      return formatDate(end)
    },
    [formatDate],
  )

  // Fetch clients with retry logic
  const fetchClients = useCallback(
    async (attempt = 1) => {
      setIsLoading(true)
      setError("")
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          setError("Please log in to view clients")
          navigate("/")
          return
        }

        const response = await fetch("http://localhost:3001/api/clients", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })

        console.log(`Fetch clients attempt ${attempt} - status:`, response.status)
        const data = await response.json()

        if (response.ok) {
          setClients(Array.isArray(data) ? data : [])
          setRetryCount(0)
        } else {
          if ((response.status === 401 || response.status === 403) && attempt <= MAX_RETRIES) {
            console.log(`Retry ${attempt}/${MAX_RETRIES} after ${response.status} error`)
            setRetryCount(attempt)
            setTimeout(() => fetchClients(attempt + 1), 1000 * attempt)
          } else {
            setError(data.error || `Failed to fetch clients (Status: ${response.status})`)
            if (response.status === 401 || response.status === 403) {
              localStorage.removeItem("token")
              localStorage.removeItem("username")
              navigate("/")
            }
          }
        }
      } catch (err) {
        console.error("Fetch clients error:", err)
        if (attempt <= MAX_RETRIES) {
          console.log(`Retry ${attempt}/${MAX_RETRIES} after network error`)
          setRetryCount(attempt)
          setTimeout(() => fetchClients(attempt + 1), 1000 * attempt)
        } else {
          setError("Network error occurred. Please check your connection or server status.")
        }
      } finally {
        if (attempt === 1 || attempt > MAX_RETRIES) {
          setIsLoading(false)
        }
      }
    },
    [navigate],
  )

  // Initial fetch
  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Update expiry_date when duration or unit changes
  useEffect(() => {
    if (formData.duration && formData.duration_unit && formData.issue_date) {
      const newExpiryDate = updateExpiryFromDuration(formData.duration, formData.duration_unit, formData.issue_date)
      if (newExpiryDate !== formData.expiry_date) {
        setFormData((prev) => ({ ...prev, expiry_date: newExpiryDate }))
      }
    }
  }, [formData.duration, formData.duration_unit, formData.issue_date, updateExpiryFromDuration])

  const handleDurationChange = (change) => {
    const currentDuration = Number.parseInt(formData.duration) || 1
    const newDuration = Math.max(1, currentDuration + change)
    setFormData((prev) => ({ ...prev, duration: newDuration.toString() }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (new Date(formData.issue_date) >= new Date(formData.expiry_date)) {
      setError("Expiry date must be after issue date")
      return
    }

    if (Number.parseInt(formData.duration) <= 0) {
      setError("Duration must be a positive number")
      return
    }

    const url = isEditing
      ? `http://localhost:3001/api/clients/${formData.client_id}`
      : "http://localhost:3001/api/clients"
    const method = isEditing ? "PUT" : "POST"

    try {
      setIsLoading(true)
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          license_no: formData.license_no,
          issue_date: formData.issue_date,
          expiry_date: formData.expiry_date,
          duration: Number.parseInt(formData.duration),
          status: formData.status,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setSuccess(data.message || (isEditing ? "Client updated successfully" : "Client added successfully"))
        setFormData({
          client_id: null,
          license_no: "",
          issue_date: new Date().toISOString().split("T")[0],
          expiry_date: "",
          duration: "1",
          duration_unit: "years",
          status: "Active",
        })
        setIsEditing(false)
        fetchClients()
      } else {
        setError(data.error || "Failed to save client")
      }
    } catch (err) {
      setError("Network error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (client) => {
    // Calculate duration and unit from dates
    const start = new Date(client.issue_date)
    const end = new Date(client.expiry_date)
    const diffTime = Math.abs(end - start)
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    let duration = 1
    let unit = "years"

    if (diffDays >= 365) {
      duration = Math.round(diffDays / 365)
      unit = "years"
    } else if (diffDays >= 30) {
      duration = Math.round(diffDays / 30)
      unit = "months"
    } else {
      duration = Math.round(diffDays)
      unit = "days"
    }

    setFormData({
      client_id: client.client_id,
      license_no: client.license_no,
      issue_date: formatDate(client.issue_date),
      expiry_date: formatDate(client.expiry_date),
      duration: duration.toString(),
      duration_unit: unit,
      status: client.status,
    })
    setIsEditing(true)
    setError("")
    setSuccess("")
  }

  const handleDelete = async (client_id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return

    try {
      setIsLoading(true)
      const response = await fetch(`http://localhost:3001/api/clients/${client_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      const data = await response.json()
      if (response.ok) {
        setSuccess(data.message || "Client deleted successfully")
        fetchClients()
      } else {
        setError(data.error || "Failed to delete client")
      }
    } catch (err) {
      setError("Network error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      client_id: null,
      license_no: "",
      issue_date: new Date().toISOString().split("T")[0],
      expiry_date: "",
      duration: "1",
      duration_unit: "years",
      status: "Active",
    })
    setIsEditing(false)
    setError("")
    setSuccess("")
  }

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return ""
    const date = new Date(dateTimeString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Expired":
        return "bg-red-100 text-red-800"
      case "Suspended":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">License Management</h1>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("token")
                localStorage.removeItem("username")
                navigate("/")
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">{isEditing ? "Edit License" : "Add New License"}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {isEditing
                  ? "Update the license information below"
                  : "Enter the license details to create a new record"}
              </p>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start">
                  <div className="flex-1">
                    {error} {retryCount > 0 && `(Retry ${retryCount}/${MAX_RETRIES})`}
                  </div>
                </div>
              )}
              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-start">
                  <div className="flex-1">{success}</div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">License Number</label>
                  <input
                    type="text"
                    value={formData.license_no}
                    onChange={(e) => setFormData({ ...formData, license_no: e.target.value })}
                    required
                    placeholder="Enter license number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Issue Date (Today)
                  </label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md cursor-not-allowed"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Duration</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleDurationChange(-1)}
                        className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-l-md hover:bg-slate-200 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        required
                        min="1"
                        className="w-16 px-3 py-2 border-t border-b border-slate-300 text-center focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleDurationChange(1)}
                        className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-r-md hover:bg-slate-200 transition-colors"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                    </div>

                    <select
                      value={formData.duration_unit}
                      onChange={(e) => setFormData({ ...formData, duration_unit: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                    >
                      <option value="days">Days</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Expiry Date (Auto-calculated)
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md"
                    readOnly
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors disabled:opacity-70"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isEditing ? "Update License" : "Add License"}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Licenses List</h2>
              <p className="text-sm text-slate-500 mt-1">Manage all client licenses from this dashboard</p>
            </div>
            <div className="p-6">
              {isLoading && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              )}

              {!isLoading && clients.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No licenses found. Add your first license to get started.
                </div>
              )}

              {!isLoading && clients.length > 0 && (
                <div className="overflow-x-auto -mx-6">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          License No
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Issue Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Expiry Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {clients.map((client) => (
                        <tr key={client.client_id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {client.license_no}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {formatDate(client.issue_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {formatDate(client.expiry_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                                client.status,
                              )}`}
                            >
                              {client.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(client)}
                                className="inline-flex items-center p-1.5 text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span className="sr-only">Edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(client.client_id)}
                                className="inline-flex items-center p-1.5 text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 text-xs text-slate-500">
                <p>Click on a license to view more details or edit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Clients
