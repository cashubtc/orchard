/**
 * Ollama host-side readiness. The @ai specs run against ONE ollama on the
 * host, and agent executions are fire-and-forget: an `ai_agent_execute` run
 * keeps generating tokens on ollama after its test has moved on, and even a
 * `workers: 1` serial run can start the next inference test while that run is
 * still churning — the assistant then times out with `ai_health` still true
 * (health ≠ idle). These helpers let an inference test wait until ollama is
 * actually free before it starts, so a leftover run can never starve it.
 *
 * Reached directly from the test's Node process — ollama listens on the host
 * (`host.docker.internal:11434` from the container == `localhost:11434` from
 * here). Override with `AI_OLLAMA_URL` if it lives elsewhere.
 */

const OLLAMA_URL = process.env.AI_OLLAMA_URL ?? 'http://localhost:11434';

/** Model to probe with. Matches the model the @ai suite drives (`AI_MODEL`),
 *  so the idle probe loads/uses the same weights the tests do — probing a
 *  different model would itself evict the test model and add latency. */
function probeModel(): string {
	return process.env.AI_MODEL ?? 'qwen3-vl:latest';
}

/**
 * True if ollama answers a trivial one-token prompt within `budgetMs`. A busy
 * ollama (mid-generation for another request) queues the probe and blows the
 * budget → false. A free ollama answers a warm model in well under a second.
 */
export async function ollamaIdle(budgetMs = 8_000): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), budgetMs);
	try {
		const res = await fetch(`${OLLAMA_URL}/api/generate`, {
			method: 'POST',
			headers: {'content-type': 'application/json'},
			body: JSON.stringify({model: probeModel(), prompt: 'hi', stream: false, options: {num_predict: 1}}),
			signal: controller.signal,
		});
		if (!res.ok) return false;
		await res.json();
		return true;
	} catch {
		// Abort (busy → over budget) or network error → not idle.
		return false;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Block until ollama is idle (or `timeoutMs` elapses). Poll cadence is the
 * probe budget itself — each attempt either returns fast (idle) or eats its
 * budget (busy), so no extra sleep is needed. Returns true once idle, false if
 * the deadline passes (caller decides whether to skip or proceed).
 */
export async function waitForOllamaIdle(timeoutMs = 240_000, budgetMs = 8_000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	// First check is cheap when already idle.
	// eslint-disable-next-line no-constant-condition
	while (true) {
		if (await ollamaIdle(budgetMs)) return true;
		if (Date.now() >= deadline) return false;
	}
}
