import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

const ClockContext = createContext(Date.now())

export function ClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>
}

export function useCurrentTime() {
  return useContext(ClockContext)
}
