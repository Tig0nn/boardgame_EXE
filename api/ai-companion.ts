import { createCompanionHandler } from '../src/ai/companion/server/handler.ts'

// Explicitly offline. No environment/key lookup or default network transport.
export default createCompanionHandler()
