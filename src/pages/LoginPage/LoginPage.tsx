import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import collectSideImage from '../../assets/COLLECT2.png'
import logo from '../../assets/logo-1.png'
import { SideImagePanel } from '../../components/SideImagePanel'
import { login, resetPasswordWeb } from '../../services/auth'
import {
  isAuthenticated,
  isRememberSessionEnabled,
  setAuthSession,
  setStoredBasicAuthorization,
} from '@/utils/auth-session'
import { defaultCodeOperationRenvoiParametres } from '@/utils/default-code-operation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetClosing, setResetClosing] = useState(false)
  const [resetLogin, setResetLogin] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('coopec_remember_username')?.trim()
      if (saved) setUsername(saved)
      setRememberMe(isRememberSessionEnabled() || Boolean(saved))
      if (isAuthenticated()) {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      // ignore
    }
  }, [navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await login({ username, password })
      if (!result.auth?.user && !result.token) {
        throw new Error('Réponse de connexion invalide')
      }
      const auth =
        result.auth ??
        ({
          isLogin: true,
          user: {
            codeAgence: result.userContext.agency !== '—' ? result.userContext.agency : '',
            email: result.userContext.email,
            etat: 1,
            habilitation: 0,
            login: result.userContext.login,
            nomUtilisateur: result.userContext.name,
            profil: 0,
            reinitialisercompte: 0,
            superviseur: 0,
            telephone: result.userContext.telephone,
            typeUtilisateur: 0,
          },
        } satisfies import('@/services/auth').AuthResponse)
      setAuthSession(auth, result.userContext, result.token)
      // login-web returns no JWT; Swagger still works via HTTP Basic (browser doesn't re-prompt).
      setStoredBasicAuthorization(username, password)
      try {
        if (rememberMe) localStorage.setItem('coopec_remember_username', username.trim())
        else localStorage.removeItem('coopec_remember_username')
      } catch {
        // ignore
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  function closeReset() {
    if (resetClosing) return
    setResetClosing(true)
    setTimeout(() => {
      setResetOpen(false)
      setResetClosing(false)
    }, 250)
  }

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault()
    const trimmedLogin = resetLogin.trim()
    if (!trimmedLogin) {
      setResetError('Veuillez saisir votre identifiant.')
      return
    }
    setResetSubmitting(true)
    setResetError(null)
    setResetSuccess(null)
    try {
      const codeOperation = defaultCodeOperationRenvoiParametres() || 'RESET'
      const codeBanque = 'Z1234'
      await resetPasswordWeb({ codeOperation, codeBanque, login: trimmedLogin })
      setResetSuccess('Votre demande de réinitialisation a été envoyée. Veuillez vérifier votre messagerie.')
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Impossible de réinitialiser le mot de passe.')
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
          <img
            src={logo}
            alt="Coopec"
            className="fade-in-up mb-6 h-16 w-auto object-contain sm:h-20"
          />

          <div className="w-full sm:max-w-sm">
            <h1 className="fade-in-up-2 text-center text-2xl font-semibold tracking-tight">
              Se connecter
            </h1>
            <p className="fade-in-up-3 mt-2 text-center text-sm text-muted-foreground">
              Entrez vos identifiants pour accéder à votre espace.
            </p>

            <form
              onSubmit={onSubmit}
              className="fade-in-up-3 mt-8 w-full space-y-4 [animation-delay:120ms]"
            >
              <div className="fade-in-up-3 [animation-delay:200ms]">
                <Label htmlFor="login-username" className="text-sm text-foreground">
                  Identifiant
                </Label>
                <Input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  className="mt-2"
                  placeholder="Votre identifiant"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="fade-in-up-3 [animation-delay:260ms]">
                <Label htmlFor="login-password" className="text-sm text-foreground">
                  Mot de passe
                </Label>
                <div className="relative mt-2">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute inset-y-0 right-0 inline-flex items-center justify-center rounded-r-lg px-3 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {showPassword ? (
                        <>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                          <path d="M3 3l18 18" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              <div className="fade-in-up-3 flex items-center justify-between [animation-delay:320ms]">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
                  <Label htmlFor="remember-me" className="text-sm font-normal text-muted-foreground">
                    Rester connecté (session enregistrée sur cet appareil)
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80"
                  onClick={() => {
                    setResetOpen(true)
                    setResetLogin(username)
                    setResetError(null)
                    setResetSuccess(null)
                  }}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {error && (
                <Alert variant="destructive" className="fade-in-up-3 [animation-delay:340ms]">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !username || !password}
                className="fade-in-up-3 w-full [animation-delay:380ms]"
              >
                {isSubmitting ? 'Connexion…' : 'Connexion'}
              </Button>

              <p className="fade-in-up-3 text-xs text-muted-foreground [animation-delay:440ms]">
                En continuant, vous acceptez les conditions d’utilisation.
              </p>
            </form>
          </div>
        </div>

        <SideImagePanel
          className="relative hidden lg:block"
          imageSrc={collectSideImage}
          imageAlt="Coopec"
          caption="Sécurisez et centralisez les opérations de votre coopérative."
        />
      </div>

      {resetOpen && (
        <div
          className={[
            'fixed inset-0 z-50 flex items-center justify-center px-4',
            'transition-all duration-250 ease-out',
            resetClosing
              ? 'bg-foreground/0 backdrop-blur-0 opacity-0'
              : 'bg-foreground/30 backdrop-blur-sm opacity-100 animate-[fadeIn_250ms_ease-out_both]',
          ].join(' ')}
          onClick={(e) => {
            if (e.target === e.currentTarget && !resetSubmitting) closeReset()
          }}
        >
          <div
            className={[
              'w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl',
              'transition-all duration-250 ease-out',
              resetClosing
                ? 'translate-y-4 scale-95 opacity-0'
                : 'animate-[modalIn_300ms_ease-out_both]',
            ].join(' ')}
          >
            <h2 className="text-lg font-semibold tracking-tight">Réinitialiser le mot de passe</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saisissez votre identifiant pour recevoir les instructions de réinitialisation.
            </p>

            <form onSubmit={onResetPassword} className="mt-5 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-login">Identifiant</Label>
                <Input
                  id="reset-login"
                  type="text"
                  autoComplete="username"
                  placeholder="Votre identifiant"
                  value={resetLogin}
                  onChange={(e) => setResetLogin(e.target.value)}
                  disabled={resetSubmitting}
                />
              </div>

              {resetError && (
                <Alert variant="destructive">
                  <AlertDescription>{resetError}</AlertDescription>
                </Alert>
              )}

              {resetSuccess && (
                <Alert>
                  <AlertDescription className="text-primary">{resetSuccess}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeReset}
                  disabled={resetSubmitting}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={resetSubmitting || !resetLogin.trim()}>
                  {resetSubmitting ? 'Envoi…' : 'Réinitialiser'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

