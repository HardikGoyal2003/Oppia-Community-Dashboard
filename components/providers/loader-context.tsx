"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

const LoadingContext = createContext<{
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
} | null>(null)

export const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false)
  const startLoading = useCallback(() => setIsLoading(true), [])
  const stopLoading = useCallback(() => setIsLoading(false), [])

  const value = useMemo(
    () => ({
      isLoading,
      startLoading,
      stopLoading,
    }),
    [isLoading, startLoading, stopLoading]
  )

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error("useLoading must be used inside LoadingProvider")
  return ctx
}
