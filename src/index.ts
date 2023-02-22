/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// sec
const AdDuration = 2592000; // 2592000 sec = 30 days

import { InteractionResponseType, InteractionType, verifyKey, verifyKeyMiddleware } from "discord-interactions";

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	DISCORD_PUBLIC_KEY: string;
	MISSKEY_TOKEN: string;
}

interface InteractionObject {
	type: number;
	member?: {
		user: {
			id: string;
			username: string;
			avatar: string;
			discriminator: string;
		};
		nick?: string;
	};
	data: ApplicationCommandData;
}

interface AttachmentData {
	content_type: string,
	url: string,
}

interface ApplicationCommandData {
	name: string;
	resolved?: {
		attachments: {
			[K: number]: AttachmentData,
		}
	}
	options: Array<ApplicationCommandOptionData>;
}

interface ApplicationCommandOptionData {
	name: string;
	value?: string | number;
	options: Array<ApplicationCommandOptionData>;
}

class JsonResponse extends Response {
	constructor(body: any) {
		super(JSON.stringify(body), {
			headers: {
				"Content-Type": "application/json"
			}
		})
	}
}

async function processCommand(req: Request, env: Env): Promise<Response> {
	const data = await req.json<InteractionObject>();
	switch (data.type) {
		case InteractionType.PING:
			return new Response(JSON.stringify({ type: InteractionResponseType.PONG }))
		case InteractionType.APPLICATION_COMMAND:
			if (data.data.name != "misskey") break;
			if (data.data.options.length != 1) break;
			switch (data.data.options[0].name) {
				case "ads":
					switch (data.data.options[0].options[0].name) {
						case "create":
							return await CreateAd(data, env);
					}
			}
			CreateAd(data, env);
	}
	return new Response("Hello, world");
}

async function CreateAd(data: InteractionObject, env: Env) {
	var url: string | null = null;
	var image: AttachmentData | null = null;
	var form: string | null = null;
	for (const option of data.data.options[0].options[0].options) {
		switch (option.name) {
			case "url":
				url = option.value as string;
				break;
			case "image":
				image = data.data.resolved!.attachments[option.value as number];
				break;
			case "form":
				form = option.value as string;
				break;
			default:
				break;
		}
	}
	if (url == null || image == null || form == null) {
		return new JsonResponse({
			"type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			"data": {
				"content": "Invalid options"
			}
		})
	}
	try {
		new URL(url);
	} catch (_) {
		return new JsonResponse({
			"type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			"data": {
				"content": "url is not valid url",
			}
		})
	}
	if (!image.content_type.startsWith("image")) {
		return new JsonResponse({
			"type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			"data": {
				"content": "attachment is not image",
			}
		})
	}
	var result = await fetch("https://key.tpc3.org/api/admin/ad/create", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"User-Agent": "MisskeyIntegrate",
		},
		body: JSON.stringify({
			i: env.MISSKEY_TOKEN,
			url: url,
			memo: 'made by MisskeyIntegrate\nRequested by ' + data.member?.user.username + "(" + data.member?.user.id + ")",
			place: form,
			priority: 'middle',
			ratio: 10,
			expiresAt: new Date().getTime() + (AdDuration * 1000),
			imageUrl: image.url,
		}),
	});
	if (result.ok) {
		return new JsonResponse({
			"type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			"data": {
				"content": "Ads created successfully!"
			}
		})
	} else {
		return new JsonResponse({
			"type": InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			"data": {
				"content": "Failed to create ads: "+result.status + " "+ result.statusText + "\n"+await result.text()
			}
		})
	}
}

export default {
	async fetch(
		req: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const signature = req.headers.get('X-Signature-Ed25519')!;
		const timestamp = req.headers.get('X-Signature-Timestamp')!;
		const body = await req.clone().arrayBuffer();
		const valid = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
		if (!valid) {
			return new Response("Invalid signature", { status: 401 })
		}
		return processCommand(req, env);
	},
};
