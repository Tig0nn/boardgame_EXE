import { useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'
import { Canvas, useFrame, useThree } from '@react-three/fiber/native'
import type { Group } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { diceFaces, diceRotation, pipPositions } from './dice-visual'

const camera = { position: [4, 5, 7] as [number, number, number], zoom: 18, near: .1, far: 40 }
const turns: Record<string, [number, number, number]> = {
  top: [-Math.PI / 2, 0, 0], bottom: [Math.PI / 2, 0, 0],
  front: [0, 0, 0], back: [0, Math.PI, 0], right: [0, Math.PI / 2, 0], left: [0, -Math.PI / 2, 0],
}

type DiceProps = { value: number; rollSequence?: number; motion: boolean; animationId?: number; onSettled?: () => void }

export function DiceScene({ value, rollSequence, motion, animationId, onSettled }: DiceProps) {
  const cube = useRef<Group>(null)
  const previous = useRef(rollSequence)
  const progress = useRef(1)
  const settled = useRef(onSettled)
  useEffect(() => { settled.current = onSettled }, [onSettled])
  const invalidate = useThree(state => state.invalidate)
  const geometry = useMemo(() => new RoundedBoxGeometry(2, 2, 2, 2, .18), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    // Reloads and settings changes show the settled canonical roll. Only a new
    // history entry can start a tumble, including two successive equal rolls.
    progress.current = motion && (animationId !== undefined || previous.current !== rollSequence) ? 0 : 1
    previous.current = rollSequence
    cube.current?.rotation.set(...diceRotation(progress.current))
    invalidate()
  }, [animationId, motion, rollSequence, invalidate])
  useFrame((_state, delta) => {
    if (progress.current >= 1) return
    progress.current = Math.min(1, progress.current + Math.min(delta, .1) / .8)
    cube.current?.rotation.set(...diceRotation(progress.current))
    if (progress.current < 1) invalidate()
    else settled.current?.()
  })
  const faces = diceFaces(value)
  if (!faces) return null
  return <group ref={cube}>
    <mesh>
      <primitive object={geometry} attach="geometry"/>
      <meshStandardMaterial color="#f8fafc" roughness={.38} metalness={.05}/>
    </mesh>
    {Object.entries(faces).map(([face, count]) => <group key={face} name={'die-face-' + face} rotation={turns[face]}>
      {pipPositions(count).map(([x, y], index) => <mesh key={index} position={[x, y, 1.005]}>
        <circleGeometry args={[count === 1 ? .23 : .145, 20]}/>
        <meshBasicMaterial color={count === 1 ? '#ef4444' : '#1e293b'}/>
      </mesh>)}
    </group>)}
  </group>
}

export function Dice3D(props: DiceProps) {
  const { value } = props
  if (!diceFaces(value)) return null
  return <View accessible accessibilityLabel={'Xúc xắc · ' + value} pointerEvents="none" style={{ width: 64, height: 64 }}>
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: 1, height: 9, borderRadius: 24, backgroundColor: '#07182f50' }}/>
    <Canvas orthographic camera={camera} frameloop="demand">
      <ambientLight intensity={1.8}/><directionalLight position={[-3, 7, 6]} intensity={2.2}/>
      <DiceScene {...props}/>
    </Canvas>
  </View>
}
