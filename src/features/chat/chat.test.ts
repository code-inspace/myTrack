import { describe, it, expect } from "vitest";
import { formatAIContext } from "@/lib/ai/prompts";
import { AICoachContext } from "@/lib/ai/types";
import { encryptText, decryptEmbeddedEncryptedText } from "@/lib/crypto/encryption";

describe("AI Coach Context Formatting", () => {
  it("formats structured MyTrack user context without raw dumps", () => {
    const context: AICoachContext = {
      currentStreak: 4,
      bestStreak: 7,
      momentum: 64,
      completionRate: 75,
      totalWins: 15,
      tasksScheduled: 4,
      tasksCompleted: 3,
      topHabits: ["Morning workout", "Push-ups"],
      strugglingHabits: ["Read book"],
      recentDaysSummary: "Thu: Done, Fri: Missed, Sat: Done, Sun: Done",
    };

    const formatted = formatAIContext(context);
    expect(formatted).toContain("Série actuelle (Streak) : 4 jours");
    expect(formatted).toContain("Score de Momentum : 64/100");
    expect(formatted).toContain("Morning workout, Push-ups");
    expect(formatted).toContain("Read book");
  });

  it("decrypts embedded encrypted task names within assistant or user messages", async () => {
    const plainTask1 = "Pompes du matin";
    const plainTask2 = "Méditation 15min";
    const enc1 = await encryptText(plainTask1);
    const enc2 = await encryptText(plainTask2);

    expect(enc1.startsWith("enc:v1:")).toBe(true);
    expect(enc2.startsWith("enc:v1:")).toBe(true);

    const messageWithEncryptedTokens = `Bravo pour ta régularité sur **${enc1}** ! Tu devrais reprendre **${enc2}**.`;
    const decrypted = await decryptEmbeddedEncryptedText(messageWithEncryptedTokens);

    expect(decrypted).not.toContain("enc:v1:");
    expect(decrypted).toBe(`Bravo pour ta régularité sur **${plainTask1}** ! Tu devrais reprendre **${plainTask2}**.`);
  });
});
