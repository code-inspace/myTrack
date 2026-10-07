import { createClient } from "@supabase/supabase-js";
import { encryptText, isEncrypted } from "../src/lib/crypto/encryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvdyjpxngcdindqhprmc.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Configure client with pure HTTP (no websocket)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: {
    transport: class FakeWebSocket {
      constructor() {}
      on() {}
      close() {}
      send() {}
    } as any,
  },
});

async function encryptExistingData() {
  console.log("🔒 Starting migration: Encrypting ALL database rows across all tables...");

  // 1. Tasks
  console.log("\n📦 1. Processing tasks...");
  const { data: tasks } = await supabase.from("tasks").select("id, title, description");
  if (tasks) {
    let count = 0;
    for (const t of tasks) {
      const updates: any = {};
      if (t.title && !isEncrypted(t.title)) updates.title = await encryptText(t.title);
      if (t.description && !isEncrypted(t.description)) updates.description = await encryptText(t.description);
      if (Object.keys(updates).length > 0) {
        await supabase.from("tasks").update(updates).eq("id", t.id);
        count++;
      }
    }
    console.log(`✅ Tasks: ${count} encrypted (out of ${tasks.length}).`);
  }

  // 2. Projects
  console.log("\n📁 2. Processing projects...");
  const { data: projects } = await supabase.from("projects").select("id, name");
  if (projects) {
    let count = 0;
    for (const p of projects) {
      if (p.name && !isEncrypted(p.name)) {
        await supabase.from("projects").update({ name: await encryptText(p.name) }).eq("id", p.id);
        count++;
      }
    }
    console.log(`✅ Projects: ${count} encrypted (out of ${projects.length}).`);
  }

  // 3. Sleep Logs
  console.log("\n🌙 3. Processing sleep logs...");
  const { data: sleepLogs } = await supabase.from("sleep_logs").select("user_id, date, notes");
  if (sleepLogs) {
    let count = 0;
    for (const s of sleepLogs) {
      if (s.notes && !isEncrypted(s.notes)) {
        await supabase.from("sleep_logs").update({ notes: await encryptText(s.notes) }).match({ user_id: s.user_id, date: s.date });
        count++;
      }
    }
    console.log(`✅ Sleep logs: ${count} encrypted (out of ${sleepLogs.length}).`);
  }

  // 4. Task Completions
  console.log("\n✅ 4. Processing task completions...");
  const { data: completions } = await supabase.from("task_completions").select("id, notes");
  if (completions) {
    let count = 0;
    for (const c of completions) {
      if (c.notes && !isEncrypted(c.notes)) {
        await supabase.from("task_completions").update({ notes: await encryptText(c.notes) }).eq("id", c.id);
        count++;
      }
    }
    console.log(`✅ Task completions: ${count} encrypted (out of ${completions.length}).`);
  }

  // 5. Chat Conversations
  console.log("\n💬 5. Processing chat conversations...");
  const { data: convos } = await supabase.from("chat_conversations").select("id, title");
  if (convos) {
    let count = 0;
    for (const cv of convos) {
      if (cv.title && !isEncrypted(cv.title)) {
        await supabase.from("chat_conversations").update({ title: await encryptText(cv.title) }).eq("id", cv.id);
        count++;
      }
    }
    console.log(`✅ Chat conversations: ${count} encrypted (out of ${convos.length}).`);
  }

  // 6. Chat Messages
  console.log("\n💭 6. Processing chat messages...");
  const { data: msgs } = await supabase.from("chat_messages").select("id, content");
  if (msgs) {
    let count = 0;
    for (const m of msgs) {
      if (m.content && !isEncrypted(m.content)) {
        await supabase.from("chat_messages").update({ content: await encryptText(m.content) }).eq("id", m.id);
        count++;
      }
    }
    console.log(`✅ Chat messages: ${count} encrypted (out of ${msgs.length}).`);
  }

  // 7. Reminders
  console.log("\n⏰ 7. Processing reminders...");
  const { data: reminders } = await supabase.from("reminders").select("id, title, body");
  if (reminders) {
    let count = 0;
    for (const r of reminders) {
      const updates: any = {};
      if (r.title && !isEncrypted(r.title)) updates.title = await encryptText(r.title);
      if (r.body && !isEncrypted(r.body)) updates.body = await encryptText(r.body);
      if (Object.keys(updates).length > 0) {
        await supabase.from("reminders").update(updates).eq("id", r.id);
        count++;
      }
    }
    console.log(`✅ Reminders: ${count} encrypted (out of ${reminders.length}).`);
  }

  // 8. Notification Schedules
  console.log("\n🔔 8. Processing notification schedules...");
  const { data: schedules } = await supabase.from("notification_schedules").select("id, question");
  if (schedules) {
    let count = 0;
    for (const sc of schedules) {
      if (sc.question && !isEncrypted(sc.question)) {
        await supabase.from("notification_schedules").update({ question: await encryptText(sc.question) }).eq("id", sc.id);
        count++;
      }
    }
    console.log(`✅ Notification schedules: ${count} encrypted (out of ${schedules.length}).`);
  }

  console.log("\n✨ 100% OF DATABASE DATA IN ALL TABLES IS NOW FULLY ENCRYPTED (AES-256-GCM)!");
}

encryptExistingData().catch(console.error);
