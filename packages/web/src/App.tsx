import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { RedirectIfAuthenticated, RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/AppShell';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { AuditLogPage } from '@/pages/admin/AuditLogPage';
import { ClientsPage } from '@/pages/admin/ClientsPage';
import { LessonPreviewPage } from '@/pages/admin/LessonPreviewPage';
import { TrackEditorPage } from '@/pages/admin/TrackEditorPage';
import { TracksPage } from '@/pages/admin/TracksPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LessonPage } from '@/pages/LessonPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The API client already retries once after silently refreshing an
      // expired token. Retrying again on top of that would turn a real error
      // into three, and make a genuinely broken screen take far longer to say so.
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Signed out. A signed-in visitor is bounced to the dashboard. */}
                <Route element={<RedirectIfAuthenticated />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/invite/:token" element={<AcceptInvitePage />} />
                </Route>

                {/* Reachable either way: someone mid-reset may still hold a session. */}
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

                {/* Signed in. */}
                <Route element={<RequireAuth />}>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/aulas/:lessonId" element={<LessonPage />} />

                    {/* Authoring is Kosmos-only; the guard sends anyone else home. */}
                    <Route element={<RequireAuth allow={['SUPERADMIN']} />}>
                      <Route path="/admin/clients" element={<ClientsPage />} />
                      <Route path="/admin/tracks" element={<TracksPage />} />
                      <Route path="/admin/tracks/:trackId" element={<TrackEditorPage />} />
                      <Route
                        path="/admin/tracks/:trackId/preview"
                        element={<LessonPreviewPage />}
                      />
                      <Route path="/admin/audit" element={<AuditLogPage />} />
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  );
}
