const express = require('express');
const cors = require('cors');

const notificationsRouter = require('./routes/notifications');
const webhooksRouter = require('./triggers/webhooks');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/notifications', notificationsRouter);
app.use('/webhooks', webhooksRouter);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Notification backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
