/**
 * VIVA Wallet Smart Checkout client.
 *
 * OAuth2 client-credentials → Bearer token (1-hour expiry, auto-refreshed).
 * API base URLs switch between demo and production based on VIVA_DEMO_MODE.
 *
 * Integration pattern: same hosted-redirect flow as Stripe Checkout (ADR-004):
 * 1. POST /checkout/v2/orders → OrderCode
 * 2. Redirect customer to vivapayments.com/web/checkout?ref={OrderCode}
 * 3. Customer completes payment → redirect back with ?t={TransactionId}&s={OrderCode}
 * 4. Webhook: Transaction Payment Created → verify & finalize
 */

const DEMO_API = 'https://demo-api.vivapayments.com'
const DEMO_ACCOUNTS = 'https://demo-accounts.vivapayments.com'
const PROD_API = 'https://api.vivapayments.com'
const PROD_ACCOUNTS = 'https://accounts.vivapayments.com'

function apiBase(): string {
  return process.env.VIVA_DEMO_MODE === 'true' ? DEMO_API : PROD_API
}

function accountsBase(): string {
  return process.env.VIVA_DEMO_MODE === 'true' ? DEMO_ACCOUNTS : PROD_ACCOUNTS
}

export function checkoutRedirectUrl(): string {
  return 'https://www.vivapayments.com/web/checkout'
}

// ── OAuth2 token cache ────────────────────────────────────────────

interface TokenCache {
  accessToken: string
  expiresAt: number // epoch ms
}

let _cache: TokenCache | null = null

/**
 * Obtain a Bearer token (OAuth2 client_credentials). Cached for 50 min
 * (token TTL is 60 min — 10 min safety margin).
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (_cache && _cache.expiresAt > now + 60_000) {
    return _cache.accessToken
  }

  const clientId = process.env.VIVA_CLIENT_ID
  const clientSecret = process.env.VIVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new VivaNotConfiguredError()
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${accountsBase()}/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`VIVA OAuth2 token request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  _cache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 600) * 1000, // 10 min safety margin
  }

  return _cache.accessToken
}

// ── API helpers ────────────────────────────────────────────────────

async function vivaPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as T & { code?: number; message?: string }
  if (!res.ok) {
    const msg = data?.message ?? data?.code ?? `HTTP ${res.status}`
    throw new Error(`VIVA API ${path}: ${msg}`)
  }
  return data
}

async function vivaGet<T = unknown>(path: string): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = (await res.json()) as T & { code?: number; message?: string }
  if (!res.ok) {
    const msg = data?.message ?? data?.code ?? `HTTP ${res.status}`
    throw new Error(`VIVA API ${path}: ${msg}`)
  }
  return data
}

// ── Order / Transaction types ──────────────────────────────────────

export interface CreateOrderInput {
  amount: number // amount in cents (EUR × 100) — VIVA API expects cents
  customerTrns: string // description shown to customer
  customer: {
    email: string
    fullName: string
    phone?: string
    countryCode?: string
    requestLang?: string
  }
  sourceCode: string
  merchantTrns: string
  currencyCode?: number // ISO 4217 numeric, 978 = EUR
  paymentTimeout?: number // seconds, default 300
  paymentNotification?: boolean
  preauth?: boolean
  allowRecurring?: boolean
  disableWallet?: boolean
  tags?: string[]
}

export interface CreateOrderResult {
  orderCode: number // actually returns a 16-digit integer
}

export interface VivaTransaction {
  transactionId: string // UUID
  orderCode: number
  amount: number // amount in cents (EUR × 100) — VIVA API expects cents
  currencyCode: number
  statusId: string // 'F' = completed
  email: string
  fullName?: string
  merchantTrns?: string
  customerTrns?: string
  sourceCode?: string
  sourceName?: string
  insDate: string // ISO datetime
  cardNumber?: string
  cardTypeId?: number
  responseCode?: string
  referenceNumber?: number
}

export interface RefundInput {
  transactionId: string
  amount: number // amount in cents (EUR × 100) — VIVA API expects cents
  sourceCode?: string
  merchantTrns?: string
  idempotencyKey?: string
}

export interface RefundResult {
  transactionId: string
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Create a payment order. Returns the OrderCode for redirect.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const data = await vivaPost<{ orderCode: number }>('/checkout/v2/orders', {
    amount: input.amount,
    customerTrns: input.customerTrns,
    customer: {
      email: input.customer.email,
      fullName: input.customer.fullName,
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
      ...(input.customer.countryCode ? { countryCode: input.customer.countryCode } : {}),
      ...(input.customer.requestLang ? { requestLang: input.customer.requestLang } : {}),
    },
    sourceCode: input.sourceCode,
    merchantTrns: input.merchantTrns,
    currencyCode: input.currencyCode ?? 978,
    paymentTimeout: input.paymentTimeout ?? 300,
    paymentNotification: input.paymentNotification ?? true,
    preauth: input.preauth ?? false,
    allowRecurring: input.allowRecurring ?? false,
    ...(input.disableWallet !== undefined ? { disableWallet: input.disableWallet } : {}),
    ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
  })

  return { orderCode: data.orderCode }
}

/**
 * Retrieve a transaction by ID (used for verification after webhook).
 */
export async function getTransaction(transactionId: string): Promise<VivaTransaction> {
  return vivaGet<VivaTransaction>(`/checkout/v2/transactions/${transactionId}`)
}

/**
 * Refund a transaction (fastrefund).
 */
export async function refundTransaction(input: RefundInput): Promise<RefundResult> {
  return vivaPost<RefundResult>(
    `/acquiring/v1/transactions/${input.transactionId}:fastrefund`,
    {
      amount: input.amount,
      sourceCode: input.sourceCode ?? 'Default',
      ...(input.merchantTrns ? { merchantTrns: input.merchantTrns } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    },
  )
}

// ── Error ──────────────────────────────────────────────────────────

export class VivaNotConfiguredError extends Error {
  constructor() {
    super(
      'VIVA Wallet is not configured (VIVA_CLIENT_ID / VIVA_CLIENT_SECRET unset). ' +
        'Online payment is not yet available.',
    )
    this.name = 'VivaNotConfiguredError'
  }
}