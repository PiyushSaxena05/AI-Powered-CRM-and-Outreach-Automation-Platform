import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Table } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { Spinner, EmptyState, ErrorBanner } from '../../components/feedback/Spinner'
import { apiClient } from '../../api/client'
import { can } from '../../utils/roles'

/**
 * Automation Error Center page (FE-28), part 1: error table and filters.
 *
 *   GET /error_center -> list of error records (admin, developer)
 *
 * Notes for reviewers:
 *  - /error_center is not in contracts/openapi.yaml yet (contract change request pending).
 *  - Mock mode: VITE_USE_MOCKS=true, or the backend being unreachable, serves
 *    the sample records below so the page can be built and demoed offline.
 */

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

/* ----------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------- */

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'retrying', label: 'Retrying' },
  { value: 'resolved', label: 'Resolved' },
]

// Categories from docs/error-playbook.md plus the name the backend uses for rejections.
const KNOWN_CATEGORIES = [
  'temporary_network',
  'rate_limit',
  'invalid_input',
  'expired_credential',
  'credit_exhaustion',
  'source_layout_changed',
  'ai_output_invalid',
  'send_timeout',
  'provider_rejection',
  'permanent_provider_rejection',
]

const TABLE_HEADERS = [
  'Workflow',
  'Job ID',
  'Correlation ID',
  'Failed Step',
  'Error Category',
  'Retry Count',
  'Next Retry At',
  'Owner',
  'Status',
]

const PAGE_CSS = `
.ec-row { border-bottom: 1px solid var(--color-border); }
.ec-row:last-child { border-bottom: none; }
.ec-row:hover { background: var(--color-bg-subtle); }
.ec-td { padding: 12px 16px; vertical-align: middle; white-space: nowrap; }
.ec-mono { font-family: var(--font-mono); font-size: 12px; }
`

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function display(value) {
  return value !== null && value !== undefined && value !== '' ? String(value) : '—'
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function categoryLabel(category) {
  if (!category) return '—'
  const text = String(category).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function statusVariant(status) {
  if (status === 'resolved') return 'success'
  if (status === 'retrying') return 'info'
  return 'warning'
}

/** Accepts the backend record shape and tolerates missing optional fields. */
function normalizeError(raw) {
  const retryCount = Number(raw.retry_count)
  return {
    id: String(raw.id),
    workflow: raw.workflow ?? raw.workflow_name ?? null,
    job_id: raw.job_id ?? null,
    correlation_id: raw.correlation_id ?? null,
    failed_step: raw.failed_step ?? null,
    category: raw.category ?? null,
    status: raw.status || 'open',
    retry_count: Number.isFinite(retryCount) ? retryCount : 0,
    next_retry_at: raw.next_retry_at ?? null,
    owner: raw.owner ?? null,
    replay_eligible: raw.replay_eligible,
    stack_trace: raw.redacted_stack_trace ?? raw.redacted_message ?? null,
    payload_snapshot: raw.payload_snapshot ?? null,
    ai_suggestion: raw.ai_suggestion ?? null,
  }
}

/* ----------------------------------------------------------------------------
 * Mock data (offline mode)
 * ------------------------------------------------------------------------- */

const MOCK_ERRORS = [
  {
    id: 'err_001', workflow: 'daily_discovery', job_id: 'job_sample_01',
    correlation_id: 'corr_c8f2b730-811c', failed_step: 'fetch_naukri_listings',
    category: 'rate_limit', status: 'open', retry_count: 2,
    next_retry_at: '2026-11-21T14:30:00Z', owner: 'automation', replay_eligible: true,
    redacted_message: 'HTTP 429 Too Many Requests received from target source\n  at fetchListings (scraper/naukri.py:88)\n  at run_batch (scraper/runner.py:41)',
    payload_snapshot: { source_id: 'naukri', batch_id: 'batch_20261120_090000', page: 7 },
    ai_suggestion: 'The source is rate limiting requests. Increase the backoff window or reduce concurrency.',
  },
  {
    id: 'err_002', workflow: 'enrichment_batch', job_id: 'job_sample_02',
    correlation_id: 'corr_41ab9e02-77d3', failed_step: 'contactout_lookup',
    category: 'temporary_network', status: 'retrying', retry_count: 1,
    next_retry_at: '2026-11-20T18:05:00Z', owner: 'automation', replay_eligible: true,
    redacted_message: 'ConnectionResetError: connection reset by peer\n  at lookup (enrichment/contactout.py:52)',
    payload_snapshot: { lead_id: 'lead_1042', provider: 'contactout' },
    ai_suggestion: 'Transient network failure. The bounded retry should recover without changes.',
  },
  {
    id: 'err_003', workflow: 'dispatch_send', job_id: 'job_sample_03',
    correlation_id: 'corr_9d7712ce-30aa', failed_step: 'provider_send',
    category: 'send_timeout', status: 'open', retry_count: 0,
    next_retry_at: null, owner: 'campaign_manager', replay_eligible: false,
    redacted_message: 'Socket timeout after 30s while sending to provider\n  at send (dispatch/resend_client.py:67)',
    payload_snapshot: { approval_id: 'appr_204', recipient: 'j***@example.com' },
    ai_suggestion: 'The provider may have accepted the message. Reconcile its status before any retry.',
  },
  {
    id: 'err_004', workflow: 'dispatch_send', job_id: 'job_sample_04',
    correlation_id: 'corr_ee51d0b8-5c19', failed_step: 'provider_send',
    category: 'permanent_provider_rejection', status: 'open', retry_count: 0,
    next_retry_at: null, owner: 'campaign_manager', replay_eligible: false,
    redacted_message: 'Provider rejected recipient: hard bounce (invalid address)',
    payload_snapshot: { approval_id: 'appr_207', recipient: 'r***@example.com' },
    ai_suggestion: null,
  },
  {
    id: 'err_005', workflow: 'daily_discovery', job_id: 'job_sample_05',
    correlation_id: 'corr_a05c3f17-2b64', failed_step: 'parse_internshala_listing',
    category: 'source_layout_changed', status: 'open', retry_count: 0,
    next_retry_at: null, owner: 'developer', replay_eligible: false,
    redacted_message: 'Selector .internship_meta .company_name matched 0 elements',
    payload_snapshot: { source_id: 'internshala', url: 'https://internshala.com/internships' },
    ai_suggestion: 'The page layout changed. Update the company name selector.',
  },
  {
    id: 'err_006', workflow: 'draft_generation', job_id: 'job_sample_06',
    correlation_id: 'corr_6b2e8d94-f0a1', failed_step: 'fact_check_draft',
    category: 'ai_output_invalid', status: 'resolved', retry_count: 1,
    next_retry_at: null, owner: 'ai', replay_eligible: true,
    redacted_message: 'Draft failed schema validation: missing field "subject"',
    payload_snapshot: { lead_id: 'lead_0988', prompt_version: 'v3' },
    ai_suggestion: 'The model skipped the subject line. The retry prompt fixed it.',
  },
]

async function mockList() {
  await sleep(300)
  return MOCK_ERRORS.map((item) => ({ ...item }))
}

/* ----------------------------------------------------------------------------
 * API calls (always through our own backend)
 * ------------------------------------------------------------------------- */

async function fetchErrors() {
  if (USE_MOCKS) {
    return { items: (await mockList()).map(normalizeError), usedMock: true }
  }
  try {
    const data = await apiClient('/error_center')
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return { items: list.map(normalizeError), usedMock: false }
  } catch (err) {
    if (err?.status === 0) {
      return { items: (await mockList()).map(normalizeError), usedMock: true }
    }
    throw err
  }
}

/* ----------------------------------------------------------------------------
 * Table
 * ------------------------------------------------------------------------- */

export function ErrorTable({ errors = [] }) {
  return (
    <Table headers={TABLE_HEADERS}>
      {errors.map((error) => (
        <tr key={error.id} className="ec-row">
          <td className="ec-td">{display(error.workflow)}</td>
          <td className="ec-td ec-mono">{display(error.job_id)}</td>
          <td className="ec-td ec-mono">{display(error.correlation_id)}</td>
          <td className="ec-td">{display(error.failed_step)}</td>
          <td className="ec-td">
            <Badge variant="neutral">{categoryLabel(error.category)}</Badge>
          </td>
          <td className="ec-td">{error.retry_count}</td>
          <td className="ec-td">{formatDateTime(error.next_retry_at)}</td>
          <td className="ec-td">{display(error.owner)}</td>
          <td className="ec-td">
            <Badge variant={statusVariant(error.status)}>{categoryLabel(error.status)}</Badge>
          </td>
        </tr>
      ))}
    </Table>
  )
}

/* ----------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */

export default function ErrorCenterPage({ currentUser }) {
  const allowed = can(currentUser?.role, 'view_error_center')

  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [usingMock, setUsingMock] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await fetchErrors()
      setUsingMock(result.usedMock)
      setErrors(result.items)
    } catch (err) {
      setLoadError(err?.message || 'Could not load the error list.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) load()
    else setLoading(false)
  }, [allowed, load])

  const categoryOptions = useMemo(() => {
    const extra = errors.map((e) => e.category).filter((c) => c && !KNOWN_CATEGORIES.includes(c))
    const all = [...KNOWN_CATEGORIES, ...new Set(extra)]
    return [{ value: 'all', label: 'All categories' }, ...all.map((c) => ({ value: c, label: categoryLabel(c) }))]
  }, [errors])

  const filtered = useMemo(
    () =>
      errors.filter(
        (e) =>
          (categoryFilter === 'all' || e.category === categoryFilter) &&
          (statusFilter === 'all' || e.status === statusFilter)
      ),
    [errors, categoryFilter, statusFilter]
  )

  const filtersActive = categoryFilter !== 'all' || statusFilter !== 'all'

  if (!allowed) {
    return (
      <div style={{ padding: '32px' }}>
        <EmptyState
          title="Error Center is restricted"
          message="Only developer and admin roles can view automation errors."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '32px' }}>
      <style>{PAGE_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Automation Error Center</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Inspect failed workflows, review suggested root causes, and replay jobs that are safe to retry.
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {usingMock && (
        <div
          role="status"
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
          }}
        >
          Showing sample data because mock mode is on or the backend could not be reached.
        </div>
      )}

      {loadError && <ErrorBanner message={loadError} onRetry={load} />}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ minWidth: '220px' }}>
          <Select
            label="Error category"
            aria-label="Filter by error category"
            value={categoryFilter}
            options={categoryOptions}
            onChange={(event) => setCategoryFilter(event.target.value)}
          />
        </div>
        <div style={{ minWidth: '180px' }}>
          <Select
            label="Status"
            aria-label="Filter by status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
        </div>
        {filtersActive && (
          <Button
            variant="secondary"
            onClick={() => {
              setCategoryFilter('all')
              setStatusFilter('all')
            }}
          >
            Clear filters
          </Button>
        )}
        {!loading && (
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', paddingBottom: '10px' }}>
            Showing {filtered.length} of {errors.length} errors
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Spinner size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filtersActive ? 'No errors match these filters' : 'No automation errors'}
          message={
            filtersActive
              ? 'Try a different category or status.'
              : 'Workflows and scrapers have not reported any failures.'
          }
        />
      ) : (
        <ErrorTable errors={filtered} />
      )}
    </div>
  )
}