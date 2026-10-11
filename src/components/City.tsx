export function City({ board = false }: { board?: boolean }) {
  return <svg className={board ? 'board-city' : 'city'} x={board ? 190 : undefined} y={board ? 140 : undefined} width={board ? 220 : undefined} height={board ? 88 : undefined} viewBox="0 0 440 175" fill="none" aria-hidden="true">
    <path d="M28 151c24-65 77-80 126-39 42-50 96-52 132-7 39-36 87-21 125 46" fill="#dce8ce"/>
    <path d="M40 38h38M65 25h22M318 30h43M348 43h26" stroke="#c4d7bc" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="288" cy="38" r="17" fill="#ead49c"/>
    <path d="M18 154h404" stroke="#a8bd9d" strokeWidth="2"/>
    <path d="M55 154v-49l34-28 34 28v49" fill="#eedac1" stroke="#bba787" strokeWidth="1.5"/>
    <path d="m49 106 40-33 41 33" stroke="#57795e" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M82 154v-28h16v28" fill="#6f8b70"/><path d="M65 110h11v12H65zM104 110h11v12h-11z" fill="#f8f4e8"/>
    <path d="M135 154V58h55v96" fill="#b8cbb1" stroke="#6a8a6b" strokeWidth="1.5"/>
    <path d="M145 71h11v13h-11zM169 71h11v13h-11zM145 94h11v13h-11zM169 94h11v13h-11zM145 117h11v13h-11zM169 117h11v13h-11z" fill="#f5f3e8"/>
    <path d="M152 154v-15h21v15M130 58h65" stroke="#6a8a6b" strokeWidth="3"/>
    <path d="M200 154V99h80v55" fill="#f0e4ca" stroke="#b7a782" strokeWidth="1.5"/>
    <path d="M195 100h89l-8-20h-73z" fill="#65856b"/>
    <path d="M195 100h18v8a9 9 0 0 1-18 0zM231 100h18v8a9 9 0 0 1-18 0zM267 100h17v8a8.5 8.5 0 0 1-17 0z" fill="#e2b77d"/>
    <path d="M213 100h18v8a9 9 0 0 1-18 0zM249 100h18v8a9 9 0 0 1-18 0z" fill="#4f7258"/>
    <path d="M210 123h26v18h-26zM249 154v-31h20v31" fill="#8ca78c"/><path d="M220 123v18" stroke="#f0e4ca" strokeWidth="2"/>
    <path d="M299 154v-38h50v38" fill="#ddbc8c"/><path d="m292 118 31-29 33 29z" fill="#a97954"/>
    <path d="M308 128h13v13h-13zM330 128h12v26h-12z" fill="#f4ead5"/>
    <path d="M378 154v-40M36 154v-25" stroke="#829b73" strokeWidth="4"/>
    <path d="M378 121c-33 0-26-37-9-40-9-18 20-27 28-9 26 6 24 49-19 49M35 137c-24 0-25-32-8-36 16-15 35 11 25 24" fill="#9fb88a"/>
    <path d="M107 163h60M277 163h40" stroke="#d1ddc5" strokeWidth="2" strokeLinecap="round"/>
  </svg>
}
