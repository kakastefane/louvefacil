import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, Copy, Loader2, LogOut, Plus, Trash2 } from 'lucide-react'

import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateDisplayName } from '@/db/repos/teams'
import { useTeam } from '@/features/teams/TeamContext'
import { generateInvite, listInvites, revokeInvite } from '@/features/teams/invites'
import {
  leaveTeam,
  listMembers,
  removeMember,
  updateMemberRole,
  type EditableRole,
} from '@/features/teams/members'
import { useAuth } from '@/hooks/useAuth'
import {
  INVITE_DEFAULT_EXPIRY_DAYS,
  formatDatePtBr,
  friendlyErrorMessage,
  isInviteActive,
} from '@/lib/utils'
import { canManage, type Invite, type TeamMember, type TeamRole } from '@/types/domain'

/** Rótulos PT-BR dos papéis (FR-029: restrições visíveis na UI). */
const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Dono',
  editor: 'Editor',
  member: 'Membro',
}

/**
 * Erros das services de membros/convites chegam com mensagem PT-BR pronta —
 * exibimos direto. Códigos crus (offline_write, rede, Postgres) caem no mapa
 * central amigável.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
    const looksReadyPtBr =
      message.length > 0 &&
      /\s/.test(message) &&
      !/failed|fetch|network|denied|permission|token|jwt|duplicate|violat|schema|column|relation|invalid|expired|not_/i.test(
        message,
      )
    if (looksReadyPtBr) return message
  }
  return friendlyErrorMessage(error)
}

/** Prazo de convite explícito (1 ou 30 dias; 7 usa o default do repo). */
function inviteExpiryForDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/**
 * Tela de configurações da equipe ativa (T026, `/config`): perfil
 * (display_name), membros (papel/remoção — dono), convites (gerar, copiar,
 * revogar — dono), sair da equipe (não-dono) e logout (FR-006/FR-029).
 */
export function SettingsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { activeTeam, activeMember, loading: teamLoading, refresh } = useTeam()

  // perfil
  const [displayName, setDisplayName] = useState(activeMember?.display_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameFeedback, setNameFeedback] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  // membros
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [memberActionError, setMemberActionError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  // convites (somente dono)
  const canManageTeam = activeMember ? canManage(activeMember.role) : false
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [invitesError, setInvitesError] = useState<string | null>(null)
  const [inviteDays, setInviteDays] = useState(INVITE_DEFAULT_EXPIRY_DAYS)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [copiedRawCode, setCopiedRawCode] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)
  const [revokingInvite, setRevokingInvite] = useState(false)
  const [inviteActionError, setInviteActionError] = useState<string | null>(null)

  // sair da equipe / logout
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const teamId = activeTeam?.id ?? null

  // o campo de nome acompanha o membro ativo (troca de equipe/refresh)
  useEffect(() => {
    setDisplayName(activeMember?.display_name ?? '')
  }, [activeMember?.display_name])

  // feedbacks temporários (nome salvo / link copiado) somem sozinhos
  useEffect(() => {
    if (!nameFeedback && !copiedCode && !copiedRawCode) return
    const timer = window.setTimeout(() => {
      setNameFeedback(null)
      setCopiedCode(null)
      setCopiedRawCode(null)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [nameFeedback, copiedCode, copiedRawCode])

  const loadMembers = useCallback(async () => {
    if (!teamId) return
    setMembersLoading(true)
    setMembersError(null)
    try {
      setMembers(await listMembers(teamId))
    } catch (error) {
      setMembersError(describeError(error))
    } finally {
      setMembersLoading(false)
    }
  }, [teamId])

  const loadInvites = useCallback(async () => {
    if (!teamId) return
    setInvitesLoading(true)
    setInvitesError(null)
    try {
      setInvites(await listInvites(teamId))
    } catch (error) {
      setInvitesError(describeError(error))
    } finally {
      setInvitesLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    // convites são visíveis somente ao dono (RLS também filtra no servidor)
    if (canManageTeam) void loadInvites()
  }, [canManageTeam, loadInvites])

  async function handleSaveName() {
    if (!activeMember) return
    const name = displayName.trim()
    if (!name) return
    setSavingName(true)
    setNameError(null)
    setNameFeedback(null)
    try {
      const updated = await updateDisplayName(activeMember.id, name)
      setDisplayName(updated.display_name)
      setNameFeedback('Nome atualizado.')
      await refresh()
    } catch (error) {
      setNameError(describeError(error))
    } finally {
      setSavingName(false)
    }
  }

  async function handleRoleChange(member: TeamMember, role: string) {
    if (role !== 'editor' && role !== 'member') return
    setBusyMemberId(member.id)
    setMemberActionError(null)
    try {
      await updateMemberRole(member.id, role as EditableRole)
      await loadMembers()
    } catch (error) {
      // o Select é controlado pela lista: em erro a UI continua como antes
      setMemberActionError(describeError(error))
    } finally {
      setBusyMemberId(null)
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return
    setRemovingMember(true)
    setMemberActionError(null)
    try {
      await removeMember(removeTarget.id)
      setRemoveTarget(null)
      await loadMembers()
    } catch (error) {
      setMemberActionError(describeError(error))
    } finally {
      setRemovingMember(false)
    }
  }

  async function handleGenerateInvite() {
    if (!teamId) return
    setGeneratingInvite(true)
    setInvitesError(null)
    try {
      // 7 dias é o default do repositório (defaultInviteExpiry()); os outros
      // prazos vão explícitos
      const expiresAt =
        inviteDays === INVITE_DEFAULT_EXPIRY_DAYS
          ? undefined
          : inviteExpiryForDays(inviteDays)
      await generateInvite(teamId, expiresAt)
      await loadInvites()
    } catch (error) {
      setInvitesError(describeError(error))
    } finally {
      setGeneratingInvite(false)
    }
  }

  async function handleCopyInviteLink(invite: Invite) {
    const link = `${window.location.origin}/convite/${invite.code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedCode(invite.code)
    } catch {
      setInvitesError('Não foi possível copiar o link. Copie o código manualmente.')
    }
  }

  async function handleCopyInviteCode(invite: Invite) {
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopiedRawCode(invite.code)
    } catch {
      setInvitesError('Não foi possível copiar o código. Selecione e copie manualmente.')
    }
  }

  async function handleRevokeInvite() {
    if (!revokeTarget) return
    setRevokingInvite(true)
    setInviteActionError(null)
    try {
      await revokeInvite(revokeTarget.id)
      setRevokeTarget(null)
      await loadInvites()
    } catch (error) {
      setInviteActionError(describeError(error))
    } finally {
      setRevokingInvite(false)
    }
  }

  async function handleLeaveTeam() {
    if (!teamId) return
    setLeaving(true)
    setLeaveError(null)
    try {
      await leaveTeam(teamId)
      setLeaveOpen(false)
      await refresh()
      navigate('/equipes')
    } catch (error) {
      setLeaveError(describeError(error))
    } finally {
      setLeaving(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      // o provider limpa Dexie e estado; o RequireAuth redireciona para /login
      await signOut()
    } catch (error) {
      setLogoutError(describeError(error))
    } finally {
      setLoggingOut(false)
    }
  }

  // sem equipe ativa: o usuário gerencia vínculos em /equipes
  if (!activeTeam || !activeMember) {
    if (teamLoading) return <LoadingState fullScreen />
    if (!user) return <LoadingState fullScreen />
    return (
      <div className="w-full">
        <EmptyState
          title="Você não faz parte de nenhuma equipe"
          description="Crie uma equipe ou entre pelo link de convite para acessar as configurações."
          action={
            <Button onClick={() => navigate('/equipes')}>Ir para minhas equipes</Button>
          }
        />
      </div>
    )
  }

  const nameUnchanged =
    displayName.trim() === '' || displayName.trim() === activeMember.display_name

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {activeTeam.name}
          <Badge variant={canManageTeam ? 'default' : 'outline'}>
            {ROLE_LABELS[activeMember.role]}
          </Badge>
        </p>
      </header>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            Seu nome de exibição nesta equipe ({activeTeam.name}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Nome de exibição</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={savingName}
                placeholder="Como você aparece para a equipe"
                maxLength={80}
              />
              <Button
                onClick={() => void handleSaveName()}
                disabled={savingName || nameUnchanged}
              >
                {savingName ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
            {nameFeedback ? (
              <p className="flex items-center gap-1 text-sm font-medium text-green-600">
                <Check className="h-3.5 w-3.5" /> {nameFeedback}
              </p>
            ) : null}
            {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
          </div>
        </CardContent>
      </Card>

      {/* Membros (visível a todos; controles só para o dono — FR-029) */}
      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>
            {canManageTeam
              ? 'Altere o papel ou remova membros da equipe.'
              : 'Integrantes desta equipe.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {membersLoading && members === null ? <LoadingState /> : null}
          {membersError ? (
            <ErrorState message={membersError} onRetry={() => void loadMembers()} />
          ) : null}
          {members !== null && members.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum membro além de você ainda — convide novas pessoas na seção
              de convites.
            </p>
          ) : null}
          {members?.map((member) => {
            const isSelf = member.id === activeMember.id
            const isOwner = member.role === 'owner'
            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{member.display_name}</p>
                    {isSelf ? <Badge variant="secondary">Você</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Entrou em {formatDatePtBr(member.joined_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canManageTeam && !isOwner ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(value) => void handleRoleChange(member, value)}
                        disabled={busyMemberId === member.id}
                      >
                        <SelectTrigger className="h-8 w-32" aria-label={`Papel de ${member.display_name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="member">Membro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRemoveTarget(member)}
                        disabled={busyMemberId === member.id}
                        aria-label={`Remover ${member.display_name}`}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  ) : (
                    <Badge variant={isOwner ? 'default' : 'outline'}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
          {memberActionError && !removeTarget ? (
            <p className="text-sm text-destructive">{memberActionError}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Convites (somente dono — FR-006) */}
      {canManageTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>Convites</CardTitle>
            <CardDescription>
              Gere links para novas pessoas entrarem na equipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="invite-expiry">Prazo de validade</Label>
                <Select
                  value={String(inviteDays)}
                  onValueChange={(value) => setInviteDays(Number(value))}
                >
                  <SelectTrigger id="invite-expiry" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="sm:ml-auto"
                onClick={() => void handleGenerateInvite()}
                disabled={generatingInvite}
              >
                {generatingInvite ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando…
                  </>
                ) : (
                  <>
                    <Plus /> Gerar convite
                  </>
                )}
              </Button>
            </div>

            {invitesError ? (
              <ErrorState message={invitesError} onRetry={() => void loadInvites()} />
            ) : null}
            {invitesLoading && invites === null ? <LoadingState /> : null}
            {invites !== null && invites.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum convite gerado ainda.
              </p>
            ) : null}
            {invites?.map((invite) => {
              const revoked = invite.revoked
              const active = isInviteActive(invite)
              const statusLabel = revoked ? 'Revogado' : active ? 'Ativo' : 'Expirado'
              const statusVariant: 'default' | 'secondary' | 'destructive' = revoked
                ? 'destructive'
                : active
                  ? 'default'
                  : 'secondary'
              return (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                        {invite.code}
                      </code>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expira em {formatDatePtBr(invite.expires_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {active ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyInviteLink(invite)}
                        >
                          <Copy />
                          {copiedCode === invite.code
                            ? 'Link copiado'
                            : 'Copiar link'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyInviteCode(invite)}
                        >
                          <Copy />
                          {copiedRawCode === invite.code
                            ? 'Código copiado'
                            : 'Copiar código'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget(invite)}
                          disabled={revokingInvite}
                        >
                          Revogar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {inviteActionError ? (
              <p className="text-sm text-destructive">{inviteActionError}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Sair da equipe (não-dono: a RPC recusa o dono) */}
      {!canManageTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>Sair da equipe</CardTitle>
            <CardDescription>
              Você perde o acesso às cifras e setlists de {activeTeam.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setLeaveOpen(true)}
            >
              Sair da equipe
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Sessão */}
      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>
            Encerra a sessão neste dispositivo ({user?.email ?? 'sua conta'}). O
            cache local é limpo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setLogoutOpen(true)}>
            <LogOut /> Encerrar sessão
          </Button>
        </CardContent>
      </Card>

      {/* Confirmação: remover membro */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover membro</DialogTitle>
            <DialogDescription>
              Remover {removeTarget?.display_name} de {activeTeam.name}? A pessoa
              perde o acesso imediatamente.
            </DialogDescription>
          </DialogHeader>
          {memberActionError ? (
            <p className="text-sm text-destructive">{memberActionError}</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removingMember}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRemoveMember()}
              disabled={removingMember}
            >
              {removingMember ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removendo…
                </>
              ) : (
                'Remover'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: revogar convite */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar convite</DialogTitle>
            <DialogDescription>
              O link do convite <strong>{revokeTarget?.code}</strong> deixa de
              funcionar. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {inviteActionError ? (
            <p className="text-sm text-destructive">{inviteActionError}</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeTarget(null)}
              disabled={revokingInvite}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRevokeInvite()}
              disabled={revokingInvite}
            >
              {revokingInvite ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Revogando…
                </>
              ) : (
                'Revogar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: sair da equipe */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair da equipe</DialogTitle>
            <DialogDescription>
              Você sai de {activeTeam.name} e perde o acesso às cifras e setlists.
              Para voltar, será preciso um novo convite.
            </DialogDescription>
          </DialogHeader>
          {leaveError ? <p className="text-sm text-destructive">{leaveError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={leaving}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleLeaveTeam()}
              disabled={leaving}
            >
              {leaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saindo…
                </>
              ) : (
                'Sair da equipe'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: logout */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar sessão</DialogTitle>
            <DialogDescription>
              Você volta para a tela de login. Os dados locais desta conta são
              apagados deste dispositivo.
            </DialogDescription>
          </DialogHeader>
          {logoutError ? (
            <p className="text-sm text-destructive">{logoutError}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)} disabled={loggingOut}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Encerrando…
                </>
              ) : (
                'Encerrar sessão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
