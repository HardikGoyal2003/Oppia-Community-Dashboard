"use client"

import { createContext, useContext, useState } from "react"

const LoadingContext = createContext<{
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
} | null>(null)

export const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        startLoading: () => setIsLoading(true),
        stopLoading: () => setIsLoading(false),
      }}
    >
      {children}
    </LoadingContext.Provider>
  )
}

export const useLoading = () => {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error("useLoading must be used inside LoadingProvider")
  return ctx
}