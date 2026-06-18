"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Profile = {
  id: string
  name: string
  goal: string
  calorieTarget: number | null
  proteinTarget: number | null
  carbTarget: number | null
  fatTarget: number | null
  proteinCapG: number | null
  sugarTarget: number | null
}

type ProfileContextType = {
  profiles: Profile[]
  activeProfile: Profile | null
  setActiveProfile: (profile: Profile) => void
  loading: boolean
  refetch: () => void
}

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  activeProfile: null,
  setActiveProfile: () => {},
  loading: true,
  refetch: () => {},
})

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/profiles")
      const data = await res.json()
      setProfiles(data)

      // Restore active profile from localStorage
      const stored = localStorage.getItem("activeProfileId")
      const match = data.find((p: Profile) => p.id === stored) ?? data[0] ?? null
      setActiveProfileState(match)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfiles() }, [])

  const setActiveProfile = (profile: Profile) => {
    setActiveProfileState(profile)
    localStorage.setItem("activeProfileId", profile.id)
  }

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, setActiveProfile, loading, refetch: fetchProfiles }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
