import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAdminKey } from '../auth.js'
import { AdminStep } from './setup/AdminStep.js'
import { BrandingStep } from './setup/BrandingStep.js'
import { ModulesStep } from './setup/ModulesStep.js'
import { StoreStep } from './setup/StoreStep.js'
import { SummaryStep } from './setup/SummaryStep.js'
import { ThemeStep } from './setup/ThemeStep.js'
import { INITIAL, type SetupData, type Step } from './setup/types.js'

const STEPS: Step[] = ['store', 'modules', 'branding', 'theme', 'admin', 'summary']
const STEP_LABELS: Record<Step, string> = {
  store: 'Store',
  modules: 'Modules',
  branding: 'Branding',
  theme: 'Theme',
  admin: 'Security',
  summary: 'Launch',
}

type LaunchStatus = 'idle' | 'saving' | 'restarting' | 'done' | 'error'

function randomKey() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('store')
  const [data, setData] = useState<SetupData>({ ...INITIAL, adminKey: randomKey() })
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>('idle')
  const [launchError, setLaunchError] = useState('')

  const stepIdx = STEPS.indexOf(step)
  const next = () => setStep(STEPS[stepIdx + 1]!)
  const back = () => setStep(STEPS[stepIdx - 1]!)
  const patch = (p: Partial<SetupData>) => setData((d) => ({ ...d, ...p }))

  useEffect(() => {
    if (launchStatus !== 'restarting') return
    let tries = 0
    const id = setInterval(async () => {
      tries++
      try {
        const r = await fetch('/setup/status')
        if (r.ok) {
          const status = (await r.json()) as { configured: boolean }
          if (status.configured) {
            clearInterval(id)
            setAdminKey(data.adminKey)
            setLaunchStatus('done')
            setTimeout(() => navigate('/', { replace: true }), 900)
          }
        }
      } catch {
        // Server still restarting
      }
      if (tries > 30) {
        clearInterval(id)
        setLaunchStatus('error')
        setLaunchError('Server took too long to restart. Check your terminal.')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [launchStatus, data.adminKey, navigate])

  async function launch() {
    setLaunchStatus('saving')
    setLaunchError('')
    try {
      const res = await fetch('/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(await res.text())
      setLaunchStatus('restarting')
    } catch (e) {
      setLaunchStatus('error')
      setLaunchError(String(e))
    }
  }

  // ── Restart overlay ──────────────────────────────────────────────────────

  if (launchStatus === 'restarting' || launchStatus === 'done') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bo-bg)' }}
      >
        <div className="text-center space-y-5">
          {launchStatus === 'restarting' ? (
            <>
              <div
                className="w-14 h-14 border-4 border-t-transparent rounded-full animate-spin mx-auto"
                style={{ borderColor: '#E8302A', borderTopColor: 'transparent' }}
              />
              <div>
                <p className="text-white font-semibold text-lg">Starting your store…</p>
                <p className="text-sm mt-1" style={{ color: 'var(--bo-muted)' }}>
                  Writing config files and restarting the server
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">
                ✓
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Store is live!</p>
                <p className="text-sm mt-1" style={{ color: 'var(--bo-muted)' }}>
                  Redirecting to dashboard…
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Wizard shell ─────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-10"
      style={{ background: 'var(--bo-bg)' }}
    >
      {/* Brand header */}
      <div className="text-center mb-8">
        <img src="/logo-redbird.svg" alt="Redbird" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
        <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
          Redbird Setup
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--bo-muted)' }}>
          Let's get your store up and running
        </p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => {
          const done = i < stepIdx
          const active = s === step
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all`}
                  style={
                    done
                      ? { background: '#E8302A', color: '#fff' }
                      : active
                        ? {
                            background: 'var(--bo-bg3)',
                            color: '#E8302A',
                            outline: '2px solid #E8302A',
                            outlineOffset: '1px',
                          }
                        : { background: 'var(--bo-bg3)', color: '#444' }
                  }
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  className="text-xs mt-1 font-medium hidden sm:block"
                  style={{ color: active ? '#E8302A' : '#444' }}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-8 sm:w-12 h-px mx-1 mb-4 sm:mb-0 transition-colors"
                  style={{ background: i < stepIdx ? '#E8302A' : 'var(--bo-border)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Card */}
      <div
        className="p-8 w-full max-w-xl rounded-2xl"
        style={{ background: 'var(--bo-bg2)', border: '1px solid #1e1e1e' }}
      >
        {step === 'store' && <StoreStep data={data} onChange={patch} onNext={next} />}
        {step === 'modules' && (
          <ModulesStep data={data} onChange={patch} onNext={next} onBack={back} />
        )}
        {step === 'branding' && (
          <BrandingStep data={data} onChange={patch} onNext={next} onBack={back} />
        )}
        {step === 'theme' && <ThemeStep data={data} onChange={patch} onNext={next} onBack={back} />}
        {step === 'admin' && <AdminStep data={data} onChange={patch} onNext={next} onBack={back} />}
        {step === 'summary' && (
          <SummaryStep
            data={data}
            onChange={patch}
            onLaunch={launch}
            onBack={back}
            error={launchError}
            launching={launchStatus === 'saving'}
          />
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: '#444' }}>
        All settings can be changed at any time from the back office
      </p>
    </div>
  )
}
