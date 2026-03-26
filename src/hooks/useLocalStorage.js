import { useEffect, useState } from 'react'

export const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore quota/private mode issues.
    }
  }, [key, value])

  return [value, setValue]
}

