// server/controllers/stateController.js
import * as stateService from '../services/stateService.js';
import { logger } from '../utils/logger.js';

function sendDbErrorResponse(res, err) {
  logger.warn('State Controller Database Notice', { message: err?.message });
  return res.status(503).json({
    success: false,
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database service temporarily unavailable'
    }
  });
}

export async function handleGetDashboard(req, res) {
  try {
    const dashboard = await stateService.getDashboardMetrics(req.user);
    return res.json({ success: true, dashboard });
  } catch (err) {
    return sendDbErrorResponse(res, err);
  }
}

export async function handleGetRateRequests(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const requests = await stateService.getRateRequests(page, limit);
    return res.json({ success: true, page, limit, count: requests.length, rate_requests: requests });
  } catch (err) {
    return sendDbErrorResponse(res, err);
  }
}

export async function handleGetRateSubmissions(req, res) {
  try {
    const submissions = await stateService.getRateSubmissions(req.user);
    return res.json({ success: true, count: submissions.length, rate_submissions: submissions });
  } catch (err) {
    return sendDbErrorResponse(res, err);
  }
}

export async function handleGetTransporters(req, res) {
  try {
    const transporters = await stateService.getTransportersList();
    return res.json({ success: true, count: transporters.length, transporters });
  } catch (err) {
    return sendDbErrorResponse(res, err);
  }
}

export async function handleGetMasterData(req, res) {
  try {
    const masters = await stateService.getMasterRecords();
    return res.json({ success: true, count: masters.length, master_records: masters });
  } catch (err) {
    return sendDbErrorResponse(res, err);
  }
}
