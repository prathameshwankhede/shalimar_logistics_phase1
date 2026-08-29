// server/services/stateService.js
import * as stateRepo from '../repositories/stateRepository.js';

export async function getDashboardMetrics(user) {
  const isTransporter = user.role === 'transporter';
  const transporterId = user.transporter_id;

  const openIndentsCount = await stateRepo.countOpenRequests();
  const submissionsCount = await stateRepo.countSubmissions(isTransporter ? transporterId : null);

  return {
    role: user.role,
    open_indents: openIndentsCount,
    submissions_count: submissionsCount,
    awarded_count: 0
  };
}

export async function getRateRequests(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const rows = await stateRepo.fetchPaginatedRequests(safeLimit, offset);
  return rows.map(r => ({
    id: r.id,
    request_no: r.request_no,
    title: r.title || r.request_no,
    batch_no: r.batch_no || '',
    sub_no: r.sub_no || '1',
    origin_city: r.origin_city || '',
    origin_pin: r.origin_pin || '440028',
    dest_city: r.dest_city || '',
    dest_pin: r.dest_pin || '413001',
    company_unit: r.company_unit || '',
    material_type: r.material_type || '',
    hsn_code: r.hsn_code || '15071000',
    required_qty: Number(r.required_qty),
    unit: r.unit || 'MT',
    target_date: r.target_date ? String(r.target_date).slice(0, 10) : null,
    status: r.status || 'Open',
    notes: r.notes || '',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  }));
}

export async function getRateSubmissions(user) {
  const rows = await stateRepo.fetchSubmissions(null);
  return rows.map(b => ({
    id: b.id,
    requirement_id: b.requirement_id || b.rate_request_id || b.request_id,
    rate_request_id: b.requirement_id || b.rate_request_id || b.request_id,
    item_id: b.item_id || 'MAIN',
    request_no: b.request_no || b.sub_indent_no || '',
    sub_indent_no: b.sub_indent_no || '',
    transporter_id: b.transporter_id,
    transporter_name: b.transporter_name || b.transporter_id,
    transporter_code: b.transporter_code || '',
    rate_per_unit: Number(b.rate_per_mt || b.rate_per_unit || 0),
    rate_per_mt: Number(b.rate_per_mt || b.rate_per_unit || 0),
    quoted_quantity_mt: Number(b.quoted_quantity_mt || 0),
    total_amount: Number(b.total_amount || 0),
    status: b.status || 'Submitted',
    bid_status: b.bid_status || b.status || 'submitted',
    negotiation_status: b.negotiation_status || b.status || 'Submitted',
    original_rate: b.original_rate ? Number(b.original_rate) : Number(b.rate_per_mt || 0),
    counter_rate: b.counter_rate ? Number(b.counter_rate) : null,
    counter_offer_rate: b.counter_offer_rate ? Number(b.counter_offer_rate) : (b.counter_rate ? Number(b.counter_rate) : null),
    counter_offer_status: b.counter_offer_status || (b.bid_status === 'COUNTER_OFFERED' ? 'PENDING' : b.bid_status || null),
    counter_offer_by: b.counter_offer_by || b.countered_by || null,
    counter_offer_at: b.counter_offer_at || b.counter_updated_at || null,
    final_rate: b.final_rate ? Number(b.final_rate) : null,
    is_frozen: Boolean(b.is_frozen || b.bid_status === 'finalized' || b.status === 'Rate Frozen'),
    countered_by: b.countered_by || null,
    counter_message: b.counter_message || null,
    counter_updated_at: b.counter_updated_at || null,
    finalized_at: b.finalized_at || null,
    submitted_at: b.submitted_at ? new Date(b.submitted_at).toISOString() : new Date().toISOString()
  }));
}

export async function getTransportersList() {
  const rows = await stateRepo.fetchTransportersList();
  return rows.map(t => ({
    id: t.id,
    company_name: t.company_name,
    code: t.code,
    contact_person: t.contact_person || '',
    mobile: t.mobile || '',
    email: t.email || '',
    gstin: t.gstin || '',
    pan: t.pan || '',
    address: t.address || '',
    username: t.username || '',
    status: t.status || 'Active',
    created_at: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString()
  }));
}

export async function getMasterRecords() {
  const rows = await stateRepo.fetchMasterRecords();
  return rows.map(m => ({
    id: m.id,
    category: m.category,
    code: m.code,
    name: m.name
  }));
}
