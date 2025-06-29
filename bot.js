import "dotenv/config";
import { WebClient } from "@slack/web-api";
import { FEED_ID, parseMsg } from "./index.js";

const client = new WebClient(process.env.SLACK_TOKEN);

const result = await client.conversations.history({
    channel: FEED_ID
});
console.log(result.messages.map(x => parseMsg(x.blocks[0].text.text, x?.root?.blocks?.[0]?.text?.text)));