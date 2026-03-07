import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

const themes = {
  'government-heritage': {
    name: 'Government Heritage',
    colors: {
      primary: '#1E3A8A',
      secondary: '#F59E0B',
      accent: '#DC2626',
      background: '#F9FAFB',
      surface: '#FFFFFF',
      text: '#111827',
      textLight: '#6B7280',
      border: '#D1D5DB',
    }
  },
  'tribal-earth': {
    name: 'Earth Theme',
    colors: {
      primary: '#8B4513',
      secondary: '#D2691E',
      accent: '#CD853F',
      accent2: '#228B22',
      background: '#FAF8F3',
      surface: '#FFFFFF',
      text: '#3E2723',
      textLight: '#6D4C41',
      border: '#D7CCC8',
    }
  },
  'modern-marketplace': {
    name: 'Modern Marketplace',
    colors: {
      primary: '#0891B2',
      secondary: '#8B5CF6',
      accent: '#EC4899',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
      textLight: '#64748B',
      border: '#E2E8F0',
    }
  },
  'vibrant-festival': {
    name: 'Vibrant Festival',
    colors: {
      primary: '#DC2626',
      secondary: '#F59E0B',
      accent: '#10B981',
      background: '#FFF7ED',
      surface: '#FFFFFF',
      text: '#1F2937',
      textLight: '#6B7280',
      border: '#FED7AA',
    }
  },
  'eco-sustainable': {
    name: 'Eco Sustainable',
    colors: {
      primary: '#059669',
      secondary: '#84CC16',
      accent: '#0891B2',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      text: '#14532D',
      textLight: '#166534',
      border: '#BBF7D0',
    }
  }
}

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    // If saved theme doesn't exist in themes object, use default
    return themes[savedTheme] ? savedTheme : 'tribal-earth'
  })

  useEffect(() => {
    const theme = themes[currentTheme]
    
    // Safety check: if theme doesn't exist, reset to default
    if (!theme) {
      setCurrentTheme('tribal-earth')
      return
    }
    
    const root = document.documentElement

    // Apply theme colors as CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })

    // Save to localStorage
    localStorage.setItem('theme', currentTheme)
  }, [currentTheme])

  const changeTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName)
    }
  }

  const value = {
    currentTheme,
    themeName: themes[currentTheme].name,
    themes: Object.keys(themes).map(key => ({
      id: key,
      name: themes[key].name
    })),
    changeTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
