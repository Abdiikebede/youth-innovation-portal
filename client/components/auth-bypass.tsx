import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export function AuthBypass() {
  const navigate = useNavigate()

  useEffect(() => {
    // Removed all mock/dummy user and admin data. Use real authentication only.
  }, [])

  return null
}
