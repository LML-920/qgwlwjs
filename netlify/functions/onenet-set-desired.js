const PRODUCT_ID = process.env.ONENET_PRODUCT_ID || '0TC2zqK8BU';
const DEVICE_NAME = process.env.ONENET_DEVICE_NAME || 'ESP32S3';
const MAX_ATTEMPTS = 1;
const REQUEST_TIMEOUT_MS = 12000;

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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, {
			...options,
			signal: controller.signal
		});
	} finally {
		clearTimeout(timer);
	}
}

async function sendDesired(auth) {
	let lastPayload = null;
	let lastStatus = 500;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		try {
			const res = await fetchWithTimeout('https://iot-api.heclouds.com/thingmodel/set-device-desired-property', {
				method: 'POST',
				headers: {
					Authorization: auth,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					product_id: PRODUCT_ID,
					device_name: DEVICE_NAME,
					params: { Leave: 'true' }
				})
			}, REQUEST_TIMEOUT_MS);

			lastStatus = res.status;
			lastPayload = await res.json();
			if (res.ok && lastPayload && lastPayload.code === 0) return { status: res.status, payload: lastPayload };
		} catch (err) {
			lastPayload = { code: -1, msg: err.name === 'AbortError' ? 'OneNET 请求超时' : (err.message || 'OneNET command failed') };
			lastStatus = 504;
		}

		if (attempt < MAX_ATTEMPTS) await sleep(700 * attempt);
	}

	return {
		status: lastStatus,
		payload: {
			...(lastPayload || {}),
			code: lastPayload && lastPayload.code !== undefined ? lastPayload.code : -1,
			msg: (lastPayload && (lastPayload.msg || lastPayload.error)) || 'OneNET command failed',
			attempts: MAX_ATTEMPTS
		}
	};
}

exports.handler = async event => {
	if (event.httpMethod === 'OPTIONS') return json(204, {});
	if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
	if (!process.env.ONENET_AUTH) return json(500, { error: 'ONENET_AUTH is not configured.' });

	try {
		const result = await sendDesired(process.env.ONENET_AUTH);
		return json(result.status, result.payload);
	} catch (err) {
		return json(500, { error: err.message || 'OneNET command failed' });
	}
};
