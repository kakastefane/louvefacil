import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import {
  RequireAuth,
  RequireConfig,
  RequireEditor,
  RequireTeam,
} from '@/app/guards'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import { TeamProvider } from '@/features/teams/TeamContext'
import { RecoverPasswordPage } from '@/features/auth/pages/RecoverPasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { InvitePage } from '@/features/teams/pages/InvitePage'
import { SettingsPage } from '@/features/teams/pages/SettingsPage'
import { TeamsPage } from '@/features/teams/pages/TeamsPage'
import { LibraryPage } from '@/features/songs/pages/LibraryPage'
import { SongEditorPage } from '@/features/songs/pages/SongEditorPage'
import { SongViewerPage } from '@/features/songs/pages/SongViewerPage'
import { PlayModePage } from '@/features/setlists/pages/PlayModePage'
import { SetlistDetailPage } from '@/features/setlists/pages/SetlistDetailPage'
import { SetlistsPage } from '@/features/setlists/pages/SetlistsPage'
import { SetupPage } from '@/features/settings/pages/SetupPage'

/** Mapa de rotas conforme contracts/routes.md (guardas em camadas). */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TeamProvider>
          <BrowserRouter>
            <RequireConfig>
              <Routes>
                {/* públicas */}
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/recuperar-senha"
                  element={<RecoverPasswordPage />}
                />
                <Route path="/convite/:code" element={<InvitePage />} />

                {/* protegidas: sessão + equipe ativa */}
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route path="/equipes" element={<TeamsPage />} />
                  <Route
                    path="/biblioteca"
                    element={
                      <RequireTeam>
                        <LibraryPage />
                      </RequireTeam>
                    }
                  />
                  <Route
                    path="/cifra/nova"
                    element={
                      <RequireTeam>
                        <RequireEditor>
                          <SongEditorPage />
                        </RequireEditor>
                      </RequireTeam>
                    }
                  />
                  <Route
                    path="/cifra/:id"
                    element={
                      <RequireTeam>
                        <SongViewerPage />
                      </RequireTeam>
                    }
                  />
                  <Route
                    path="/cifra/:id/editar"
                    element={
                      <RequireTeam>
                        <RequireEditor>
                          <SongEditorPage />
                        </RequireEditor>
                      </RequireTeam>
                    }
                  />
                  <Route
                    path="/setlists"
                    element={
                      <RequireTeam>
                        <SetlistsPage />
                      </RequireTeam>
                    }
                  />
                  <Route
                    path="/setlist/:id"
                    element={
                      <RequireTeam>
                        <SetlistDetailPage />
                      </RequireTeam>
                    }
                  />
                  <Route
                    path="/setlist/:id/tocar"
                    element={
                      <RequireTeam>
                        <PlayModePage />
                      </RequireTeam>
                    }
                  />
                  <Route path="/config" element={<SettingsPage />} />
                  <Route path="/" element={<Navigate to="/biblioteca" replace />} />
                  <Route
                    path="*"
                    element={<Navigate to="/biblioteca" replace />}
                  />
                </Route>
              </Routes>
            </RequireConfig>
          </BrowserRouter>
        </TeamProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
