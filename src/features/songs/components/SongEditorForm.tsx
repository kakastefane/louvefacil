import { useRef, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X } from 'lucide-react'

import { ChordPreview } from '@/features/songs/components/ChordPreview'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { normalizeThemes, isOnline } from '@/lib/utils'
import type { SongDraft } from '@/types/domain'

const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const NONE_KEY = '__none__'
export const CONTENT_MAX_LENGTH = 20000

const songFormSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título da cifra.').max(200, 'O título deve ter até 200 caracteres.'),
  artist: z.string().trim().max(120, 'O artista deve ter até 120 caracteres.').optional().or(z.literal('')),
  original_key: z.string().nullable().optional(),
  themes: z.array(z.string()).default([]),
  content: z.string().min(1, 'Informe o conteúdo da cifra em ChordPro.').max(CONTENT_MAX_LENGTH, 'O conteúdo deve ter até 20000 caracteres.'),
})

export type SongEditorFormValues = z.infer<typeof songFormSchema>

export function songDraftFromForm(values: SongEditorFormValues): SongDraft {
  const title = values.title.trim()
  const artist = values.artist?.trim() ? values.artist.trim() : null
  const originalKey = values.original_key && values.original_key !== NONE_KEY ? values.original_key : null
  return { title, artist, original_key: originalKey, themes: normalizeThemes(values.themes), content: values.content }
}

interface SongEditorFormProps {
  defaultValues?: Partial<SongEditorFormValues>
  onSubmit: (values: SongEditorFormValues) => Promise<void>
  submitting?: boolean
  serverError?: string | null
  submitLabel?: string
  preview?: ReactNode
}

export function SongEditorForm({
  defaultValues,
  onSubmit,
  submitting = false,
  serverError,
  submitLabel = 'Salvar cifra',
  preview,
}: SongEditorFormProps) {
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<SongEditorFormValues>({
    resolver: zodResolver(songFormSchema) as unknown as Resolver<SongEditorFormValues>,
    defaultValues: { title: '', artist: '', original_key: null, themes: [], content: '', ...defaultValues },
  })

  const content = useWatch({ control, name: 'content' }) ?? ''
  const themes = useWatch({ control, name: 'themes' }) ?? []
  const [themeInput, setThemeInput] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== '[') return
    e.preventDefault()
    const el = contentRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = content.slice(0, start) + '[]' + content.slice(end)
    setValue('content', next, { shouldDirty: true, shouldValidate: true })
    requestAnimationFrame(() => {
      if (contentRef.current) {
        contentRef.current.selectionStart = start + 1
        contentRef.current.selectionEnd = start + 1
      }
    })
  }

  const addTheme = () => {
    const candidate = themeInput.trim()
    if (!candidate) return
    setValue('themes', normalizeThemes([...themes, candidate]), { shouldDirty: true, shouldValidate: true })
    setThemeInput('')
  }

  const removeTheme = (theme: string) => {
    setValue('themes', themes.filter((t) => t !== theme), { shouldDirty: true, shouldValidate: true })
  }

  const { ref: registerRef, ...contentRegisterProps } = control.register('content')
  const handleContentRef = (el: HTMLTextAreaElement | null) => {
    contentRef.current = el
    if (registerRef) registerRef(el)
  }
  const offline = !isOnline()

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Editor de cifra</CardTitle>
        <CardDescription>
          ChordPro: {'{tom: G}'}, seções entre [Colchetes] e acordes entre colchetes,
          ex.: [G]Antes de me conhe[C]ces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError ? (
          <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="song-title">Título *</Label>
              <Input id="song-title" aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? 'song-title-error' : undefined} {...control.register('title')} placeholder="Nome da canção" />
              {errors.title ? <p id="song-title-error" className="text-xs text-destructive">{errors.title.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="song-artist">Artista</Label>
              <Input id="song-artist" aria-invalid={errors.artist ? true : undefined} aria-describedby={errors.artist ? 'song-artist-error' : undefined} {...control.register('artist')} placeholder="Ministração / banda" />
              {errors.artist ? <p id="song-artist-error" className="text-xs text-destructive">{errors.artist.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="song-key">Tom original</Label>
              <Controller
                control={control}
                name="original_key"
                render={({ field }) => (
                  <Select value={field.value ?? NONE_KEY} onValueChange={(value) => field.onChange(value === NONE_KEY ? null : value)}>
                    <SelectTrigger id="song-key" className="w-40"><SelectValue placeholder="Sem tom" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_KEY}>Sem tom</SelectItem>
                      {NOTES.map((note) => <SelectItem key={note} value={note}>{note}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="song-theme-input">Temas</Label>
              <div className="flex gap-2">
                <Input id="song-theme-input" value={themeInput} onChange={(e) => setThemeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTheme() } }} placeholder="Ex.: Adoração" aria-label="Adicionar tema" />
                <Button type="button" variant="outline" onClick={addTheme}>Adicionar</Button>
              </div>
              {themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((theme) => (
                    <Badge key={theme} variant="secondary" className="gap-1">
                      {theme}
                      <button type="button" onClick={() => removeTheme(theme)} aria-label={`Remover tema ${theme}`} className="rounded-full outline-none focus-visible:ring-2"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="song-content">Conteúdo *</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{content.length} / {CONTENT_MAX_LENGTH}</span>
              </div>
              <Textarea
                id="song-content"
                ref={handleContentRef}
                rows={14}
                className="font-mono text-sm"
                aria-invalid={errors.content ? true : undefined}
                aria-describedby={errors.content ? 'song-content-error' : undefined}
                placeholder={'{tom: G}\n\n[Verso 1]\n[G]Antes de me conhe[C]ces'}
                {...contentRegisterProps}
                onKeyDown={handleContentKeyDown}
              />
              {errors.content ? <p id="song-content-error" className="text-xs text-destructive">{errors.content.message}</p> : null}
            </div>

            {offline && <p role="status" className="text-xs text-muted-foreground">Sem conexão — salvar exige internet. O rascunho permanece preenchido.</p>}

            <div className="mt-1 flex items-center gap-3">
              <Button type="submit" disabled={submitting || offline} aria-busy={submitting}>
                {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Salvando…</>) : (submitLabel)}
              </Button>
            </div>
          </div>

          <div className="min-h-[24rem]">
            {preview ?? <ChordPreview content={content} className="h-full min-h-[24rem]" />}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function SongEditorPreview({ content }: { content: string }) {
  return <ChordPreview content={content} className="h-full min-h-[24rem]" />
}