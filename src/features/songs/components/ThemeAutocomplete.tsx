import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { Plus, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, themeKey } from '@/lib/utils'
import { suggestThemes } from '@/features/songs/filter'

export interface ThemeAutocompleteProps {
  /** Temas já selecionados no formulário. */
  themes: string[]
  /** Temas já existentes na equipe (base das sugestões). */
  availableThemes: string[]
  /** Chamado quando um tema é adicionado. */
  onAddTheme: (theme: string) => void
  /** Chamado quando um tema é removido. */
  onRemoveTheme: (theme: string) => void
  /** ID do campo (associado ao <Label htmlFor>). */
  id?: string
  placeholder?: string
  ariaLabel?: string
}

/**
 * Autocomplete de temas (FR-013): ao digitar, sugere os temas que já existem na
 * equipe para evitar erros de digitação e duplicidade. Se o tema ainda não
 * existir, funciona como entrada livre — digite e confirme com Enter/Adicionar.
 */
export function ThemeAutocomplete({
  themes,
  availableThemes,
  onAddTheme,
  onRemoveTheme,
  id = 'song-theme-input',
  placeholder = 'Ex.: Adoração',
  ariaLabel = 'Adicionar tema',
}: ThemeAutocompleteProps) {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const selectedKeys = useMemo(
    () => new Set(themes.map((theme) => themeKey(theme))),
    [themes],
  )

  // Sugestões: temas existentes, ainda não selecionados, que casam com o texto.
  const suggestions = useMemo(
    () => suggestThemes(availableThemes, themes, inputValue),
    [availableThemes, inputValue, themes],
  )

  const showSuggestions = open && suggestions.length > 0

  const closeSuggestions = useCallback(() => {
    setOpen(false)
    setHighlightedIndex(-1)
  }, [])

  /** Adiciona o texto digitado, reaproveitando a grafia de um tema existente. */
  const addCurrentInput = useCallback(() => {
    const typed = inputValue.trim().replace(/\s+/g, ' ')
    if (!typed) return
    const key = themeKey(typed)
    if (!selectedKeys.has(key)) {
      const existing = availableThemes.find((theme) => themeKey(theme) === key)
      onAddTheme(existing ?? typed)
    }
    setInputValue('')
    closeSuggestions()
  }, [availableThemes, closeSuggestions, inputValue, onAddTheme, selectedKeys])

  const selectSuggestion = useCallback(
    (theme: string) => {
      if (!selectedKeys.has(themeKey(theme))) onAddTheme(theme)
      setInputValue('')
      closeSuggestions()
      inputRef.current?.focus()
    },
    [closeSuggestions, onAddTheme, selectedKeys],
  )

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
    setOpen(true)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      if (showSuggestions && highlightedIndex >= 0) {
        selectSuggestion(suggestions[highlightedIndex])
      } else {
        addCurrentInput()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!showSuggestions) return
      setHighlightedIndex((index) => (index + 1) % suggestions.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!showSuggestions) return
      setHighlightedIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      )
      return
    }
    if (event.key === 'Escape') {
      closeSuggestions()
      return
    }
    if (event.key === 'Tab') {
      closeSuggestions()
    }
  }

  // Fecha o dropdown ao clicar fora do componente.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        closeSuggestions()
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [closeSuggestions, open])

  const activeOptionId =
    showSuggestions && highlightedIndex >= 0
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined

  return (
    <div ref={wrapperRef} className="space-y-1.5">
      <div className="relative">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id={id}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim()) setOpen(true)
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCurrentInput}
            disabled={!inputValue.trim()}
            aria-label="Adicionar tema digitado"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar
          </Button>
        </div>

        {showSuggestions && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Temas existentes"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {suggestions.map((theme, index) => (
              <li
                key={theme}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={highlightedIndex === index}
                onMouseEnter={() => setHighlightedIndex(index)}
                // onMouseDown evita que o input perca o foco antes do clique.
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectSuggestion(theme)
                }}
                className={cn(
                  'cursor-pointer select-none rounded-sm px-3 py-2 text-sm',
                  highlightedIndex === index
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {theme}
              </li>
            ))}
          </ul>
        )}
      </div>

      {themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {themes.map((theme) => (
            <Badge key={theme} variant="secondary" className="gap-1">
              {theme}
              <button
                type="button"
                onClick={() => onRemoveTheme(theme)}
                aria-label={`Remover tema ${theme}`}
                className="rounded-full outline-none focus-visible:ring-2"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
