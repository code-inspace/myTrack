      .limit(days);

    if (!error && data) {
      return data.map(mapDbSleepLogToModel);
    }
  } catch (err) {
    console.warn("Supabase fetchSleepHistory error:", err);
  }
  return [];
}
