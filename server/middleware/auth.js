import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  console.error('💥 [CRITICAL SECURITY ERROR] JWT_SECRET environment variable is mandatory in production!');
  throw new Error('JWT_SECRET must be defined in production environment');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'transflow_development_secret_key_2026';

// Role-Based Access Control (RBAC) Permission Matrix
export const ROLE_PERMISSIONS = {
  admin: [
    'dashboard.view',
    'rate_request.view',
    'rate_request.create',
    'rate_request.update',
    'rate_submission.view_all',
    'rate_submission.award',
    'transporter.view',
    'transporter.manage',
    'user.view',
    'user.manage',
    'master_data.manage',
    'audit_log.view'
  ],
  transporter: [
    'dashboard.view',
    'rate_request.view_open',
    'rate_submission.view_own',
    'rate_submission.create',
    'master_data.view'
  ]
};

export function generateToken(user) {
  const rawRole = String(user.role || '').trim().toLowerCase();
  const canonicalRole = rawRole === 'admin' ? 'admin' : (rawRole === 'transporter' ? 'transporter' : 'user');
  const permissions = ROLE_PERMISSIONS[canonicalRole] || [];
  const organizationId = user.organization_id || 'org_shalimar';

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: canonicalRole,
      transporter_id: user.transporter_id || (canonicalRole === 'transporter' ? user.id : null),
      organization_id: organizationId,
      permissions
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token' });
    }
    if (decoded) {
      decoded.role = String(decoded.role || '').trim().toLowerCase();
    }
    req.user = decoded;
    next();
  });
}

export function requireRole(...roles) {
  const normalizedAllowed = roles.map(r => String(r).trim().toLowerCase());
  return (req, res, next) => {
    const userRole = String(req.user?.role || '').trim().toLowerCase();
    if (!req.user || !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied. Insufficient role permissions.' });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userRole = String(req.user.role || '').trim().toLowerCase();
    const userPermissions = req.user.permissions || ROLE_PERMISSIONS[userRole] || [];
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ error: `Access denied. Requires permission: ${permission}` });
    }
    next();
  };
}
