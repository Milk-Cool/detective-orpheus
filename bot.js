import "dotenv/config";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import { db, deleteSubscription, FEED_ID, getAllSubscribers, getSubscriptions, getTimestamp, parseMsg, pushSubscription, setTimestamp } from "./index.js";

const socket = new SocketModeClient({ appToken: process.env.SLACK_APP_TOKEN });
const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const MENTION_REGEX = /(?<=<@)[^|>]+(?=\||>)/;

const errors = {
    invalidMention: "Please specify who you want to subscribe to as a Slack mention.",
    alreadySubscribed: "Aleady subscribed!",
    notSubscribed: "Not subscribed!"
};

const prefix = process.env.DEV ? "ddev" : "d";

socket.on("slash_commands", async ({ body, ack, say }) => {
    if(body.command === `/${prefix}subscribe`) {
        const who = body.text.match(MENTION_REGEX)?.[0];
        if(!who) return await ack({ text: errors.invalidMention });
        if(!pushSubscription(body.user_id, who, body.channel_id)) return await ack({ text: errors.alreadySubscribed });
        await ack({ text: "Subscribed!" });
    } else if(body.command === `/${prefix}unsubscribe`) {
        const who = body.text.match(MENTION_REGEX)?.[0];
        if(!who) return await ack({ text: errors.invalidMention });
        if(!deleteSubscription(body.user_id, who)) return await ack({ text: errors.notSubscribed });
        await ack({ text: "Unsubscribed!" });
    } else if(body.command === `/${prefix}subscriptions`) {
        const subscriptions = getSubscriptions(body.user_id);
        await ack({ text: "Your subscriptions:\n" + (subscriptions.map(x => `<@${x.who}>`).join("\n") || "None yet!") });
    } else if(body.command === `/${prefix}subscribers`) {
        const subscriptions = getAllSubscribers(body.user_id);
        await ack({ text: "Your subscribers:\n" + (subscriptions.map(x => `<@${x.subscriber}>`).join("\n") || "None yet!") });
    }
});
(async () => await socket.start())();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

setInterval(async () => {
    console.log("Pulling new messages...");
    const result = await client.conversations.history({
        channel: FEED_ID
    });
    const curTimestamp = getTimestamp();
    const newTimestamp = parseFloat(result.messages.find(x => x && x.ts).ts);
    const updates = result.messages
        .filter(x => x && (!curTimestamp || parseFloat(x.ts) > curTimestamp))
        .map(x => parseMsg(x?.blocks?.[0]?.text?.text, x?.root?.blocks?.[0]?.text?.text, x))
        .filter(x => x);
    for(const update of updates) {
        console.log(`Project "${update[2]}" by ${update[1]} - ${update[0]}`);
        let text;
        if(update[0] === "project")
            text = "New project!";
        else
            text = "New devlog!";
        for(const subscriber of getAllSubscribers(update[1]))
            try {
                await client.chat.postMessage({
                    channel: subscriber.dm_channel_id,
                    text: `${text}\nProject "${update[2]}"\nBy <@${update[1]}>\n\n${update[3]}\n\n${(update[0] === "project" ? update[4]?.blocks : update[4]?.root?.blocks)?.[1]?.elements?.[0]?.url || ""}`
                });
                await sleep(300);
                console.log(`Sent message to ${subscriber.subscriber}`);
            } catch(e) { console.error(e); }
    }
    setTimestamp(newTimestamp);
}, 60 * 1000); // 60s

const stop = () => {
    db.close();
    process.exit(0);
}

process.on("SIGHUP", () => stop());
process.on("SIGUSR2", () => stop());
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

process.on("uncaughtException", e => console.error(e));
process.on("unhandledRejection", e => console.error(e));