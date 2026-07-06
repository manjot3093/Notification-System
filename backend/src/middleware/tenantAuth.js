/**
 * Simplified auth convention for this exercise: every request carries
 * X-Tenant-Id and X-User-Id headers. In production these would be derived
 * from a verified JWT (see integration write-up in README) — trusting raw
 * headers is NOT safe for a real deployment, this is a stand-in.
 */
function requireTenantAuth(req, res, next) {
  const tenantId = req.header('X-Tenant-Id');
  const userId = req.header('X-User-Id');

  if (!tenantId || !userId) {
    return res.status(401).json({
      error: 'Missing X-Tenant-Id and/or X-User-Id headers',
    });
  }

  req.tenantId = tenantId;
  req.userId = userId;
  next();
}

module.exports = { requireTenantAuth };
