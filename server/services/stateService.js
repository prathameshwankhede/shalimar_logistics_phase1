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
    origin_city: r.origin_city || '',
    dest_city: r.dest_city || '',
    company_unit: r.company_unit || '',
    material_type: r.material_type || '',
    required_qty: Number(r.required_qty),
    unit: r.unit || 'MT',
    target_date: r.target_date ? String(r.target_date).slice(0, 10) : null,
    status: r.status || 'Open',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
  }));
}

export async function getRateSubmissions(user) {
  const isTransporter = user.role === 'transporter';
  const transporterId = isTransporter ? user.transporter_id : null;

  const rows = await stateRepo.fetchSubmissions(transporterId);
  return rows.map(b => ({
    id: b.id,
    rate_request_id: b.request_id,
    request_no: b.request_no,
    transporter_id: b.transporter_id,
    transporter_name: b.transporter_name,
    rate_per_unit: Number(b.rate_per_unit),
    vehicle_type: b.vehicle_type,
    comments: b.comments,
    status: b.status,
    counter_rate: b.counter_rate ? Number(b.counter_rate) : null,
    is_frozen: Boolean(b.is_frozen),
    submitted_at: b.submitted_at ? new Date(b.submitted_at).toISOString() : new Date().toISOString()
  }));
}

export async function getTransportersList() {
  const rows = await stateRepo.fetchTransportersList();
  return rows.map(t => ({
    id: t.id,
    company_name: t.company_name,
    code: t.code,
    mobile: t.mobile,
    email: t.email,
    status: t.status
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
