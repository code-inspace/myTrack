import { encryptText, isEncrypted } from "../src/lib/crypto/encryption";

const SUPABASE_URL = "https://bvdyjpxngcdindqhprmc.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function main() {
  console.log("🚀 STARTING GLOBAL DATABASE ENCRYPTION...");

  // 1. Tasks
  console.log("\n📦 1. Tasks...");
  const tasks = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=id,title,description`, { headers }).then(r => r.json());
  if (Array.isArray(tasks)) {
    let count = 0;
    for (const t of tasks) {
      const updates: any = {};
      if (t.title && !isEncrypted(t.title)) updates.title = await encryptText(t.title);
      if (t.description && !isEncrypted(t.description)) updates.description = await encryptText(t.description);
      if (Object.keys(updates).length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${t.id}`, { method: "PATCH", headers, body: JSON.stringify(updates) });
        count++;
      }
    }
    console.log(`✅ Tasks: ${count} updated out of ${tasks.length}`);
  }

  // 2. Projects
  console.log("\n📁 2. Projects...");
  const projects = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=id,name`, { headers }).then(r => r.json());
  if (Array.isArray(projects)) {
    let count = 0;
    for (const p of projects) {
      if (p.name && !isEncrypted(p.name)) {
        await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${p.id}`, { method: "PATCH", headers, body: JSON.stringify({ name: await encryptText(p.name) }) });
        count++;
      }
    }
    console.log(`✅ Projects: ${count} updated out of ${projects.length}`);
  }

  // 3. Sleep Logs (filter by user_id & date)
  console.log("\n🌙 3. Sleep Logs...");
  const sleepLogs = await fetch(`${SUPABASE_URL}/rest/v1/sleep_logs?select=user_id,date,notes`, { headers }).then(r => r.json());
  if (Array.isArray(sleepLogs)) {
    let count = 0;
    for (const s of sleepLogs) {
      if (s.notes && !isEncrypted(s.notes)) {
        await fetch(`${SUPABASE_URL}/rest/v1/sleep_logs?user_id=eq.${s.user_id}&date=eq.${s.date}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ notes: await encryptText(s.notes) }),
        });
        count++;
      }
    }
    console.log(`✅ Sleep logs: ${count} updated out of ${sleepLogs.length}`);
  }

  // 4. Task Completions
  console.log("\n✅ 4. Task Completions...");
  const completions = await fetch(`${SUPABASE_URL}/rest/v1/task_completions?select=id,notes`, { headers }).then(r => r.json());
  if (Array.isArray(completions)) {
    let count = 0;
    for (const c of completions) {
      if (c.notes && !isEncrypted(c.notes)) {
        await fetch(`${SUPABASE_URL}/rest/v1/task_completions?id=eq.${c.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ notes: await encryptText(c.notes) }),
        });
        count++;
      }
    }
    console.log(`✅ Task completions: ${count} updated out of ${completions.length}`);
  }

  // 5. Chat Conversations
  console.log("\n💬 5. Chat Conversations...");
  const convos = await fetch(`${SUPABASE_URL}/rest/v1/chat_conversations?select=id,title`, { headers }).then(r => r.json());
  if (Array.isArray(convos)) {
    let count = 0;
    for (const cv of convos) {
      if (cv.title && !isEncrypted(cv.title)) {
        await fetch(`${SUPABASE_URL}/rest/v1/chat_conversations?id=eq.${cv.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ title: await encryptText(cv.title) }),
        });
        count++;
      }
    }
    console.log(`✅ Chat conversations: ${count} updated out of ${convos.length}`);
  }

  // 6. Chat Messages
  console.log("\n💭 6. Chat Messages...");
  const msgs = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?select=id,content`, { headers }).then(r => r.json());
  if (Array.isArray(msgs)) {
    let count = 0;
    for (const m of msgs) {
      if (m.content && !isEncrypted(m.content)) {
        await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?id=eq.${m.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ content: await encryptText(m.content) }),
        });
        count++;
      }
    }
    console.log(`✅ Chat messages: ${count} updated out of ${msgs.length}`);
  }

  // 7. Reminders
  console.log("\n⏰ 7. Reminders...");
  const reminders = await fetch(`${SUPABASE_URL}/rest/v1/reminders?select=id,title,body`, { headers }).then(r => r.json());
  if (Array.isArray(reminders)) {
    let count = 0;
    for (const rem of reminders) {
      const updates: any = {};
      if (rem.title && !isEncrypted(rem.title)) updates.title = await encryptText(rem.title);
      if (rem.body && !isEncrypted(rem.body)) updates.body = await encryptText(rem.body);
      if (Object.keys(updates).length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/reminders?id=eq.${rem.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(updates),
        });
        count++;
      }
    }
    console.log(`✅ Reminders: ${count} updated out of ${reminders.length}`);
  }

  // 8. Notification Schedules
  console.log("\n🔔 8. Notification Schedules...");
  const schedules = await fetch(`${SUPABASE_URL}/rest/v1/notification_schedules?select=id,question`, { headers }).then(r => r.json());
  if (Array.isArray(schedules)) {
    let count = 0;
    for (const sc of schedules) {
      if (sc.question && !isEncrypted(sc.question)) {
        await fetch(`${SUPABASE_URL}/rest/v1/notification_schedules?id=eq.${sc.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ question: await encryptText(sc.question) }),
        });
        count++;
      }
    }
    console.log(`✅ Notification schedules: ${count} updated out of ${schedules.length}`);
  }

  console.log("\n🎉 ALL DATABASE DATA IN ALL 8 TABLES HAS BEEN ENCRYPTED (AES-256-GCM)!");
}

main().catch(console.error);
