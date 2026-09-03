import { useEffect } from 'react'
import { useLocation, useNavigate, type NavigateOptions, type To } from 'react-router-dom'

/**
 * View transitions between screens.
 *
 * The design doc names `view-transition` as the intended mechanism for layout
 * changes, instead of pulling in an animation library. Browsers without it
 * simply navigate, and prefers-reduced-motion is honoured by the CSS.
 */

type MitViewTransition = Document & {
  startViewTransition?: (arbeit: () => void | Promise<void>) => { finished: Promise<void> }
}

function kannWechseln(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof (document as MitViewTransition).startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Drop-in for useNavigate that animates the swap where supported. */
export function useSanfteNavigation() {
  const navigate = useNavigate()

  return (ziel: To, optionen?: NavigateOptions) => {
    if (!kannWechseln()) {
      navigate(ziel, optionen)
      return
    }
    ;(document as MitViewTransition).startViewTransition!(() => {
      navigate(ziel, optionen)
    })
  }
}

/**
 * Scrolls to the top on every screen change. Without this a long receipt list
 * leaves the next screen scrolled halfway down, which reads as a glitch.
 */
export function useNachObenBeiWechsel(): void {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
}
