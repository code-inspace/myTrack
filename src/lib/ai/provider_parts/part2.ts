          return new HeuristicAIProvider().generateResponse(request);
        }
      },
    };
  }

  // Default: Built-in Heuristic AI Coach (Free, 0 latency, 0 external API cost)
  return new HeuristicAIProvider();
}
