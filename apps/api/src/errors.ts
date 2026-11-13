import type { FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { postgresFailure } from './observability.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'Resource not found')
}

export function unavailable() {
  return new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable')
}

export function sendError(error: unknown, reply: FastifyReply) {
  const status = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : undefined
  let problem: ApiError
  if (error instanceof ApiError) problem = error
  else if (error instanceof ZodError || status === 400) {
    problem = new ApiError(400, 'INVALID_REQUEST', 'Invalid request')
  } else if (status === 413) {
    problem = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large')
  } else if (status === 415) {
    problem = new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json')
  } else if (status && status >= 400 && status < 500) {
    problem = new ApiError(status, 'INVALID_REQUEST', 'Invalid request')
  } else {
    reply.log.error({ event: 'request_failed', category: 'internal', ...postgresFailure(error) })
    problem = new ApiError(500, 'INTERNAL_ERROR', 'Internal server error')
  }

  if (problem.status < 500) reply.log.info({ event: 'request_rejected', code: problem.code, statusCode: problem.status })
  if (problem.status === 401) reply.header('WWW-Authenticate', 'Bearer')
  return reply.code(problem.status).send({
    error: { code: problem.code, message: problem.message },
  })
}
