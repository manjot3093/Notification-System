const express = require('express');
const notificationService = require('../services/notificationService');

/**
 * Demo "trigger" layer proving the notification pipeline is decoupled and
 * reusable, not hardcoded into one call site.
 *
 * Each of these represents a different real-world event source that would,
 * in a real product, come from somewhere else entirely (a DB trigger, a
 * message queue consumer, an internal event bus, a third-party webhook like
 * an email/SMS provider telling you a reply came in, etc). Here they're
 * exposed as plain HTTP endpoints you can curl, so the whole pipeline can be
 * exercised end-to-end without needing real infrastructure — but notice
 * neither of them talks to the HTTP notifications route; they both just
 * call notificationService.createNotification directly, exactly like any
 * other part of a real backend would.
 */

const router = express.Router();

// Event 1: a new team member was invited -> tenant-wide notification (userId: null)
router.post('/member-invited', (req, res) => {
  const { tenantId, memberName } = req.body || {};

  if (!tenantId || !memberName) {
    return res.status(400).json({ error: 'tenantId and memberName are required' });
  }

  const notification = notificationService.createNotification({
    tenantId,
    userId: null,
    type: 'member_invited',
    title: 'New team member',
    body: `${memberName} joined your agency`,
  });

  return res.status(201).json({ triggered: 'member_invited', notification });
});

// Event 2: a creator replied to an outreach message -> notification addressed
// to the specific user who owns that outreach thread.
router.post('/creator-replied', (req, res) => {
  const { tenantId, userId, creatorName } = req.body || {};

  if (!tenantId || !userId || !creatorName) {
    return res.status(400).json({ error: 'tenantId, userId, and creatorName are required' });
  }

  const notification = notificationService.createNotification({
    tenantId,
    userId,
    type: 'new_reply',
    title: 'Creator replied',
    body: `${creatorName} replied to your outreach message`,
  });

  return res.status(201).json({ triggered: 'creator_replied', notification });
});

// Event 3 (bonus, third trigger): a report finished generating -> notification
// addressed to the user who requested it.
router.post('/report-ready', (req, res) => {
  const { tenantId, userId, reportName } = req.body || {};

  if (!tenantId || !userId || !reportName) {
    return res.status(400).json({ error: 'tenantId, userId, and reportName are required' });
  }

  const notification = notificationService.createNotification({
    tenantId,
    userId,
    type: 'report_ready',
    title: 'Report ready',
    body: `Your ${reportName} report is ready to view`,
  });

  return res.status(201).json({ triggered: 'report_ready', notification });
});

module.exports = router;
