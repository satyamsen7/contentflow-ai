const cron = require('node-cron');
const { getSchedule, getNextPendingTopic, getPendingScheduledPosts } = require('./database');
const { runPipeline } = require('./pipeline');

// Map day names → cron weekday numbers (0 = Sunday)
const DAY_MAP = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
};

let activeJobs    = [];   // recurring daily jobs
let minuteWatcher = null; // checks for one-time scheduled posts every minute

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

async function initScheduler() {
  await _startDailyJobs();
  _startMinuteWatcher();
}

async function restartScheduler() {
  activeJobs.forEach(j => j.stop());
  activeJobs = [];
  await _startDailyJobs();
  console.log('🔄 Scheduler restarted');
}

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

async function _startDailyJobs() {
  const schedule = await getSchedule();
  if (!schedule || !schedule.active || !schedule.days?.length) {
    console.log('📅 No active recurring schedule configured');
    return;
  }

  const [hStr, mStr] = schedule.time.split(':');
  const hour   = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  for (const day of schedule.days) {
    const dow = DAY_MAP[day];
    if (dow === undefined) continue;

    const expr = `${minute} ${hour} * * ${dow}`;

    const job = cron.schedule(expr, async () => {
      console.log(`📅 Recurring job fired → ${day} ${schedule.time}`);
      await _runNextTopic();
    });

    activeJobs.push(job);
    console.log(`✅ Scheduled: ${day} @ ${schedule.time}  (cron: "${expr}")`);
  }
}

function _startMinuteWatcher() {
  if (minuteWatcher) minuteWatcher.stop();

  minuteWatcher = cron.schedule('* * * * *', async () => {
    const due = await getPendingScheduledPosts();
    for (const post of due) {
      console.log(`⏰ One-time scheduled post due → ID ${post.id}`);
      const topicRecord = { id: post.topic_id, topic: post.topic };
      runPipeline(topicRecord, post.id).catch(err =>
        console.error(`One-time post ${post.id} failed:`, err.message)
      );
    }
  });
}

async function _runNextTopic() {
  const topic = await getNextPendingTopic();
  if (!topic) {
    console.log('⚠️  No pending topics available — skipping this run');
    return;
  }
  console.log(`🚀 Running pipeline for topic: "${topic.topic}"`);
  runPipeline(topic).catch(err =>
    console.error('Scheduled pipeline failed:', err.message)
  );
}

module.exports = { initScheduler, restartScheduler };
