import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '@/services/session'

/** Déconnexion automatique après 5 minutes sans interaction. */
export const INACTIVITY_LOGOUT_MS = 5 * 60_000

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'] as const


export function useInactivityLogout(timeoutMs = INACTIVITY_LOGOUT_MS) {
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef(Date.now())
  const loggingOutRef = useRef(false)

  const handleTimeout = useCallback(async () => {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await logout()
    navigate('/', { replace: true })
  }, [navigate])

  const scheduleLogout = useCallback(() => {
    if (loggingOutRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void handleTimeout()
    }, timeoutMs)
  }, [timeoutMs, handleTimeout])

  const registerActivity = useCallback(() => {
    if (loggingOutRef.current) return
    lastActivityRef.current = Date.now()
    scheduleLogout()
  }, [scheduleLogout])

  useEffect(() => {
    registerActivity()

    const onActivity = () => registerActivity()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= timeoutMs) {
        void handleTimeout()
      } else {
        scheduleLogout()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [registerActivity, scheduleLogout, handleTimeout, timeoutMs])
}
