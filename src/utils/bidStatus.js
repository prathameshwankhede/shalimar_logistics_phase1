// Centralized Bid Status Normalization and Frozen State Resolver

export const BID_STATUSES = {
  SUBMITTED: 'SUBMITTED',
  COUNTER_OFFERED: 'COUNTER_OFFERED',
  COUNTER_ACCEPTED: 'COUNTER_ACCEPTED',
  COUNTER_REJECTED: 'COUNTER_REJECTED',
  COUNTER_RESPONDED: 'COUNTER_RESPONDED',
  FINALIZED: 'FINALIZED'
};

export function normalizeBidStatus(status) {
  const value = String(status || 'SUBMITTED').toUpperCase().trim();
  const mapping = {
    'SUBMITTED': 'SUBMITTED',
    'COUNTER_OFFERED': 'COUNTER_OFFERED',
    'COUNTERED_BY_ADMIN': 'COUNTER_OFFERED',
    'COUNTER_ACCEPTED': 'COUNTER_ACCEPTED',
    'COUNTER_REJECTED': 'COUNTER_REJECTED',
    'COUNTER_RESPONDED': 'COUNTER_RESPONDED',
    'COUNTERED_BY_TRANSPORTER': 'COUNTER_RESPONDED',
    'FINALIZED': 'FINALIZED',
    'RATE FROZEN': 'FINALIZED',
    'ACCEPTED': 'FINALIZED',
    'AWARDED': 'FINALIZED'
  };
  return mapping[value] || 'SUBMITTED';
}

export function isBidFrozen(bid) {
  if (!bid) return false;
  const status = normalizeBidStatus(bid.bid_status || bid.status);
  return status === 'FINALIZED' || status === 'COUNTER_ACCEPTED' || (Number(bid.final_rate) > 0);
}