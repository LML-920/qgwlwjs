const PRODUCT_ID = process.env.ONENET_PRODUCT_ID || '0TC2zqK8BU';
const DEVICE_NAME = process.env.ONENET_DEVICE_NAME || 'ESP32S3';

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

exports.handler = async event => {
	if (event.httpMethod === 'OPTIONS') return json(204, {});
	if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
	if (!process.env.ONENET_AUTH) return json(500, { error: 'ONENET_AUTH is not configured.' });

	try {
		const url = new URL('https://iot-api.heclouds.com/thingmodel/query-device-property');
		url.searchParams.set('product_id', PRODUCT_ID);
		url.searchParams.set('device_name', DEVICE_NAME);

		const res = await fetch(url, {
			method: 'GET',
			headers: {
				Authorization: process.env.ONENET_AUTH,
				'Content-Type': 'application/json'
			}
		});
		const data = await res.json();
		return json(res.status, data);
	} catch (err) {
		return json(500, { error: err.message || 'OneNET query failed' });
	}
};
