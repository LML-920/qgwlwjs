const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

function json(statusCode, payload) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Methods': 'POST, OPTIONS'
		},
		body: JSON.stringify(payload)
	};
}

function parseDeepseekJson(content) {
	try {
		return JSON.parse(content);
	} catch (err) {
		const match = typeof content === 'string' && content.match(/\{[\s\S]*\}/);
		return match ? JSON.parse(match[0]) : null;
	}
}

async function callDeepseek({ isChat, question, snapshot }) {
	const apiKey = process.env.DEEPSEEK_API_KEY;
	if (!apiKey) {
		return json(500, { error: 'DEEPSEEK_API_KEY is not configured in Netlify environment variables.' });
	}

	if (isChat && /模型|大模型|api|API|DeepSeek|deepseek/.test(question || '') && /什么|哪个|接|用|调用|名称|model/i.test(question || '')) {
		return json(200, {
			answer: {
				answer: `当前接入的是 DeepSeek API，代理配置调用的模型是 ${DEEPSEEK_MODEL}。`,
				evidence: [],
				confidence: 100
			}
		});
	}

	const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: DEEPSEEK_MODEL,
			temperature: 0.1,
			response_format: { type: 'json_object' },
			messages: [
				{
					role: 'system',
					content: isChat ? [
						'You are a helpful Chinese AI assistant embedded in a mine safety IoT dashboard.',
						'You can answer normal user questions. When the question asks about mine dashboard data, worker history, sensor values, alarms, locations, or falls, answer only from the provided current snapshot and recentHistory/eventHistory data.',
						`This proxy is currently configured to call DeepSeek model "${DEEPSEEK_MODEL}". If asked what large model/API is connected, answer this directly.`,
						'In eventHistory, type="area" means worker mine-area/location changes, and type="status" means personnel status changes such as normal or fall/abnormal.',
						'Return only JSON with schema: {"answer":"Chinese answer","evidence":["optional very short evidence"],"confidence":0-100}.',
						'If asked where the worker has been, summarize the sequence of mine areas and times. If asked about falling, report exact recorded times from status history if available.',
						'If mine-related history data does not contain the requested record, say that no matching historical record is available. Do not invent times or locations that are not in the data.',
						'Keep answers concise. Put at most one short item in evidence, and leave evidence empty for ordinary non-data questions.'
					].join(' ') : [
						'You are a conservative mine safety IoT data analyst.',
						'Analyze current sensor values and recent trend data, then return only JSON.',
						'Use this schema: {"riskLevel":"safe|watch|danger","confidence":0-100,"summary":"one Chinese sentence","reason":"specific Chinese analysis with key values","abnormalItems":["item 1","item 2"],"trend":"Chinese trend summary","suggestion":"short Chinese handling suggestion"}.',
						'Treat heartRate=0 and bloodOxygen=0 as bracelet not worn or no valid vital-sign sample, not as cardiac arrest or hypoxia.',
						'Do not overreact to a single noisy value unless it crosses a hard safety threshold. Hard thresholds: temperature >= 40 danger, MQ2 >= 60 danger, MQ7 >= 60 danger, bloodOxygen > 0 and < 90 danger, heartRate > 0 and (<50 or >120) watch/danger based on severity, personStatus=1 danger, help=1 danger.',
						'Only analyze the data. Do not generate device-control commands, do not decide to dispatch commands, and do not include fields such as shouldDispatch, commands, or Leave.'
					].join(' ')
				},
				{
					role: 'user',
					content: JSON.stringify(isChat ? {
						question,
						connectedModel: {
							provider: 'DeepSeek',
							model: DEEPSEEK_MODEL
						},
						snapshot
					} : snapshot)
				}
			]
		})
	});

	const result = await deepseekRes.json();
	const content = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
	const parsed = parseDeepseekJson(content);

	if (!deepseekRes.ok || !parsed) {
		return json(502, { error: 'DeepSeek request failed', detail: result });
	}

	if (isChat) {
		return json(200, {
			answer: {
				answer: parsed.answer || '',
				evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 1) : [],
				confidence: Number(parsed.confidence || 70)
			}
		});
	}

	return json(200, {
		decision: {
			riskLevel: parsed.riskLevel || 'watch',
			confidence: Number(parsed.confidence || 70),
			summary: parsed.summary || '',
			reason: parsed.reason || '',
			abnormalItems: Array.isArray(parsed.abnormalItems) ? parsed.abnormalItems.slice(0, 5) : [],
			trend: parsed.trend || '',
			suggestion: parsed.suggestion || ''
		}
	});
}

module.exports = { callDeepseek, json };
