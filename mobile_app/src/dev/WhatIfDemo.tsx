import { useState } from 'react'
import { GameExperience } from '../App'
import { createMobileSession } from '../game/session'
import { createRepairDemo } from './repair-fixture'
import './what-if-demo.css'

/** Loaded only by the DEV branch in main.tsx. No access to the real save slot. */
export default function WhatIfDemo() {
  const savings = new URLSearchParams(location.search).get('cash') === 'low' ? 48_000_000
    : new URLSearchParams(location.search).get('cash') === 'funding' ? 49_500_000 : 0
  const [session, setSession] = useState(() => createMobileSession(createRepairDemo(savings), { whatIf: true }))
  const restart = () => setSession(createMobileSession(createRepairDemo(savings), { whatIf: true }))
  return <>
    <GameExperience session={session} onRestart={restart} onHome={restart} persist={false} />
    <aside className="whatif-dev-toolbar" aria-label="Developer fixture">
      <span>DEV · Ván riêng · Không lưu</span>
      <button onClick={restart}>Tái hiện sửa xe</button>
    </aside>
  </>
}
