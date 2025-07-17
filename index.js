import Database from "better-sqlite3";

export const db = new Database("data.db");
db.pragma("journal_mode = WAL");

/**
 * @typedef {object} Subscription
 * @prop {number} id
 * @prop {string} subscriber
 * @prop {string} dm_channel_id
 * @prop {string} who
 */
db.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY,
    subscriber TEXT NOT NULL,
    dm_channel_id TEXT NOT NULL,
    who TEXT NOT NULL
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS timestamp (
    timestamp REAL
)`).run();

/** @returns {number | undefined} */
export function getTimestamp() {
    return db.prepare(`SELECT * FROM timestamp`).get()?.timestamp;
}
export function setTimestamp(timestamp) {
    if(getTimestamp() === undefined)
        db.prepare(`INSERT INTO timestamp (timestamp) VALUES (?)`).run(timestamp);
    else db.prepare(`UPDATE timestamp SET timestamp = ?`).run(timestamp);
}

export const FEED_ID = "C091CEEHJ9K"; // #summer-of-making-feed

/**
 * @param {string} text Text to split
 * @returns {[string, string]} Split parts
 */
export const splitFirstNewline = text => {
    const index = text.indexOf("\n");
    if(index === -1) return [text, ""];
    return [text.slice(0, index), text.slice(index + 1)];
}

/**
 * Gets a subscription.
 * @param {string} channelID Channel ID 
 * @param {string} who Who the subscriber is subscribing to (ID)
 * @returns {Subscription} The subscription
 */
export function getSubscription(channelID, who) {
    return db.prepare(`SELECT * FROM subscriptions WHERE dm_channel_id = ? AND who = ?`)
        .get(channelID, who);
}

/**
 * Gets all subscriptions to a specific person.
 * @param {string} who Who the subscribers are subscribed to (ID)
 * @returns {Subscription[]} The subscription
 */
export function getAllSubscribers(who) {
    return db.prepare(`SELECT * FROM subscriptions WHERE who = ?`)
        .all(who);
}

/**
 * Gets all subscriptions from a specific person.
 * @param {string} subscriber Who the subscribers are subscribed to (ID)
 * @returns {Subscription[]} The subscriptions
 */
export function getSubscriptions(subscriber) {
    return db.prepare(`SELECT * FROM subscriptions WHERE subscriber = ?`)
        .all(subscriber);
}

/**
 * Creates a new subscription if it doesn't exist.
 * @param {string} subscriber Subscriber ID 
 * @param {string} who Who the subscriber is subscribing to (ID)
 * @param {string} dmChannelID DM channel ID of the subscriber
 * @returns {boolean} `false` if it already exists
 */
export function pushSubscription(subscriber, who, dmChannelID) {
    if(getSubscription(dmChannelID, who))
        return false;
    db.prepare(`INSERT INTO subscriptions (subscriber, who, dm_channel_id) VALUES (?, ?, ?)`)
        .run(subscriber, who, dmChannelID);
    return true;
}

/**
 * Deletes a subscription.
 * @param {string} channelID Subscriber ID 
 * @param {string} who Who the subscriber is subscribing to (ID)
 * @returns {boolean} `false` if it didn't exist
 */
export function deleteSubscription(channelID, who) {
    if(!getSubscription(channelID, who))
        return false;
    db.prepare(`DELETE FROM subscriptions WHERE dm_channel_id = ? AND who = ?`)
        .run(channelID, who);
    return true;
}

/** @typedef {["project" | "update", string, string, string, any] | null} ParsedMessage */

const ID_REGEX = /(?<=\s*by\s*<@)[^>]+(?=>)/;
/**
 * @param {string} text 
 * @returns {ParsedMessage}
 */
const parseRoot = (text, ctx) => {
    const [_firstLine, rest] = splitFirstNewline(text);
    let [name, description] = splitFirstNewline(rest);
    const id = description.match(ID_REGEX)?.[0];
    if(!id) return null;
    description = description.replace(/\s*by\s*<@[^>]+>$/, "");
    return ["project", id, name, description, ctx];
}

/**
 * Parses a message and returns its type, author and contents.
 * @param {string} text The raw message
 * @param {string} [root] The root message
 * @param {any} [ctx] Context
 * @returns {ParsedMessage} [type, author ID, name, contents, ctx] or null if unparseable
 */
export const parseMsg = (text, root, ctx) => {
    if(!text) return null;
    if(!root) {
        return parseRoot(text, ctx);
    } else {
        const parsedRoot = parseRoot(root);
        if(parsedRoot === null) return null;
        const [_firstLine, description] = splitFirstNewline(text);
        return ["update", parsedRoot[1], parsedRoot[2], description, ctx];
    }
};