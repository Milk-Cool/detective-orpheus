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

// TODO

/** @typedef {["project" | "update", string, string, string] | null} ParsedMessage */

const ID_REGEX = /(?<=\s*by\s*<@)[^>]+(?=>)/;
/**
 * @param {string} text 
 * @returns {ParsedMessage}
 */
const parseRoot = text => {
    const [_firstLine, rest] = splitFirstNewline(text);
    let [name, description] = splitFirstNewline(rest);
    const id = description.match(ID_REGEX)?.[0];
    console.log(id);
    if(!id) return null;
    description = description.replace(/\s*by\s*<@[^>]+>$/, "");
    return ["project", id, name, description];
}

/**
 * Parses a message and returns its type, author and contents.
 * @param {string} text The raw message
 * @param {string} [root] The root message
 * @returns {ParsedMessage} [type, author ID, name, contents] or null if unparseable
 */
export const parseMsg = (text, root) => {
    if(!root) {
        return parseRoot(text);
    } else {
        const parsedRoot = parseRoot(root);
        if(parsedRoot === null) return null;
        const [_firstLine, description] = splitFirstNewline(text);
        return ["update", parsedRoot[1], parsedRoot[2], description];
    }
};