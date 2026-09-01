import { describe, it } from "vitest";
import { decryptText } from "@/lib/crypto/encryption";

const supabaseUrl = "https://bvdyjpxngcdindqhprmc.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZHlqcHhuZ2NkaW5kcWhwcm1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzNjYwMywiZXhwIjoyMTAzMDEyNjAzfQ.IlUB0n1mLfapf60gWlUZsJiOm7YpRYHiv0mlcTJgby0";

describe("Direct Supabase DB State", () => {
  it("dumps all users, tasks, completions and calendars", async () => {
    // 1. Users
    const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const usersData = await usersRes.json();
    console.log("=== USERS IN AUTH ===");
    for (const u of usersData.users || []) {
      console.log(`User: id=${u.id} email=${u.email} last_sign_in_at=${u.last_sign_in_at}`);
    }

    // 2. Tasks
    const tasksRes = await fetch(`${supabaseUrl}/rest/v1/tasks?select=*&order=created_at.desc`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const tasks = await tasksRes.json();
    console.log(`=== TASKS IN DB (Total: ${tasks.length}) ===`);
    for (const t of tasks) {
      let title = t.title;
      try {
        if (title?.startsWith("enc:v1:")) {
          title = await decryptText(title);
        }
      } catch (e) {
        title = `[Decrypt Error: ${e}]`;
      }
      console.log(`[${t.user_id}] id=${t.id} title="${title}" date_overrides=${JSON.stringify(t.date_overrides)} created_at=${t.created_at}`);
    }

    // 3. Completions
    const compsRes = await fetch(`${supabaseUrl}/rest/v1/task_completions?select=*&order=date.desc`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const comps = await compsRes.json();
    console.log(`=== TASK COMPLETIONS IN DB (Total: ${comps.length}) ===`);
    for (const c of comps) {
      console.log(`[${c.user_id}] comp_id=${c.id} task_id=${c.task_id} date=${c.date} completed=${c.completed}`);
    }
  });
});
