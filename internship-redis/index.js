const express = require('express');
const { createClient } = require('redis');
const app = express();
require('dotenv').config();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = createClient({ url: process.env.REDIS_URL });
client.connect();

const fakeDB = {
  app123: { id: 'app123', company: 'Google', status: 'Applied', userId: 'user1' },
  app456: { id: 'app456', company: 'Meta', status: 'Interview', userId: 'user1' },
};

app.get('/', async (req, res) => {
  const userId = 'user1';
  const recentIds = await client.lRange(`recentApps:${userId}`, 0, 9);
  res.render('index', { recentIds, userId });
});

app.get('/application/:id', async (req, res) => {
  const key = `cache:application:${req.params.id}`;
  let application = await client.get(key);
  let fromCache = true;

  if (!application) {
    fromCache = false;
    const doc = fakeDB[req.params.id];
    if (!doc) return res.status(404).send('Not found');
    await client.set(key, JSON.stringify(doc), { EX: 300 });
    await client.lPush(`recentApps:${doc.userId}`, req.params.id);
    await client.lTrim(`recentApps:${doc.userId}`, 0, 19);
    application = JSON.stringify(doc);
  }

  res.render('application', { app: JSON.parse(application), fromCache });
});

app.post('/application/:id/update', async (req, res) => {
  const { status } = req.body;
  const doc = fakeDB[req.params.id];
  if (!doc) return res.status(404).send('Not found');
  doc.status = status;
  await client.del(`cache:application:${req.params.id}`);
  res.redirect(`/application/${req.params.id}`);
});

app.post('/application/:id/delete', async (req, res) => {
  await client.del(`cache:application:${req.params.id}`);
  await client.lRem('recentApps:user1', 1, req.params.id);
  res.redirect('/');
});

app.listen(process.env.PORT, () => {
  console.log(`Running on port ${process.env.PORT}`);
});
