import "dotenv/config";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
import { db, deleteSubscription, FEED_ID, getAllSubscribers, getSubscriptions, parseMsg, pushSubscription } from "./index.js";

const socket = new SocketModeClient({ appToken: process.env.SLACK_APP_TOKEN });
const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const MENTION_REGEX = /(?<=<@)[^|>]+(?=\||>)/;

const errors = {
    invalidMention: "Please specify who you want to subscribe to as a Slack mention.",
    alreadySubscribed: "Aleady subscribed!",
    notSubscribed: "Not subscribed!"
};

socket.on("slash_commands", async ({ body, ack, say }) => {
    if(body.command === "/dsubscribe") {
        const who = body.text.match(MENTION_REGEX)?.[0];
        if(!who) return await ack({ text: errors.invalidMention });
        if(!pushSubscription(body.user_id, who, body.channel_id)) return await ack({ text: errors.alreadySubscribed });
        await ack({ text: "Subscribed!" });
    } else if(body.command === "/dunsubscribe") {
        const who = body.text.match(MENTION_REGEX)?.[0];
        if(!who) return await ack({ text: errors.invalidMention });
        if(!deleteSubscription(body.user_id, who)) return await ack({ text: errors.notSubscribed });
        await ack({ text: "Unsubscribed!" });
    } else if(body.command === "/dsubscriptions") {
        const subscriptions = getSubscriptions(body.user_id);
        await ack({ text: "Your subscriptions:\n" + (subscriptions.map(x => `<@${x.who}>`).join("\n") || "None yet!") });
    } else if(body.command === "/dsubscribers") {
        const subscriptions = getAllSubscribers(body.user_id);
        await ack({ text: "Your subscribers:\n" + (subscriptions.map(x => `<@${x.subscriber}>`).join("\n") || "None yet!") });
    }
});
(async () => await socket.start())();

const result = await client.conversations.history({
    channel: FEED_ID
});
console.log(result.messages.map(x => parseMsg(x?.blocks?.[0]?.text?.text, x?.root?.blocks?.[0]?.text?.text)));

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