import { useEffect, useState } from 'react'
import { api } from './api'

// Age (weeks/months + developmental-leap status) for a child, fetched once
// per child id. Shared by every tab so the leap window logic lives only in
// the backend (sonnenlicht/leaps.py).
export function useAge(child) {
  const [age, setAge] = useState(null)

  useEffect(() => {
    let cancelled = false
    setAge(null)
    api
      .getAge(child.id)
      .then((a) => {
        if (!cancelled) setAge(a)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [child.id, child.due_date])

  return age
}
