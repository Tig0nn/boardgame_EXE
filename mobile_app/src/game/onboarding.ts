// Presentation preference only: never store a game snapshot or consume game RNG here.
export const TUTORIAL_STORAGE_KEY = 'xvtl:mobile:tutorial:v1'
export const TUTORIAL_DISABLED_KEY = 'xvtl:mobile:tutorial_disabled'
type TutorialStorage = Pick<Storage, 'getItem' | 'setItem'>

export function hasSeenTutorial(storage?: TutorialStorage | null): boolean {
  try { return (storage === undefined ? window.localStorage : storage)?.getItem(TUTORIAL_STORAGE_KEY) === 'seen' }
  catch { return false }
}

export function rememberTutorial(storage?: TutorialStorage | null): boolean {
  try {
    const target = storage === undefined ? window.localStorage : storage
    if (!target) return false
    target.setItem(TUTORIAL_STORAGE_KEY, 'seen')
    return true
  } catch { return false }
}

export function isTutorialDisabled(storage?: TutorialStorage | null): boolean {
  try {
    return (storage === undefined ? window.localStorage : storage)?.getItem(TUTORIAL_DISABLED_KEY) === 'true'
  } catch {
    return false
  }
}

export function setTutorialDisabled(disabled: boolean, storage?: TutorialStorage | null): boolean {
  try {
    const target = storage === undefined ? window.localStorage : storage
    if (!target) return false
    target.setItem(TUTORIAL_DISABLED_KEY, disabled ? 'true' : 'false')
    return true
  } catch {
    return false
  }
}
