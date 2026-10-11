import { describe, expect, it } from 'vitest'
import { prisma } from '../../../db/client.js'
import {
  api,
  authHeader,
  createUser,
  TEST_PASSWORD,
} from '../../../__tests__/test-utils.js'

function getSetCookieValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) {
    return value.filter((cookie): cookie is string => typeof cookie === 'string')
  }
  return []
}

describe('POST /api/auth/register/', () => {
  it('creates an account and returns a token pair', async () => {
    const response = await api().post('/api/auth/register/').send({
      email: 'new@example.com',
      first_name: 'New',
      password: TEST_PASSWORD,
      password_confirm: TEST_PASSWORD,
    })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      access: expect.any(String),
    })

    const cookies = getSetCookieValues(response.headers['set-cookie'])
    expect(cookies).not.toHaveLength(0)
    expect(
      cookies.some(
        (cookie) =>
          cookie.includes('refresh_token=') && /httponly/i.test(cookie),
      ),
    ).toBe(true)

    const user = await prisma.user.findUnique({ where: { email: 'new@example.com' } })
    expect(user).not.toBeNull()
    expect(user?.password).not.toBe(TEST_PASSWORD)
  })

  it('reports mismatched passwords against the password_confirm field', async () => {
    const response = await api().post('/api/auth/register/').send({
      email: 'new@example.com',
      first_name: 'New',
      password: TEST_PASSWORD,
      password_confirm: 'something-else',
    })

    expect(response.status).toBe(400)
    expect(response.body.password_confirm).toEqual(['Passwords do not match.'])
  })

  it('rejects an email that is already taken', async () => {
    await createUser({ email: 'taken@example.com' })

    const response = await api().post('/api/auth/register/').send({
      email: 'taken@example.com',
      first_name: 'New',
      password: TEST_PASSWORD,
      password_confirm: TEST_PASSWORD,
    })

    expect(response.status).toBe(400)
    expect(response.body.email).toBeDefined()
  })
})

describe('POST /api/auth/login/', () => {
  it('returns a token pair for valid credentials', async () => {
    await createUser({ email: 'user@example.com' })

    const response = await api()
      .post('/api/auth/login/')
      .send({ email: 'user@example.com', password: TEST_PASSWORD })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      access: expect.any(String),
    })

    const cookies = getSetCookieValues(response.headers['set-cookie'])
    expect(cookies.some((value) => value.includes('refresh_token='))).toBe(true)
    expect(cookies.some((value) => /httponly/i.test(value))).toBe(true)
  })

  it('reports a bad password as a non-field error', async () => {
    await createUser({ email: 'user@example.com' })

    const response = await api()
      .post('/api/auth/login/')
      .send({ email: 'user@example.com', password: 'wrong-password' })

    expect(response.status).toBe(400)
    expect(response.body.non_field_errors).toEqual(['Those details do not match an account'])
  })

  it('does not reveal whether an account exists', async () => {
    const response = await api()
      .post('/api/auth/login/')
      .send({ email: 'nobody@example.com', password: TEST_PASSWORD })

    expect(response.status).toBe(400)
    expect(response.body.non_field_errors).toEqual(['Those details do not match an account'])
  })

  it('rejects a disabled account', async () => {
    await createUser({ email: 'user@example.com', is_active: false })

    const response = await api()
      .post('/api/auth/login/')
      .send({ email: 'user@example.com', password: TEST_PASSWORD })

    expect(response.status).toBe(400)
    expect(response.body.non_field_errors).toEqual(['User account is disabled.'])
  })
})

describe('GET /api/auth/me/', () => {
  it('returns the profile fields the frontend maps', async () => {
    const user = await createUser({ email: 'me@example.com', first_name: 'Ada' })

    const response = await api().get('/api/auth/me/').set(...(await authHeader(user.id)))

    expect(response.status).toBe(200)
    expect(Object.keys(response.body).sort()).toEqual([
      'date_joined',
      'email',
      'first_name',
      'id',
      'last_name',
    ])
    expect(response.body.email).toBe('me@example.com')
    expect(response.body.first_name).toBe('Ada')
  })

  it('401s without a token, in DRF wording', async () => {
    const response = await api().get('/api/auth/me/')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      detail: 'Authentication credentials were not provided.',
    })
  })

  it('401s on a refresh token used as an access token', async () => {
    const user = await createUser()
    const { body } = await api()
      .post('/api/auth/login/')
      .send({ email: user.email, password: TEST_PASSWORD })

    const response = await api()
      .get('/api/auth/me/')
      .set('Authorization', `Bearer ${body.refresh}`)

    expect(response.status).toBe(401)
  })
})

describe('PATCH /api/auth/me/', () => {
  it('updates the profile', async () => {
    const user = await createUser({ first_name: 'Old' })

    const response = await api()
      .patch('/api/auth/me/')
      .set(...(await authHeader(user.id)))
      .send({ first_name: 'New' })

    expect(response.status).toBe(200)
    expect(response.body.first_name).toBe('New')
  })
})

describe('POST /api/auth/change-password/', () => {
  it('changes the password when the old one is correct', async () => {
    const user = await createUser()

    const response = await api()
      .post('/api/auth/change-password/')
      .set(...(await authHeader(user.id)))
      .send({ old_password: TEST_PASSWORD, new_password: 'a-brand-new-pw' })

    expect(response.status).toBe(200)

    const login = await api()
      .post('/api/auth/login/')
      .send({ email: user.email, password: 'a-brand-new-pw' })
    expect(login.status).toBe(200)
  })

  it('rejects a wrong current password against that field', async () => {
    const user = await createUser()

    const response = await api()
      .post('/api/auth/change-password/')
      .set(...(await authHeader(user.id)))
      .send({ old_password: 'not-it', new_password: 'a-brand-new-pw' })

    expect(response.status).toBe(400)
    expect(response.body.old_password).toEqual(['Current password is incorrect.'])
  })
})

describe('POST /api/auth/refresh/', () => {
  it('exchanges the HttpOnly refresh cookie for a new access token', async () => {
    const user = await createUser()
    const login = await api()
      .post('/api/auth/login/')
      .send({ email: user.email, password: TEST_PASSWORD })

    const refreshCookie = getSetCookieValues(login.headers['set-cookie'])
      .find((value) => value.startsWith('refresh_token='))
      ?.split(';', 1)[0]
    expect(refreshCookie).toBeDefined()
    if (!refreshCookie) throw new Error('Login did not set a refresh-token cookie')

    const response = await api()
      .post('/api/auth/refresh/')
      .set('Cookie', refreshCookie)
      .send({})

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      access: expect.any(String),
    })

    const refreshedCookies = getSetCookieValues(response.headers['set-cookie'])
    expect(refreshedCookies.some((value) => value.includes('refresh_token='))).toBe(true)
    expect(refreshedCookies.some((value) => /httponly/i.test(value))).toBe(true)
  })

  it('401s on a bad refresh token', async () => {
    const response = await api().post('/api/auth/refresh/').send({ refresh: 'nonsense' })

    expect(response.status).toBe(401)
  })
})

describe('POST /api/auth/forgot-password/', () => {
  it('reports success for an unknown email, to avoid enumeration', async () => {
    const response = await api()
      .post('/api/auth/forgot-password/')
      .send({ email: 'nobody@example.com' })

    expect(response.status).toBe(200)
    expect(response.body.detail).toBeDefined()
  })
})
