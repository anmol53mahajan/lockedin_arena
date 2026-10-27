import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const trimmedApiUrl = configuredApiUrl.replace(/\/+$/, '')
const apiPath = new URL(trimmedApiUrl).pathname.replace(/\/+$/, '')
const apiBaseUrl = apiPath ? trimmedApiUrl : `${trimmedApiUrl}/api`

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('lockedin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
